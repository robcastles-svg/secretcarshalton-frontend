<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The three endpoints that turn submit_ad's "pending" ad into a paid,
 * live one: create an order for its total, capture it once the member
 * approves in PayPal's popup, and a webhook as a safety net for the
 * capture call never completing (tab closed, network drop) after
 * PayPal already took the money.
 */
class SC_Ads_PayPal_REST {

	/**
	 * £/day per placement — must match lib/pricing.ts's TEXT_AD_TIERS.
	 * Kept here rather than fetched from the frontend because this PHP
	 * has no reachable access to that TS file at request time; if the
	 * frontend's prices change, update both.
	 */
	const PLACEMENT_PRICE_PER_DAY = array(
		'sidebar'    => 2.5,
		'in_article' => 3.0,
	);

	public static function register_routes() {
		register_rest_route(
			'sc-ads/v1',
			'/paypal/client-id',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_client_id' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-ads/v1',
			'/paypal/create-order',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'create_order' ),
				'permission_callback' => array( __CLASS__, 'check_owns_ad_from_param' ),
			)
		);

		register_rest_route(
			'sc-ads/v1',
			'/paypal/capture-order',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'capture_order' ),
				'permission_callback' => array( __CLASS__, 'check_owns_ad_from_param' ),
			)
		);

		register_rest_route(
			'sc-ads/v1',
			'/paypal/webhook',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle_webhook' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/** The Client ID (never the Secret) for whichever mode is active — public by design, needed client-side to load PayPal's JS SDK and render its Buttons widget. */
	public static function get_client_id( WP_REST_Request $request ) {
		$creds = SC_Ads_PayPal_Settings::active_credentials();
		return array(
			'clientId' => $creds['client_id'],
			'mode'     => $creds['mode'],
			'currency' => 'GBP',
		);
	}

	/** Same ownership rule as SC_Ads_REST::check_owns_ad, reading the post ID from the body (ad_id) instead of the route — these two POST endpoints take it as a param, not a URL segment. */
	public static function check_owns_ad_from_param( WP_REST_Request $request ) {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'not_logged_in', 'You must be logged in.', array( 'status' => 401 ) );
		}
		$ad = get_post( absint( $request->get_param( 'ad_id' ) ) );
		if ( ! $ad || SC_Ads_CPT::POST_TYPE !== $ad->post_type ) {
			return new WP_Error( 'not_found', 'Ad not found.', array( 'status' => 404 ) );
		}
		$current_user_id = get_current_user_id();
		if ( (int) $ad->post_author !== $current_user_id && ! user_can( $current_user_id, 'manage_options' ) ) {
			return new WP_Error( 'not_owner', 'You can only pay for your own ads.', array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * The amount charged is always recomputed server-side from the ad's
	 * own stored placement + days_requested — never trusts a total the
	 * client might send, so there's no way to pay less than the real
	 * price by tampering with the request.
	 */
	private static function amount_for_ad( $ad_id ) {
		$placement = get_post_meta( $ad_id, 'sc_ad_placement', true );
		$days      = max( 1, (int) get_post_meta( $ad_id, 'sc_ad_days_requested', true ) ?: 1 );
		$per_day   = self::PLACEMENT_PRICE_PER_DAY[ $placement ] ?? null;

		if ( null === $per_day ) {
			return null;
		}

		return round( $per_day * $days, 2 );
	}

	public static function create_order( WP_REST_Request $request ) {
		$ad_id = absint( $request->get_param( 'ad_id' ) );

		if ( 'paid' === get_post_meta( $ad_id, 'sc_ad_payment_status', true ) ) {
			return new WP_Error( 'already_paid', 'This ad is already paid for.', array( 'status' => 400 ) );
		}

		$amount = self::amount_for_ad( $ad_id );
		if ( null === $amount ) {
			return new WP_Error( 'unpriced_placement', 'This ad\'s placement has no listed price.', array( 'status' => 400 ) );
		}

		$order = SC_Ads_PayPal::create_order( $ad_id, $amount );
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		update_post_meta( $ad_id, 'sc_ad_paypal_order_id', $order['id'] );

		return array(
			'orderId' => $order['id'],
			'amount'  => $amount,
		);
	}

	/**
	 * Captures the order the member just approved in PayPal's popup,
	 * then — only on a confirmed COMPLETED capture — flips the ad live:
	 * sc_ad_active = true, payment_status = 'paid', amount_paid filled
	 * in from what PayPal actually captured (not the estimate), exactly
	 * the two fields the plugin's docblock said an admin used to set by
	 * hand once paid.
	 */
	public static function capture_order( WP_REST_Request $request ) {
		$ad_id    = absint( $request->get_param( 'ad_id' ) );
		$order_id = sanitize_text_field( (string) $request->get_param( 'orderId' ) );

		$stored_order_id = get_post_meta( $ad_id, 'sc_ad_paypal_order_id', true );
		if ( ! $order_id || $order_id !== $stored_order_id ) {
			return new WP_Error( 'order_mismatch', 'This order does not match the ad\'s current order.', array( 'status' => 400 ) );
		}

		$capture = SC_Ads_PayPal::capture_order( $order_id );
		if ( is_wp_error( $capture ) ) {
			return $capture;
		}

		if ( 'COMPLETED' !== ( $capture['status'] ?? '' ) ) {
			return new WP_Error( 'not_completed', 'PayPal has not completed this payment yet.', array( 'status' => 409 ) );
		}

		self::mark_paid_from_capture( $ad_id, $capture );

		return array(
			'status' => 'paid',
			'active' => true,
		);
	}

	private static function mark_paid_from_capture( $ad_id, $capture ) {
		$captured_value = $capture['purchase_units'][0]['payments']['captures'][0]['amount']['value'] ?? null;

		update_post_meta( $ad_id, 'sc_ad_payment_status', 'paid' );
		update_post_meta( $ad_id, 'sc_ad_active', true );
		if ( null !== $captured_value ) {
			update_post_meta( $ad_id, 'sc_ad_amount_paid', '£' . $captured_value );
		}
	}

	/**
	 * Safety net for the capture REST call never completing client-side
	 * even though PayPal did take the payment (tab closed, phone lost
	 * signal, etc. right after approval). Verifies the signature first —
	 * never trusts an unverified payload — then, only for a
	 * PAYMENT.CAPTURE.COMPLETED event, looks up the ad by the custom_id
	 * we set at order-creation time and marks it paid if it isn't
	 * already, so a lost client never leaves a real payment stuck on
	 * "pending" with no live ad to show for it.
	 */
	public static function handle_webhook( WP_REST_Request $request ) {
		$raw_body = $request->get_body();
		$headers  = array(
			'paypal_auth_algo'         => $request->get_header( 'paypal-auth-algo' ),
			'paypal_cert_url'          => $request->get_header( 'paypal-cert-url' ),
			'paypal_transmission_id'   => $request->get_header( 'paypal-transmission-id' ),
			'paypal_transmission_sig'  => $request->get_header( 'paypal-transmission-sig' ),
			'paypal_transmission_time' => $request->get_header( 'paypal-transmission-time' ),
		);

		$verified = SC_Ads_PayPal::verify_webhook_signature( $headers, $raw_body );
		if ( is_wp_error( $verified ) || ! $verified ) {
			return new WP_Error( 'sc_ads_paypal_bad_signature', 'Could not verify this webhook.', array( 'status' => 400 ) );
		}

		$event = json_decode( $raw_body, true );
		if ( 'PAYMENT.CAPTURE.COMPLETED' !== ( $event['event_type'] ?? '' ) ) {
			return array( 'ok' => true, 'ignored' => true );
		}

		$resource  = $event['resource'] ?? array();
		$custom_id = (string) ( $resource['custom_id'] ?? '' );
		// Payments started by other plugins through this same PayPal setup
		// (e.g. sc-events' "event-123" for featuring an event) carry their
		// own custom_id prefix — hand those on rather than ignoring them,
		// so one webhook covers every kind of payment on the site.
		if ( '' !== $custom_id && ! ctype_digit( $custom_id ) ) {
			do_action( 'sc_ads_paypal_capture_completed', $custom_id, $resource );
			return array( 'ok' => true );
		}
		$ad_id = absint( $custom_id );
		if ( ! $ad_id || SC_Ads_CPT::POST_TYPE !== get_post_type( $ad_id ) ) {
			return array( 'ok' => true, 'ignored' => true );
		}

		if ( 'paid' !== get_post_meta( $ad_id, 'sc_ad_payment_status', true ) && 'COMPLETED' === ( $resource['status'] ?? '' ) ) {
			self::mark_paid_from_capture(
				$ad_id,
				array( 'purchase_units' => array( array( 'payments' => array( 'captures' => array( $resource ) ) ) ) )
			);
		}

		return array( 'ok' => true );
	}
}
