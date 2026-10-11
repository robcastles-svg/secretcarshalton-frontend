<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * £1.50 walk-map downloads, replacing the WP Express Checkout button
 * those walks used to embed (its JS only runs on the WordPress theme, so
 * on the Next.js site the button was dead markup).
 *
 * The products themselves stay where Rob already manages them — WP
 * Express Checkout's own "ppec-products" (price and download file) — so
 * a new map is still just a new product plus its shortcode in the post.
 * Only the payment moves: it goes through sc-ads' PayPal setup (same
 * credentials and sandbox/live switch as text ads and featured events),
 * with custom_id "map-{product id}". No login needed to buy.
 *
 * Delivery matches the old plugin: once paid, the buyer gets a download
 * button straight away. Rob gets an email per sale.
 */
class SC_Ads_Map_Sales {

	/** WP Express Checkout's product post type and the meta it stores price/file in. */
	const PRODUCT_TYPE = 'ppec-products';
	const PRICE_META   = 'ppec_product_price';
	const FILE_META    = 'ppec_product_upload';

	const CUSTOM_ID_PREFIX = 'map-';

	/** Order → product it was created for, so a capture can't be pointed at a different (dearer or cheaper) map. */
	const ORDER_TRANSIENT = 'sc_map_order_';
	/** Set once a sale's email has gone, so a retried capture doesn't email Rob twice. */
	const NOTIFIED_TRANSIENT = 'sc_map_sold_';

	public static function register_routes() {
		register_rest_route(
			'sc-ads/v1',
			'/maps/(?P<id>\d+)/create-order',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'create_order' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'sc-ads/v1',
			'/maps/(?P<id>\d+)/capture',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'capture' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/** The product's name, price and file, or a WP_Error if it isn't a map that can be sold. */
	private static function product( $product_id ) {
		$post = get_post( $product_id );
		if ( ! $post || self::PRODUCT_TYPE !== $post->post_type || 'publish' !== $post->post_status ) {
			return new WP_Error( 'no_such_map', "This map isn't available.", array( 'status' => 404 ) );
		}
		$price = (float) get_post_meta( $product_id, self::PRICE_META, true );
		$file  = trim( (string) get_post_meta( $product_id, self::FILE_META, true ) );
		if ( $price <= 0 || '' === $file ) {
			return new WP_Error( 'map_not_set_up', "This map isn't available to buy right now.", array( 'status' => 503 ) );
		}
		return array(
			'name'  => $post->post_title,
			'price' => $price,
			'file'  => $file,
		);
	}

	public static function create_order( WP_REST_Request $request ) {
		$product_id = (int) $request->get_param( 'id' );
		$product    = self::product( $product_id );
		if ( is_wp_error( $product ) ) {
			return $product;
		}

		$order = SC_Ads_PayPal::create_order(
			self::CUSTOM_ID_PREFIX . $product_id,
			$product['price'],
			'GBP',
			'Secret Carshalton walk map: ' . $product['name']
		);
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		set_transient( self::ORDER_TRANSIENT . $order['id'], $product_id, DAY_IN_SECONDS );
		return array(
			'orderId' => $order['id'],
			'amount'  => $product['price'],
		);
	}

	public static function capture( WP_REST_Request $request ) {
		$product_id = (int) $request->get_param( 'id' );
		$order_id   = sanitize_text_field( (string) $request->get_param( 'orderId' ) );

		if ( ! $order_id || (int) get_transient( self::ORDER_TRANSIENT . $order_id ) !== $product_id ) {
			return new WP_Error( 'order_mismatch', "This payment doesn't match the map.", array( 'status' => 400 ) );
		}
		$product = self::product( $product_id );
		if ( is_wp_error( $product ) ) {
			return $product;
		}

		$capture = SC_Ads_PayPal::capture_order( $order_id );
		if ( is_wp_error( $capture ) ) {
			// Already captured (a retried request after a dropped
			// connection) — fine as long as PayPal says it's paid.
			$capture = SC_Ads_PayPal::get_order( $order_id );
			if ( is_wp_error( $capture ) ) {
				return $capture;
			}
		}
		if ( 'COMPLETED' !== ( $capture['status'] ?? '' ) ) {
			return new WP_Error( 'not_completed', 'PayPal has not completed this payment yet.', array( 'status' => 409 ) );
		}

		self::notify( $order_id, $product, $capture );

		return array(
			'status'      => 'paid',
			'name'        => $product['name'],
			'downloadUrl' => $product['file'],
		);
	}

	/** One email to Rob per sale. */
	private static function notify( $order_id, $product, $capture ) {
		if ( get_transient( self::NOTIFIED_TRANSIENT . $order_id ) ) {
			return;
		}
		set_transient( self::NOTIFIED_TRANSIENT . $order_id, 1, WEEK_IN_SECONDS );

		$payer = $capture['payer'] ?? array();
		$name  = trim( ( $payer['name']['given_name'] ?? '' ) . ' ' . ( $payer['name']['surname'] ?? '' ) );
		$email = $payer['email_address'] ?? '';
		$value = $capture['purchase_units'][0]['payments']['captures'][0]['amount']['value'] ?? $product['price'];

		wp_mail(
			get_option( 'admin_email' ),
			'Walk map sold — ' . $product['name'],
			( $name ? $name : 'Someone' ) . ( $email ? " ({$email})" : '' ) . ' bought the ' . $product['name'] .
			' map for £' . number_format( (float) $value, 2 ) . ".\n\nPayPal order: " . $order_id
		);
	}
}
