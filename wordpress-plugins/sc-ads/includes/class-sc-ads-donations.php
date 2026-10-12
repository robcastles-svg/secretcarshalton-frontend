<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One-off donations from the frontend's /donate page, replacing the old
 * Elementor Pro form (switched off, so it no longer worked). Same PayPal
 * setup as ads, events and walk maps (SC_Ads_PayPal), with custom_id
 * "donation". No login needed. Each donation is on the Payments screen
 * and emailed to Rob. Monthly and annual donations stay as plain links to
 * PayPal's own subscription plans, so they don't come through here.
 */
class SC_Ads_Donations {

	/** The amounts offered, in pounds — must match ONE_OFF_AMOUNTS on the frontend's /donate page. */
	const AMOUNTS = array( 5, 10, 20, 30 );

	const ORDER_TRANSIENT = 'sc_donation_order_';

	public static function register_routes() {
		register_rest_route(
			'sc-ads/v1',
			'/donations/create-order',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'create_order' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'sc-ads/v1',
			'/donations/capture',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'capture' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public static function create_order( WP_REST_Request $request ) {
		$amount = (int) $request->get_param( 'amount' );
		if ( ! in_array( $amount, self::AMOUNTS, true ) ) {
			return new WP_Error( 'invalid_amount', 'Please choose an amount.', array( 'status' => 400 ) );
		}
		$order = SC_Ads_PayPal::create_order( 'donation', $amount, 'GBP', 'Donation to Secret Carshalton' );
		if ( is_wp_error( $order ) ) {
			return $order;
		}
		set_transient( self::ORDER_TRANSIENT . $order['id'], $amount, DAY_IN_SECONDS );
		return array(
			'orderId' => $order['id'],
			'amount'  => $amount,
		);
	}

	public static function capture( WP_REST_Request $request ) {
		$order_id = sanitize_text_field( (string) $request->get_param( 'orderId' ) );
		$amount   = (int) get_transient( self::ORDER_TRANSIENT . $order_id );
		if ( ! $order_id || ! $amount ) {
			return new WP_Error( 'order_mismatch', "This payment wasn't started here.", array( 'status' => 400 ) );
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

		$details = SC_Ads_Payments::capture_details( $capture );
		SC_Ads_Payments::record_once(
			array(
				'kind'        => 'donation',
				'object_id'   => 0,
				'amount'      => $details['amount'] ?? $amount,
				'order_id'    => $order_id,
				'capture_id'  => $details['capture_id'],
				'payer_name'  => $details['payer_name'],
				'payer_email' => $details['payer_email'],
			),
			'New donation'
		);

		return array( 'status' => 'paid' );
	}

	/** Labels donations on the Payments screen. */
	public static function payment_products( $products ) {
		$products['donation'] = array(
			'label' => 'Donation',
			'title' => function () {
				return 'one-off';
			},
		);
		return $products;
	}
}
