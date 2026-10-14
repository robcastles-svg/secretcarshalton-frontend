<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Every payment the site takes, in one place (Rob, 2026-10: paid things go
 * live straight away, he gets an email for each payment, and can refund or
 * unpublish anything from wp-admin).
 *
 * - A ledger: one private sc_payment post per payment (ads, featured
 *   events, walk maps, directory listings, Featured, jobs, group
 *   promotions, and each yearly renewal), shown under Payments in wp-admin
 *   with Refund and Unpublish buttons.
 * - A shared checkout other plugins plug into through the
 *   'sc_payments_products' filter, instead of each writing its own
 *   create-order/capture routes: POST sc-ads/v1/pay/{kind}/{id}/create-order
 *   and …/capture. The product decides the price server-side.
 * - Yearly subscriptions (the £2.50/year standard listing): the buyer
 *   approves on PayPal's own page and comes back to the site, which
 *   confirms it. A daily check picks up renewals, cancellations and
 *   failed payments; 30 days after a lapsed subscription's paid period
 *   ends the product's 'lapse' callback runs (the listing is unpublished).
 *
 * A product is an array:
 *   label        'Job post'
 *   title        fn( $id ) → item name for emails and the Payments screen
 *   edit_url     fn( $id ) → wp-admin link
 *   can_pay      fn( $id, $user_id, $stage ) → true | WP_Error   (checkout products;
 *                $stage is 'start' when an order/subscription is being started —
 *                only then refuse "already paid" — or 'finish' when confirming one)
 *   price        fn( $id, WP_REST_Request ) → array( amount, description, context ) | WP_Error
 *   on_paid      fn( $id, $payment_id, $context ) → array merged into the capture response
 *   undo         fn( $id ) → short description of what was undone (Unpublish button)
 *   subscription array( 'key', 'name', 'price' ) for yearly products
 *   lapse        fn( $id ) → called when a subscription has lapsed for 30 days
 */
class SC_Ads_Payments {

	const POST_TYPE   = 'sc_payment';
	const CRON_HOOK   = 'sc_payments_daily';
	const GRACE_DAYS  = 30;
	const ORDER_CACHE = 'sc_pay_order_';

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_post_type' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_post_sc_payments_refund', array( __CLASS__, 'handle_refund' ) );
		add_action( 'admin_post_sc_payments_undo', array( __CLASS__, 'handle_undo' ) );
		add_action( self::CRON_HOOK, array( __CLASS__, 'check_subscriptions' ) );
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::CRON_HOOK );
		}
	}

	public static function register_post_type() {
		register_post_type(
			self::POST_TYPE,
			array(
				'label'    => 'Payments',
				'public'   => false,
				'show_ui'  => false,
				'supports' => array( 'title' ),
			)
		);
	}

	public static function products() {
		return apply_filters( 'sc_payments_products', array() );
	}

	private static function product( $kind ) {
		$products = self::products();
		return $products[ $kind ] ?? null;
	}

	/** The public site's address for links in emails (sc-revalidate already stores it), falling back to the live domain. */
	public static function site_url( $path = '' ) {
		$base = trim( (string) get_option( 'sc_revalidate_frontend_url', '' ) );
		if ( ! $base ) {
			$base = 'https://www.secretcarshalton.com';
		}
		return rtrim( $base, '/' ) . $path;
	}

	// ------------------------------------------------------------------
	// Ledger
	// ------------------------------------------------------------------

	/**
	 * Records a payment. $args: kind, object_id, amount, user_id, order_id,
	 * capture_id, subscription_id, payer_name, payer_email, note, renewal.
	 * Idempotent on order_id / capture_id, so a retried capture or a webhook
	 * arriving after the browser never records the same payment twice.
	 */
	public static function record( array $args ) {
		foreach ( array( 'order_id', 'capture_id' ) as $key ) {
			if ( ! empty( $args[ $key ] ) ) {
				$existing = self::find_by( $key, $args[ $key ] );
				if ( $existing ) {
					return $existing;
				}
			}
		}

		$product = self::product( $args['kind'] ?? '' );
		$title   = $product && isset( $product['title'] ) ? call_user_func( $product['title'], $args['object_id'] ?? 0 ) : '#' . ( $args['object_id'] ?? 0 );
		$label   = $product['label'] ?? ( $args['kind'] ?? 'Payment' );

		$payment_id = wp_insert_post(
			array(
				'post_type'   => self::POST_TYPE,
				'post_status' => 'publish',
				'post_title'  => $label . ' — ' . $title,
				'post_author' => (int) ( $args['user_id'] ?? 0 ),
			)
		);
		if ( is_wp_error( $payment_id ) || ! $payment_id ) {
			return 0;
		}

		$meta = array(
			'kind'            => $args['kind'] ?? '',
			'object_id'       => (int) ( $args['object_id'] ?? 0 ),
			'amount'          => number_format( (float) ( $args['amount'] ?? 0 ), 2, '.', '' ),
			'order_id'        => $args['order_id'] ?? '',
			'capture_id'      => $args['capture_id'] ?? '',
			'subscription_id' => $args['subscription_id'] ?? '',
			'payer_name'      => $args['payer_name'] ?? '',
			'payer_email'     => $args['payer_email'] ?? '',
			'note'            => $args['note'] ?? '',
			'renewal'         => empty( $args['renewal'] ) ? '' : '1',
			'status'          => 'paid',
			'mode'            => SC_Ads_PayPal_Settings::active_credentials()['mode'],
		);
		foreach ( $meta as $key => $value ) {
			update_post_meta( $payment_id, $key, $value );
		}
		return $payment_id;
	}

	/** record() plus the email to Rob, but only the first time this payment is seen. Returns the ledger ID. */
	public static function record_once( array $args, $headline = 'New payment' ) {
		foreach ( array( 'order_id', 'capture_id' ) as $key ) {
			if ( ! empty( $args[ $key ] ) && self::find_by( $key, $args[ $key ] ) ) {
				return self::find_by( $key, $args[ $key ] );
			}
		}
		$payment_id = self::record( $args );
		if ( $payment_id ) {
			self::notify_admin( $payment_id, $headline );
		}
		return $payment_id;
	}

	private static function find_by( $key, $value ) {
		$ids = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => 'any',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'meta_key'       => $key, // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_value'     => $value, // phpcs:ignore WordPress.DB.SlowDBQuery
			)
		);
		return $ids ? (int) $ids[0] : 0;
	}

	/** Payer name/email and capture ID out of a v2 capture (or order) response. */
	public static function capture_details( $capture ) {
		$payer = $capture['payer'] ?? array();
		return array(
			'capture_id'  => $capture['purchase_units'][0]['payments']['captures'][0]['id'] ?? '',
			'amount'      => $capture['purchase_units'][0]['payments']['captures'][0]['amount']['value'] ?? null,
			'payer_name'  => trim( ( $payer['name']['given_name'] ?? '' ) . ' ' . ( $payer['name']['surname'] ?? '' ) ),
			'payer_email' => $payer['email_address'] ?? '',
		);
	}

	/** One email to Rob per payment. */
	public static function notify_admin( $payment_id, $headline = 'New payment' ) {
		$kind    = get_post_meta( $payment_id, 'kind', true );
		$product = self::product( $kind );
		$object  = (int) get_post_meta( $payment_id, 'object_id', true );
		$lines   = array(
			get_the_title( $payment_id ),
			'Amount: £' . get_post_meta( $payment_id, 'amount', true ) . ( 'sandbox' === get_post_meta( $payment_id, 'mode', true ) ? ' (sandbox — test money)' : '' ),
		);
		$payer = trim( get_post_meta( $payment_id, 'payer_name', true ) . ' ' . get_post_meta( $payment_id, 'payer_email', true ) );
		if ( $payer ) {
			$lines[] = 'Paid by: ' . $payer;
		}
		$note = get_post_meta( $payment_id, 'note', true );
		if ( $note ) {
			$lines[] = $note;
		}
		if ( $product && isset( $product['edit_url'] ) ) {
			$lines[] = "\nEdit it: " . call_user_func( $product['edit_url'], $object );
		}
		$lines[] = 'Refund or unpublish: ' . admin_url( 'admin.php?page=sc-payments' );

		wp_mail( get_option( 'admin_email' ), $headline . ' — ' . get_the_title( $payment_id ), implode( "\n", $lines ) );

		/** Lets sc-membership put the same payment in the admins' notification bell. */
		do_action( 'sc_payments_admin_notified', $payment_id, $headline );
	}

	// ------------------------------------------------------------------
	// Shared checkout
	// ------------------------------------------------------------------

	public static function register_routes() {
		$logged_in = function () {
			return is_user_logged_in() ? true : new WP_Error( 'not_logged_in', 'You must be logged in.', array( 'status' => 401 ) );
		};
		register_rest_route(
			'sc-ads/v1',
			'/pay/(?P<kind>[a-z_]+)/(?P<id>\d+)/create-order',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_create_order' ),
				'permission_callback' => $logged_in,
			)
		);
		register_rest_route(
			'sc-ads/v1',
			'/pay/(?P<kind>[a-z_]+)/(?P<id>\d+)/capture',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_capture' ),
				'permission_callback' => $logged_in,
			)
		);
		register_rest_route(
			'sc-ads/v1',
			'/subscribe/(?P<kind>[a-z_]+)/(?P<id>\d+)',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_subscribe' ),
				'permission_callback' => $logged_in,
			)
		);
		register_rest_route(
			'sc-ads/v1',
			'/subscribe/(?P<kind>[a-z_]+)/(?P<id>\d+)/confirm',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rest_confirm_subscription' ),
				'permission_callback' => $logged_in,
			)
		);
	}

	/** The product for a request, after checking the member may pay for this item. */
	private static function checkout_product( WP_REST_Request $request, $stage ) {
		$kind    = sanitize_key( (string) $request->get_param( 'kind' ) );
		$id      = (int) $request->get_param( 'id' );
		$product = self::product( $kind );
		if ( ! $product || ! isset( $product['can_pay'] ) ) {
			return new WP_Error( 'unknown_product', "That can't be paid for here.", array( 'status' => 404 ) );
		}
		$allowed = call_user_func( $product['can_pay'], $id, get_current_user_id(), $stage );
		if ( is_wp_error( $allowed ) ) {
			return $allowed;
		}
		return array( $kind, $id, $product );
	}

	public static function rest_create_order( WP_REST_Request $request ) {
		$checked = self::checkout_product( $request, 'start' );
		if ( is_wp_error( $checked ) ) {
			return $checked;
		}
		list( $kind, $id, $product ) = $checked;

		$price = call_user_func( $product['price'], $id, $request );
		if ( is_wp_error( $price ) ) {
			return $price;
		}
		list( $amount, $description, $context ) = array_pad( $price, 3, array() );

		$order = SC_Ads_PayPal::create_order( 'pay:' . $kind . ':' . $id, $amount, 'GBP', $description );
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		set_transient(
			self::ORDER_CACHE . $order['id'],
			array(
				'kind'    => $kind,
				'id'      => $id,
				'user'    => get_current_user_id(),
				'context' => $context,
			),
			DAY_IN_SECONDS
		);
		return array(
			'orderId' => $order['id'],
			'amount'  => $amount,
		);
	}

	public static function rest_capture( WP_REST_Request $request ) {
		$checked = self::checkout_product( $request, 'finish' );
		if ( is_wp_error( $checked ) ) {
			return $checked;
		}
		list( $kind, $id, $product ) = $checked;

		$order_id = sanitize_text_field( (string) $request->get_param( 'orderId' ) );
		$pending  = $order_id ? get_transient( self::ORDER_CACHE . $order_id ) : false;
		if ( ! $pending || $pending['kind'] !== $kind || (int) $pending['id'] !== $id || (int) $pending['user'] !== get_current_user_id() ) {
			return new WP_Error( 'order_mismatch', "This payment doesn't match.", array( 'status' => 400 ) );
		}

		$capture = SC_Ads_PayPal::capture_order( $order_id );
		if ( is_wp_error( $capture ) ) {
			// Already captured by an earlier attempt that lost its response.
			$capture = SC_Ads_PayPal::get_order( $order_id );
			if ( is_wp_error( $capture ) ) {
				return $capture;
			}
		}
		if ( 'COMPLETED' !== ( $capture['status'] ?? '' ) ) {
			return new WP_Error( 'not_completed', 'PayPal has not completed this payment yet.', array( 'status' => 409 ) );
		}

		$already = self::find_by( 'order_id', $order_id );
		$details = self::capture_details( $capture );
		$payment = $already ? $already : self::record(
			array(
				'kind'        => $kind,
				'object_id'   => $id,
				'amount'      => $details['amount'],
				'user_id'     => get_current_user_id(),
				'order_id'    => $order_id,
				'capture_id'  => $details['capture_id'],
				'payer_name'  => $details['payer_name'],
				'payer_email' => $details['payer_email'],
			)
		);

		$result = (array) call_user_func( $product['on_paid'], $id, $payment, (array) $pending['context'] );
		if ( ! $already ) {
			self::notify_admin( $payment );
		}
		return array_merge( array( 'status' => 'paid' ), $result );
	}

	// ------------------------------------------------------------------
	// Yearly subscriptions
	// ------------------------------------------------------------------

	/** Body: returnUrl, cancelUrl (the site's own pages). Returns the PayPal page to send the buyer to. */
	public static function rest_subscribe( WP_REST_Request $request ) {
		$checked = self::checkout_product( $request, 'start' );
		if ( is_wp_error( $checked ) ) {
			return $checked;
		}
		list( $kind, $id, $product ) = $checked;
		if ( empty( $product['subscription'] ) ) {
			return new WP_Error( 'not_a_subscription', 'That isn\'t a subscription.', array( 'status' => 400 ) );
		}

		$return_url = esc_url_raw( (string) $request->get_param( 'returnUrl' ) );
		$cancel_url = esc_url_raw( (string) $request->get_param( 'cancelUrl' ) );
		if ( ! $return_url || ! $cancel_url ) {
			return new WP_Error( 'missing_urls', 'Missing return address.', array( 'status' => 400 ) );
		}

		$sub     = $product['subscription'];
		$plan_id = SC_Ads_PayPal::ensure_yearly_plan( $sub['key'], $sub['name'], $sub['price'] );
		if ( is_wp_error( $plan_id ) ) {
			return $plan_id;
		}

		$subscription = SC_Ads_PayPal::create_subscription( $plan_id, 'sub:' . $kind . ':' . $id, $return_url, $cancel_url );
		if ( is_wp_error( $subscription ) ) {
			return $subscription;
		}

		foreach ( (array) ( $subscription['links'] ?? array() ) as $link ) {
			if ( 'approve' === ( $link['rel'] ?? '' ) ) {
				return array(
					'subscriptionId' => $subscription['id'],
					'approveUrl'     => $link['href'],
				);
			}
		}
		return new WP_Error( 'no_approve_link', "PayPal didn't return a sign-up page.", array( 'status' => 502 ) );
	}

	/** Called from the page PayPal returns the buyer to. Body: subscriptionId. */
	public static function rest_confirm_subscription( WP_REST_Request $request ) {
		$checked = self::checkout_product( $request, 'finish' );
		if ( is_wp_error( $checked ) ) {
			return $checked;
		}
		list( $kind, $id, $product ) = $checked;

		$subscription_id = sanitize_text_field( (string) $request->get_param( 'subscriptionId' ) );
		$subscription    = $subscription_id ? SC_Ads_PayPal::get_subscription( $subscription_id ) : null;
		if ( ! $subscription || is_wp_error( $subscription ) ) {
			return is_wp_error( $subscription ) ? $subscription : new WP_Error( 'missing_subscription', 'No subscription to confirm.', array( 'status' => 400 ) );
		}
		if ( ( $subscription['custom_id'] ?? '' ) !== 'sub:' . $kind . ':' . $id ) {
			return new WP_Error( 'subscription_mismatch', "This subscription doesn't match.", array( 'status' => 400 ) );
		}
		if ( ! in_array( $subscription['status'] ?? '', array( 'ACTIVE', 'APPROVED' ), true ) ) {
			return new WP_Error( 'not_active', 'PayPal has not activated this subscription yet — please try again in a minute.', array( 'status' => 409 ) );
		}

		$payment = self::find_by( 'subscription_id', $subscription_id );
		$fresh   = ! $payment;
		if ( $fresh ) {
			$subscriber = $subscription['subscriber'] ?? array();
			$payment    = self::record(
				array(
					'kind'            => $kind,
					'object_id'       => $id,
					'amount'          => $product['subscription']['price'],
					'user_id'         => get_current_user_id(),
					'subscription_id' => $subscription_id,
					'payer_name'      => trim( ( $subscriber['name']['given_name'] ?? '' ) . ' ' . ( $subscriber['name']['surname'] ?? '' ) ),
					'payer_email'     => $subscriber['email_address'] ?? '',
					'note'            => 'Yearly subscription — PayPal renews it automatically.',
				)
			);
			update_post_meta( $payment, 'paid_until', self::next_billing_ts( $subscription, strtotime( '+1 year' ) ) );
			update_post_meta( $payment, 'sub_state', 'ACTIVE' );
		}

		$result = (array) call_user_func( $product['on_paid'], $id, $payment, array( 'subscription_id' => $subscription_id ) );
		if ( $fresh ) {
			self::notify_admin( $payment, 'New yearly subscription' );
		}
		return array_merge( array( 'status' => 'paid' ), $result );
	}

	private static function next_billing_ts( $subscription, $fallback ) {
		$next = $subscription['billing_info']['next_billing_time'] ?? '';
		$ts   = $next ? strtotime( $next ) : false;
		return $ts ? $ts : $fallback;
	}

	/**
	 * Daily: for each subscription still running, ask PayPal how it stands.
	 * A renewal (next billing date moved on) is recorded and emailed; a
	 * cancellation, suspension (failed payment) or expiry is emailed once;
	 * and GRACE_DAYS after the paid period ends without a renewal, the
	 * product's 'lapse' callback runs and the subscription is closed off.
	 */
	public static function check_subscriptions() {
		$rows = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => 'any',
				'posts_per_page' => 500,
				'fields'         => 'ids',
				'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery
					array(
						'key'   => 'sub_state',
						'value' => array( 'ACTIVE', 'CANCELLED', 'SUSPENDED', 'EXPIRED' ),
						'compare' => 'IN',
					),
				),
			)
		);

		foreach ( $rows as $row ) {
			$subscription_id = get_post_meta( $row, 'subscription_id', true );
			$kind            = get_post_meta( $row, 'kind', true );
			$object_id       = (int) get_post_meta( $row, 'object_id', true );
			$paid_until      = (int) get_post_meta( $row, 'paid_until', true );
			$product         = self::product( $kind );
			$subscription    = SC_Ads_PayPal::get_subscription( $subscription_id );
			if ( is_wp_error( $subscription ) ) {
				continue; // Try again tomorrow.
			}
			$status = $subscription['status'] ?? '';

			if ( 'ACTIVE' === $status ) {
				$next = self::next_billing_ts( $subscription, $paid_until );
				if ( $next > $paid_until + DAY_IN_SECONDS ) {
					$last    = $subscription['billing_info']['last_payment'] ?? array();
					$renewal = self::record(
						array(
							'kind'            => $kind,
							'object_id'       => $object_id,
							'amount'          => $last['amount']['value'] ?? ( $product['subscription']['price'] ?? 0 ),
							'user_id'         => (int) get_post_field( 'post_author', $row ),
							'subscription_id' => $subscription_id,
							'payer_email'     => get_post_meta( $row, 'payer_email', true ),
							'payer_name'      => get_post_meta( $row, 'payer_name', true ),
							'note'            => 'Automatic yearly renewal.',
							'renewal'         => true,
						)
					);
					update_post_meta( $row, 'paid_until', $next );
					self::notify_admin( $renewal, 'Yearly renewal paid' );
				}
				update_post_meta( $row, 'sub_state', 'ACTIVE' );
				continue;
			}

			if ( get_post_meta( $row, 'sub_state', true ) !== $status ) {
				update_post_meta( $row, 'sub_state', $status );
				$title = $product && isset( $product['title'] ) ? call_user_func( $product['title'], $object_id ) : '#' . $object_id;
				$ends  = wp_date( 'j F Y', $paid_until + self::GRACE_DAYS * DAY_IN_SECONDS );
				wp_mail(
					get_option( 'admin_email' ),
					'Subscription ' . strtolower( $status ) . ' — ' . $title,
					"PayPal reports the yearly subscription for {$title} is now {$status}" .
					( 'SUSPENDED' === $status ? ' (a renewal payment failed)' : '' ) .
					".\nIt stays live until {$ends} unless it's renewed, then it's unpublished automatically.\n\n" .
					'Payments: ' . admin_url( 'admin.php?page=sc-payments' )
				);
			}

			if ( time() > $paid_until + self::GRACE_DAYS * DAY_IN_SECONDS ) {
				update_post_meta( $row, 'sub_state', 'ended' );
				if ( $product && isset( $product['lapse'] ) ) {
					call_user_func( $product['lapse'], $object_id );
				}
				$title = $product && isset( $product['title'] ) ? call_user_func( $product['title'], $object_id ) : '#' . $object_id;
				wp_mail(
					get_option( 'admin_email' ),
					'Unpublished (subscription lapsed) — ' . $title,
					"The yearly subscription for {$title} wasn't renewed, so it has been unpublished (kept as a draft)."
				);
			}
		}
	}

	// ------------------------------------------------------------------
	// wp-admin: Payments
	// ------------------------------------------------------------------

	public static function register_menu() {
		add_menu_page( 'Payments', 'Payments', 'manage_options', 'sc-payments', array( __CLASS__, 'render' ), 'dashicons-money-alt', 26 );
	}

	public static function render() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		$notice = get_transient( 'sc_payments_notice_' . get_current_user_id() );
		if ( $notice ) {
			delete_transient( 'sc_payments_notice_' . get_current_user_id() );
		}
		$payments = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => 'any',
				'posts_per_page' => 200,
				'orderby'        => 'date',
				'order'          => 'DESC',
			)
		);
		$products = self::products();
		?>
		<div class="wrap">
			<h1>Payments</h1>
			<p class="description">Everything paid through the site, newest first. <strong>Refund</strong> gives the money back through PayPal (and stops a yearly subscription); <strong>Unpublish</strong> takes the item down without refunding. Both ask you to confirm.</p>
			<?php if ( $notice ) : ?>
				<div class="notice notice-info"><p><?php echo esc_html( $notice ); ?></p></div>
			<?php endif; ?>
			<table class="widefat striped">
				<thead><tr><th>Date</th><th>What</th><th>Amount</th><th>Paid by</th><th>Status</th><th></th></tr></thead>
				<tbody>
				<?php if ( ! $payments ) : ?>
					<tr><td colspan="6">No payments yet.</td></tr>
				<?php endif; ?>
				<?php
				foreach ( $payments as $p ) :
					$kind    = get_post_meta( $p->ID, 'kind', true );
					$object  = (int) get_post_meta( $p->ID, 'object_id', true );
					$product = $products[ $kind ] ?? null;
					$status  = get_post_meta( $p->ID, 'status', true );
					$sub     = get_post_meta( $p->ID, 'sub_state', true );
					$edit    = $product && isset( $product['edit_url'] ) ? call_user_func( $product['edit_url'], $object ) : '';
					?>
					<tr>
						<td><?php echo esc_html( get_the_date( 'j M Y, H:i', $p ) ); ?></td>
						<td>
							<?php echo $edit ? '<a href="' . esc_url( $edit ) . '">' . esc_html( $p->post_title ) . '</a>' : esc_html( $p->post_title ); ?>
							<?php if ( get_post_meta( $p->ID, 'renewal', true ) ) : ?>
								<br /><span class="description">Renewal</span>
							<?php elseif ( $sub ) : ?>
								<br /><span class="description">Yearly subscription: <?php echo esc_html( strtolower( $sub ) ); ?><?php echo get_post_meta( $p->ID, 'paid_until', true ) ? ', paid until ' . esc_html( wp_date( 'j M Y', (int) get_post_meta( $p->ID, 'paid_until', true ) ) ) : ''; ?></span>
							<?php endif; ?>
						</td>
						<td>£<?php echo esc_html( get_post_meta( $p->ID, 'amount', true ) ); ?><?php echo 'sandbox' === get_post_meta( $p->ID, 'mode', true ) ? ' <span class="description">(test)</span>' : ''; ?></td>
						<td><?php echo esc_html( trim( get_post_meta( $p->ID, 'payer_name', true ) . ' ' . get_post_meta( $p->ID, 'payer_email', true ) ) ); ?></td>
						<td><?php echo 'refunded' === $status ? '<strong>Refunded</strong>' : 'Paid'; ?></td>
						<td>
							<?php if ( 'refunded' !== $status ) : ?>
								<?php self::action_button( 'sc_payments_refund', $p->ID, 'Refund', 'Refund £' . get_post_meta( $p->ID, 'amount', true ) . ' through PayPal' . ( $sub ? ' and stop the yearly subscription' : '' ) . '?', true ); ?>
							<?php endif; ?>
							<?php if ( $product && isset( $product['undo'] ) && ! get_post_meta( $p->ID, 'undone', true ) ) : ?>
								<?php self::action_button( 'sc_payments_undo', $p->ID, 'Unpublish', 'Take this down now? The payment is not refunded.', false ); ?>
							<?php endif; ?>
						</td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	private static function action_button( $action, $payment_id, $label, $confirm, $with_undo_option ) {
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline-block;margin:0 4px 4px 0" onsubmit="return confirm(<?php echo esc_attr( wp_json_encode( $confirm ) ); ?>);">
			<?php wp_nonce_field( $action . '_' . $payment_id ); ?>
			<input type="hidden" name="action" value="<?php echo esc_attr( $action ); ?>" />
			<input type="hidden" name="payment_id" value="<?php echo (int) $payment_id; ?>" />
			<?php if ( $with_undo_option ) : ?>
				<label style="display:block;font-size:12px"><input type="checkbox" name="also_undo" value="1" checked /> also unpublish</label>
			<?php endif; ?>
			<button type="submit" class="button"><?php echo esc_html( $label ); ?></button>
		</form>
		<?php
	}

	private static function admin_request_payment( $action ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		$payment_id = (int) ( $_POST['payment_id'] ?? 0 );
		check_admin_referer( $action . '_' . $payment_id );
		if ( self::POST_TYPE !== get_post_type( $payment_id ) ) {
			wp_die( 'Unknown payment.' );
		}
		return $payment_id;
	}

	private static function back( $message ) {
		set_transient( 'sc_payments_notice_' . get_current_user_id(), $message, 60 );
		wp_safe_redirect( admin_url( 'admin.php?page=sc-payments' ) );
		exit;
	}

	public static function handle_refund() {
		$payment_id = self::admin_request_payment( 'sc_payments_refund' );
		$result     = self::refund( $payment_id );
		if ( is_wp_error( $result ) ) {
			self::back( 'Refund failed: ' . $result->get_error_message() );
		}
		$message = 'Refunded £' . get_post_meta( $payment_id, 'amount', true ) . '.';
		if ( ! empty( $_POST['also_undo'] ) ) {
			$message .= ' ' . self::undo( $payment_id );
		}
		self::back( $message );
	}

	public static function handle_undo() {
		$payment_id = self::admin_request_payment( 'sc_payments_undo' );
		self::back( self::undo( $payment_id ) );
	}

	/** Full refund through PayPal; a yearly subscription is cancelled too, so it doesn't renew. */
	public static function refund( $payment_id ) {
		$capture_id      = get_post_meta( $payment_id, 'capture_id', true );
		$subscription_id = get_post_meta( $payment_id, 'subscription_id', true );

		if ( ! $capture_id && $subscription_id ) {
			// Subscription payments: find the PayPal transaction around this payment's date.
			$at   = (int) get_post_time( 'U', true, $payment_id );
			$list = SC_Ads_PayPal::subscription_transactions( $subscription_id, $at - 2 * DAY_IN_SECONDS, min( time(), $at + 3 * DAY_IN_SECONDS ) );
			if ( is_wp_error( $list ) ) {
				return $list;
			}
			if ( ! $list ) {
				return new WP_Error( 'no_transaction', "PayPal hasn't recorded this payment yet — try again later, or refund it from PayPal directly." );
			}
			$capture_id = $list[0]['id'];
			update_post_meta( $payment_id, 'capture_id', $capture_id );
		}
		if ( ! $capture_id ) {
			return new WP_Error( 'no_capture', 'No PayPal transaction is stored for this payment — refund it from PayPal directly.' );
		}

		$result = SC_Ads_PayPal::refund_capture( $capture_id );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		update_post_meta( $payment_id, 'status', 'refunded' );

		if ( $subscription_id ) {
			SC_Ads_PayPal::cancel_subscription( $subscription_id, 'Refunded by Secret Carshalton' );
			$first = self::find_by( 'subscription_id', $subscription_id );
			if ( $first ) {
				update_post_meta( $first, 'sub_state', 'ended' );
			}
		}
		return true;
	}

	private static function undo( $payment_id ) {
		$product = self::product( get_post_meta( $payment_id, 'kind', true ) );
		if ( ! $product || ! isset( $product['undo'] ) ) {
			return 'Nothing to unpublish for this payment.';
		}
		$done = call_user_func( $product['undo'], (int) get_post_meta( $payment_id, 'object_id', true ) );
		update_post_meta( $payment_id, 'undone', '1' );
		return $done;
	}
}
