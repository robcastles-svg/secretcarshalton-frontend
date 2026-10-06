<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Thin wrapper over PayPal's Orders v2 API (one-off, dynamic-amount
 * payments — right for a text ad's "N days × £/day" total, unlike the
 * Subscriptions API which is for fixed recurring billing). Everything
 * here is server-to-server; the credentials this calls through
 * (SC_Ads_PayPal_Settings::active_credentials()) never reach the browser.
 */
class SC_Ads_PayPal {

	const TOKEN_TRANSIENT = 'sc_ads_paypal_token';

	/** OAuth2 client-credentials bearer token, cached for its own lifetime (usually ~9h) minus a safety margin so it's never used right as it expires. */
	public static function get_access_token() {
		$cached = get_transient( self::TOKEN_TRANSIENT );
		if ( $cached ) {
			return $cached;
		}

		$creds = SC_Ads_PayPal_Settings::active_credentials();
		if ( ! $creds['client_id'] || ! $creds['secret'] ) {
			return new WP_Error( 'sc_ads_paypal_not_configured', 'PayPal is not configured (missing Client ID/Secret for the current mode).' );
		}

		$res = wp_remote_post(
			$creds['api_base'] . '/v1/oauth2/token',
			array(
				'timeout' => 20,
				'headers' => array(
					'Authorization' => 'Basic ' . base64_encode( $creds['client_id'] . ':' . $creds['secret'] ),
					'Content-Type'  => 'application/x-www-form-urlencoded',
				),
				'body'    => array( 'grant_type' => 'client_credentials' ),
			)
		);

		if ( is_wp_error( $res ) ) {
			return $res;
		}

		$status   = wp_remote_retrieve_response_code( $res );
		$raw_body = wp_remote_retrieve_body( $res );
		$body     = json_decode( $raw_body, true );

		if ( empty( $body['access_token'] ) ) {
			// Surface PayPal's own error (invalid_client, etc.) and the HTTP
			// status in the message itself — the generic message alone gave
			// no way to tell "wrong credentials" from "PayPal unreachable"
			// from "SiteGround can't reach PayPal" apart.
			$detail = '';
			if ( is_array( $body ) && ! empty( $body['error_description'] ) ) {
				$detail = ' — ' . $body['error_description'];
			} elseif ( is_array( $body ) && ! empty( $body['error'] ) ) {
				$detail = ' — ' . $body['error'];
			} elseif ( $raw_body ) {
				$detail = ' — raw response: ' . substr( $raw_body, 0, 300 );
			}
			return new WP_Error( 'sc_ads_paypal_auth_failed', 'PayPal did not return an access token (HTTP ' . (int) $status . ')' . $detail, $body );
		}

		$ttl = isset( $body['expires_in'] ) ? max( 60, (int) $body['expires_in'] - 120 ) : 3300;
		set_transient( self::TOKEN_TRANSIENT, $body['access_token'], $ttl );

		return $body['access_token'];
	}

	private static function request( $method, $path, $access_token, $payload = null, $extra_headers = array() ) {
		$creds   = SC_Ads_PayPal_Settings::active_credentials();
		$headers = array_merge(
			array(
				'Authorization' => 'Bearer ' . $access_token,
				'Content-Type'  => 'application/json',
			),
			$extra_headers
		);

		$args = array(
			'method'  => $method,
			'timeout' => 20,
			'headers' => $headers,
		);
		if ( null !== $payload ) {
			$args['body'] = wp_json_encode( $payload );
		}

		$res = wp_remote_request( $creds['api_base'] . $path, $args );
		if ( is_wp_error( $res ) ) {
			return $res;
		}

		$status = wp_remote_retrieve_response_code( $res );
		$body   = json_decode( wp_remote_retrieve_body( $res ), true );

		if ( $status < 200 || $status >= 300 ) {
			// A WP_Error's 'status' (if present in its data) is what the REST
			// server actually uses for the HTTP response code — without it,
			// any PayPal failure comes back to our own client as a bare 500,
			// indistinguishable from a real server bug. 409 for PayPal's own
			// 4xx (the order isn't in a state we can act on — e.g. a capture
			// attempted before the buyer's approved it, which normally can't
			// happen since onApprove only fires after approval, but could if
			// a client retries stale state) vs 502 for a genuine PayPal-side
			// failure.
			$issue = $body['details'][0]['issue'] ?? null;
			if ( 'ORDER_NOT_APPROVED' === $issue ) {
				return new WP_Error( 'sc_ads_paypal_not_approved', 'This payment has not been approved yet — please complete the PayPal popup first.', array_merge( (array) $body, array( 'status' => 409 ) ) );
			}
			return new WP_Error( 'sc_ads_paypal_api_error', 'PayPal API returned ' . $status . '.', array_merge( (array) $body, array( 'status' => $status < 500 ? 409 : 502 ) ) );
		}

		return $body;
	}

	/**
	 * Creates a PayPal order for one ad's total (days × placement's
	 * price/day, from lib/pricing.ts's TEXT_AD_TIERS — kept in sync by
	 * hand in PLACEMENT_PRICES below since this plugin has no access to
	 * the frontend's TS source). $ad_id is stashed in custom_id so the
	 * capture step and the webhook can both tie the order back to a post
	 * without trusting anything the client sends at capture time.
	 */
	public static function create_order( $ad_id, $amount, $currency = 'GBP' ) {
		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		return self::request(
			'POST',
			'/v2/checkout/orders',
			$token,
			array(
				'intent'         => 'CAPTURE',
				'purchase_units' => array(
					array(
						'custom_id'   => (string) $ad_id,
						'description' => 'Secret Carshalton text ad #' . $ad_id,
						'amount'      => array(
							'currency_code' => $currency,
							'value'         => number_format( (float) $amount, 2, '.', '' ),
						),
					),
				),
			)
		);
	}

	public static function capture_order( $order_id ) {
		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		return self::request( 'POST', '/v2/checkout/orders/' . rawurlencode( $order_id ) . '/capture', $token );
	}

	public static function get_order( $order_id ) {
		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		return self::request( 'GET', '/v2/checkout/orders/' . rawurlencode( $order_id ), $token );
	}

	/**
	 * Creates the webhook subscription against whichever mode is active
	 * right now, and stores its ID — called once by hand from wp-admin
	 * (see SC_Ads_PayPal_Settings) after the target URL is reachable,
	 * not on every request. Re-running it with a mode already subscribed
	 * just returns PayPal's existing webhook for that URL/app rather than
	 * erroring.
	 */
	public static function ensure_webhook( $callback_url ) {
		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$result = self::request(
			'POST',
			'/v1/notifications/webhooks',
			$token,
			array(
				'url'         => $callback_url,
				'event_types' => array(
					array( 'name' => 'PAYMENT.CAPTURE.COMPLETED' ),
					array( 'name' => 'CHECKOUT.ORDER.APPROVED' ),
				),
			)
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( ! empty( $result['id'] ) ) {
			update_option( 'sc_ads_paypal_webhook_id', $result['id'] );
		}

		return $result;
	}

	/**
	 * Delegates signature verification to PayPal's own endpoint rather
	 * than reimplementing its certificate-chain/crypto checks by hand —
	 * takes the raw webhook headers + body PayPal just sent us and asks
	 * PayPal "was this really you". $headers must be the same request's
	 * headers (case-insensitive lookup handled by the caller).
	 */
	public static function verify_webhook_signature( $headers, $raw_body ) {
		$webhook_id = get_option( 'sc_ads_paypal_webhook_id' );
		if ( ! $webhook_id ) {
			return new WP_Error( 'sc_ads_paypal_no_webhook_id', 'No webhook ID stored — run "Set up webhook" in PayPal Settings first.' );
		}

		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$event = json_decode( $raw_body, true );
		if ( ! is_array( $event ) ) {
			return new WP_Error( 'sc_ads_paypal_bad_payload', 'Webhook body was not valid JSON.' );
		}

		$result = self::request(
			'POST',
			'/v1/notifications/verify-webhook-signature',
			$token,
			array(
				'auth_algo'         => $headers['paypal_auth_algo'] ?? '',
				'cert_url'          => $headers['paypal_cert_url'] ?? '',
				'transmission_id'   => $headers['paypal_transmission_id'] ?? '',
				'transmission_sig'  => $headers['paypal_transmission_sig'] ?? '',
				'transmission_time' => $headers['paypal_transmission_time'] ?? '',
				'webhook_id'        => $webhook_id,
				'webhook_event'     => $event,
			)
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return isset( $result['verification_status'] ) && 'SUCCESS' === $result['verification_status'];
	}
}
