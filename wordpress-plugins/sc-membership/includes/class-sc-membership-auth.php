<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Bridges WordPress's own login (same wp_users table, same passwords, same
 * capabilities — no second auth system) to the Next.js frontend, which
 * runs on a different origin and can't use WP's cookie session directly.
 *
 * Issues a stateless bearer token (HS256, hand-rolled — no JWT library
 * dependency) on login/register. Any request carrying a valid token is
 * treated as logged-in via the 'determine_current_user' filter, the same
 * mechanism WP's own Application Passwords use — so every existing
 * is_user_logged_in() check across sc-membership/sc-directory/sc-events
 * just works with it, nothing else needed to change.
 *
 * Intended caller: a Next.js API route (server-to-server), not client-side
 * JS directly — keeps the token out of browser JS and avoids CORS entirely.
 */
class SC_Membership_Auth {

	const TOKEN_TTL = 30 * DAY_IN_SECONDS;

	public static function register_routes() {
		register_rest_route(
			'sc-membership/v1',
			'/login',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'login' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/register',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'register' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public static function init_bearer_auth() {
		add_filter( 'determine_current_user', array( __CLASS__, 'determine_current_user' ) );
	}

	public static function login( WP_REST_Request $request ) {
		$username = (string) $request->get_param( 'username' );
		$password = (string) $request->get_param( 'password' );

		$user = wp_authenticate( $username, $password );

		if ( is_wp_error( $user ) ) {
			return new WP_Error( 'invalid_credentials', 'Incorrect username or password.', array( 'status' => 401 ) );
		}

		return self::token_response( $user );
	}

	public static function register( WP_REST_Request $request ) {
		$username = sanitize_user( (string) $request->get_param( 'username' ) );
		$email    = sanitize_email( (string) $request->get_param( 'email' ) );
		$password = (string) $request->get_param( 'password' );

		if ( ! $username || ! $email || ! $password ) {
			return new WP_Error( 'missing_fields', 'Username, email and password are all required.', array( 'status' => 400 ) );
		}

		if ( username_exists( $username ) ) {
			return new WP_Error( 'username_taken', 'That username is already taken.', array( 'status' => 409 ) );
		}

		if ( email_exists( $email ) ) {
			return new WP_Error( 'email_taken', 'An account with that email already exists.', array( 'status' => 409 ) );
		}

		$user_id = wp_insert_user(
			array(
				'user_login' => $username,
				'user_email' => $email,
				'user_pass'  => $password,
				'role'       => 'subscriber',
			)
		);

		if ( is_wp_error( $user_id ) ) {
			return new WP_Error( 'registration_failed', $user_id->get_error_message(), array( 'status' => 400 ) );
		}

		// Creates the member row immediately so /me works right after registering.
		SC_Membership_DB::get_or_create_member( $user_id );

		$user = get_user_by( 'id', $user_id );
		return self::token_response( $user );
	}

	private static function token_response( WP_User $user ) {
		return array(
			'token'    => self::issue_token( $user->ID ),
			'user'     => array(
				'id'           => $user->ID,
				'display_name' => $user->display_name,
				'email'        => $user->user_email,
			),
			'expires_in' => self::TOKEN_TTL,
		);
	}

	public static function determine_current_user( $user_id ) {
		if ( $user_id ) {
			return $user_id;
		}

		$auth_header = isset( $_SERVER['HTTP_AUTHORIZATION'] ) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
		if ( ! $auth_header && function_exists( 'apache_request_headers' ) ) {
			$headers     = apache_request_headers();
			$auth_header = isset( $headers['Authorization'] ) ? $headers['Authorization'] : '';
		}

		if ( ! preg_match( '/^Bearer\s+(.+)$/i', trim( $auth_header ), $matches ) ) {
			return $user_id;
		}

		$verified_user_id = self::verify_token( $matches[1] );
		return $verified_user_id ? $verified_user_id : $user_id;
	}

	private static function secret() {
		$secret = get_option( 'sc_membership_jwt_secret' );
		if ( ! $secret ) {
			$secret = wp_generate_password( 64, true, true );
			update_option( 'sc_membership_jwt_secret', $secret );
		}
		return $secret;
	}

	private static function base64url_encode( $data ) {
		return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
	}

	private static function base64url_decode( $data ) {
		return base64_decode( strtr( $data, '-_', '+/' ) . str_repeat( '=', 3 - ( 3 + strlen( $data ) ) % 4 ) );
	}

	private static function issue_token( $user_id ) {
		$header  = self::base64url_encode( wp_json_encode( array( 'alg' => 'HS256', 'typ' => 'JWT' ) ) );
		$payload = self::base64url_encode(
			wp_json_encode(
				array(
					'sub' => $user_id,
					'iat' => time(),
					'exp' => time() + self::TOKEN_TTL,
				)
			)
		);
		$signature = self::base64url_encode( hash_hmac( 'sha256', "{$header}.{$payload}", self::secret(), true ) );
		return "{$header}.{$payload}.{$signature}";
	}

	private static function verify_token( $token ) {
		$parts = explode( '.', $token );
		if ( 3 !== count( $parts ) ) {
			return 0;
		}
		list( $header, $payload, $signature ) = $parts;

		$expected_signature = self::base64url_encode( hash_hmac( 'sha256', "{$header}.{$payload}", self::secret(), true ) );
		if ( ! hash_equals( $expected_signature, $signature ) ) {
			return 0;
		}

		$claims = json_decode( self::base64url_decode( $payload ), true );
		if ( ! is_array( $claims ) || empty( $claims['sub'] ) || empty( $claims['exp'] ) ) {
			return 0;
		}

		if ( time() > (int) $claims['exp'] ) {
			return 0;
		}

		return (int) $claims['sub'];
	}
}
