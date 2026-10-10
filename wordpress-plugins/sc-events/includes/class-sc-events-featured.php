<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Paying to feature an event (events redesign, Stage 5). Reuses sc-ads'
 * PayPal integration — same credentials, mode (sandbox/live) and webhook —
 * rather than a second PayPal setup: SC_Ads_PayPal creates and captures
 * the order, with custom_id "event-{id}" so sc-ads' webhook hands a
 * completed payment back here (sc_ads_paypal_capture_completed).
 *
 * Featuring is for single (non-repeating) events, owner only, and lasts
 * until the event's date: sc_event_featured is set true and
 * sc_event_featured_until records the date. The frontend stops showing
 * the badge and slider spot once the event is over, whether or not
 * anything has unset the flag yet.
 */
class SC_Events_Featured {

	/**
	 * Must match EVENT_UPGRADE_PRICE in lib/pricing.ts ("£5 per event").
	 * Kept by hand on both sides, the same arrangement as sc-ads'
	 * PLACEMENT_PRICE_PER_DAY.
	 */
	const PRICE = 5.00;

	const CUSTOM_ID_PREFIX = 'event-';

	public static function init() {
		add_action( 'sc_ads_paypal_capture_completed', array( __CLASS__, 'on_webhook_capture' ), 10, 2 );
	}

	public static function register_routes() {
		register_rest_route(
			'sc-events/v1',
			'/(?P<id>\d+)/feature/create-order',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'create_order' ),
				'permission_callback' => array( 'SC_Events_REST', 'check_owns_event' ),
			)
		);
		register_rest_route(
			'sc-events/v1',
			'/(?P<id>\d+)/feature/capture',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'capture' ),
				'permission_callback' => array( 'SC_Events_REST', 'check_owns_event' ),
			)
		);
	}

	/** The Y-m-d date featuring ends: the event's (single) date. */
	private static function event_date( $event_id ) {
		$start = (string) get_post_meta( $event_id, 'sc_start', true );
		$day   = SC_Events_Meta::normalise_datetime( $start );
		return $day ? substr( $day, 0, 10 ) : '';
	}

	/** True while the event is featured and its date hasn't passed. */
	public static function is_featured_now( $event_id ) {
		if ( ! get_post_meta( $event_id, 'sc_event_featured', true ) ) {
			return false;
		}
		$until = (string) get_post_meta( $event_id, 'sc_event_featured_until', true );
		return '' === $until || $until >= wp_date( 'Y-m-d' );
	}

	/** Why this event can't be featured right now, or null if it can. */
	private static function cannot_feature( $event_id ) {
		if ( 'publish' !== get_post_status( $event_id ) ) {
			return 'Only live events can be featured.';
		}
		if ( count( (array) get_post_meta( $event_id, 'sc_repeat_dates', true ) ) > 1 ) {
			return 'Featuring is for single events, not repeating ones.';
		}
		$date = self::event_date( $event_id );
		if ( ! $date || $date < wp_date( 'Y-m-d' ) ) {
			return 'This event has already happened.';
		}
		if ( self::is_featured_now( $event_id ) ) {
			return 'This event is already featured.';
		}
		return null;
	}

	public static function create_order( WP_REST_Request $request ) {
		$event_id = (int) $request->get_param( 'id' );
		$why      = self::cannot_feature( $event_id );
		if ( $why ) {
			return new WP_Error( 'cannot_feature', $why, array( 'status' => 400 ) );
		}
		if ( ! class_exists( 'SC_Ads_PayPal' ) ) {
			return new WP_Error( 'paypal_unavailable', "Payment isn't available right now. Please try again later.", array( 'status' => 503 ) );
		}

		$order = SC_Ads_PayPal::create_order(
			self::CUSTOM_ID_PREFIX . $event_id,
			self::PRICE,
			'GBP',
			'Secret Carshalton featured event #' . $event_id
		);
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		update_post_meta( $event_id, 'sc_event_paypal_order_id', $order['id'] );
		return array(
			'orderId' => $order['id'],
			'amount'  => self::PRICE,
		);
	}

	public static function capture( WP_REST_Request $request ) {
		$event_id = (int) $request->get_param( 'id' );
		$order_id = sanitize_text_field( (string) $request->get_param( 'orderId' ) );

		if ( ! $order_id || get_post_meta( $event_id, 'sc_event_paypal_order_id', true ) !== $order_id ) {
			return new WP_Error( 'order_mismatch', "This payment doesn't match the event.", array( 'status' => 400 ) );
		}
		if ( ! class_exists( 'SC_Ads_PayPal' ) ) {
			return new WP_Error( 'paypal_unavailable', "Payment isn't available right now. Please try again later.", array( 'status' => 503 ) );
		}

		$capture = SC_Ads_PayPal::capture_order( $order_id );
		if ( is_wp_error( $capture ) ) {
			return $capture;
		}
		if ( 'COMPLETED' !== ( $capture['status'] ?? '' ) ) {
			return new WP_Error( 'not_completed', 'PayPal has not completed this payment yet.', array( 'status' => 409 ) );
		}

		$value = $capture['purchase_units'][0]['payments']['captures'][0]['amount']['value'] ?? null;
		self::mark_featured( $event_id, $value );

		return array(
			'status'   => 'featured',
			'until'    => get_post_meta( $event_id, 'sc_event_featured_until', true ),
		);
	}

	/** sc-ads' webhook safety net: the payment went through but the browser never got back to capture(). */
	public static function on_webhook_capture( $custom_id, $resource ) {
		if ( 0 !== strpos( $custom_id, self::CUSTOM_ID_PREFIX ) ) {
			return;
		}
		$event_id = absint( substr( $custom_id, strlen( self::CUSTOM_ID_PREFIX ) ) );
		if ( ! $event_id || SC_Events_CPT::POST_TYPE !== get_post_type( $event_id ) ) {
			return;
		}
		if ( 'COMPLETED' !== ( $resource['status'] ?? '' ) || 'paid' === get_post_meta( $event_id, 'sc_event_featured_payment', true ) ) {
			return;
		}
		self::mark_featured( $event_id, $resource['amount']['value'] ?? null );
	}

	/** Features the event until its date, records the payment and tells Rob. Safe to call twice. */
	private static function mark_featured( $event_id, $value ) {
		$already = 'paid' === get_post_meta( $event_id, 'sc_event_featured_payment', true );

		update_post_meta( $event_id, 'sc_event_featured', true );
		update_post_meta( $event_id, 'sc_event_featured_until', self::event_date( $event_id ) );
		update_post_meta( $event_id, 'sc_event_featured_status', 'approved' );
		update_post_meta( $event_id, 'sc_event_featured_payment', 'paid' );
		if ( null !== $value ) {
			update_post_meta( $event_id, 'sc_event_featured_amount_paid', '£' . $value );
		}

		if ( ! $already ) {
			$event = get_post( $event_id );
			$owner = $event ? get_userdata( (int) $event->post_author ) : null;
			wp_mail(
				get_option( 'admin_email' ),
				'Event featured (paid) — ' . ( $event ? $event->post_title : '#' . $event_id ),
				( $owner ? "{$owner->display_name} ({$owner->user_email})" : 'A member' ) .
				' has paid ' . ( null !== $value ? '£' . $value : '' ) . " to feature an event. It's now in the featured slider and has the Featured badge until " .
				self::event_date( $event_id ) . ".\n\nEvent: " . ( $event ? $event->post_title : '#' . $event_id ) .
				"\nEdit it here:\n" . admin_url( 'post.php?post=' . $event_id . '&action=edit' )
			);
		}

		/** For anything else that wants to know (e.g. clearing caches). */
		do_action( 'sc_events_event_featured', $event_id );
	}
}
