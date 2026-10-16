<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * "Continue with Google" for the Next.js frontend (0.29). The browser gets
 * a Google ID token from Google's own sign-in button; the frontend's API
 * route passes it here, and this asks Google whether it's genuine
 * (tokeninfo) and meant for our Client ID before trusting a word of it.
 *
 * Who it signs in, in order:
 *   1. The account already linked to this Google account (sc_google_sub —
 *      Google's permanent ID, so changing their Gmail address later
 *      doesn't lose the account; the site email is never changed for them).
 *   2. The account with the same email address — Google has proved they
 *      own it — which gets linked and counts as email-confirmed.
 *   3. Nobody: a new member. They choose their public username first
 *      (Rob, Oct 2026: never publish someone's real Google name without
 *      asking), so this returns a short-lived signup token and a suggested
 *      username, and /google/complete creates the account.
 *
 * Bans apply exactly as for password logins.
 */
class SC_Membership_Google {

	/** Set from wp-admin or the REST settings endpoint (it's public — it's in every page's sign-in button). */
	const CLIENT_ID_OPTION = 'sc_membership_google_client_id';
	const SUB_META         = 'sc_google_sub';
	const SIGNUP_TTL       = 30 * MINUTE_IN_SECONDS;

	public static function register_settings() {
		register_setting(
			'general',
			self::CLIENT_ID_OPTION,
			array(
				'type'              => 'string',
				'description'       => 'Google OAuth Client ID for "Continue with Google" on the frontend.',
				'sanitize_callback' => 'sanitize_text_field',
				'show_in_rest'      => true,
				'default'           => '',
			)
		);
	}

	public static function register_routes() {
		register_rest_route(
			'sc-membership/v1',
			'/google',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'sign_in' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/google/complete',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'complete' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public static function sign_in( WP_REST_Request $request ) {
		$claims = self::verify( (string) $request->get_param( 'credential' ) );
		if ( is_wp_error( $claims ) ) {
			return $claims;
		}

		$user = self::user_for( $claims['sub'], $claims['email'] );
		if ( $user ) {
			if ( SC_Membership_REST::is_banned( $user->ID ) ) {
				return new WP_Error( 'account_banned', 'This account has been suspended.', array( 'status' => 403 ) );
			}
			update_user_meta( $user->ID, self::SUB_META, $claims['sub'] );
			update_user_meta( $user->ID, 'sc_email_verified', '1' );
			return SC_Membership_Auth::token_response( $user );
		}

		$signup_token = wp_generate_password( 40, false );
		set_transient(
			'sc_google_signup_' . $signup_token,
			array(
				'sub'   => $claims['sub'],
				'email' => $claims['email'],
			),
			self::SIGNUP_TTL
		);

		return array(
			'needs_username' => true,
			'signup_token'   => $signup_token,
			'suggestion'     => self::suggest_username( $claims ),
			'email'          => $claims['email'],
		);
	}

	public static function complete( WP_REST_Request $request ) {
		$key    = 'sc_google_signup_' . preg_replace( '/[^A-Za-z0-9]/', '', (string) $request->get_param( 'signup_token' ) );
		$signup = get_transient( $key );
		if ( ! is_array( $signup ) ) {
			return new WP_Error( 'signup_expired', 'That took a little too long — please press "Continue with Google" again.', array( 'status' => 400 ) );
		}

		// Signed up in another tab meanwhile: just sign them in.
		$existing = self::user_for( $signup['sub'], $signup['email'] );
		if ( $existing ) {
			delete_transient( $key );
			update_user_meta( $existing->ID, self::SUB_META, $signup['sub'] );
			return SC_Membership_Auth::token_response( $existing );
		}

		$username = sanitize_user( trim( (string) $request->get_param( 'username' ) ) );
		$problem  = SC_Membership_Auth::username_problem( $username );
		if ( $problem ) {
			return $problem;
		}

		$user_id = wp_insert_user(
			array(
				'user_login'   => $username,
				'user_email'   => $signup['email'],
				// They sign in with Google; "Forgot password" sets one if they ever want it.
				'user_pass'    => wp_generate_password( 32, true, true ),
				'display_name' => $username,
				'role'         => 'subscriber',
			)
		);
		if ( is_wp_error( $user_id ) ) {
			return new WP_Error( 'registration_failed', $user_id->get_error_message(), array( 'status' => 400 ) );
		}
		delete_transient( $key );

		update_user_meta( $user_id, self::SUB_META, $signup['sub'] );
		update_user_meta( $user_id, 'sc_email_verified', '1' );
		SC_Membership_DB::get_or_create_member( $user_id );
		if ( SC_Membership_DB::username_looks_like_url( $username, $username ) ) {
			SC_Membership_DB::flag_pending_review( $user_id, 'url_username' );
		}

		$response            = SC_Membership_Auth::token_response( get_user_by( 'id', $user_id ) );
		$response['created'] = true;
		return $response;
	}

	/**
	 * Asks Google whether the ID token is genuine, unexpired and issued for
	 * our Client ID, with a confirmed email address. Returns its claims.
	 */
	private static function verify( $credential ) {
		$client_id = trim( (string) get_option( self::CLIENT_ID_OPTION, '' ) );
		if ( '' === $client_id ) {
			return new WP_Error( 'google_not_configured', 'Google sign-in isn\'t set up yet.', array( 'status' => 503 ) );
		}
		if ( '' === $credential ) {
			return new WP_Error( 'missing_credential', 'No Google sign-in was received.', array( 'status' => 400 ) );
		}

		$res = wp_remote_get(
			'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode( $credential ),
			array( 'timeout' => 10 )
		);
		if ( is_wp_error( $res ) ) {
			return new WP_Error( 'google_unreachable', 'Couldn\'t reach Google — please try again.', array( 'status' => 502 ) );
		}
		$claims = json_decode( wp_remote_retrieve_body( $res ), true );

		$valid = 200 === wp_remote_retrieve_response_code( $res )
			&& is_array( $claims )
			&& ( $claims['aud'] ?? '' ) === $client_id
			&& in_array( $claims['iss'] ?? '', array( 'accounts.google.com', 'https://accounts.google.com' ), true )
			&& (int) ( $claims['exp'] ?? 0 ) > time()
			&& ! empty( $claims['sub'] );
		if ( ! $valid ) {
			return new WP_Error( 'google_invalid', 'Google sign-in didn\'t work — please try again.', array( 'status' => 401 ) );
		}
		if ( 'true' !== (string) ( $claims['email_verified'] ?? '' ) || ! is_email( $claims['email'] ?? '' ) ) {
			return new WP_Error( 'google_email_unverified', 'Your Google account\'s email address isn\'t confirmed with Google, so it can\'t be used here.', array( 'status' => 403 ) );
		}

		return array(
			'sub'         => (string) $claims['sub'],
			'email'       => sanitize_email( $claims['email'] ),
			'given_name'  => (string) ( $claims['given_name'] ?? '' ),
			'family_name' => (string) ( $claims['family_name'] ?? '' ),
		);
	}

	private static function user_for( $sub, $email ) {
		$linked = get_users(
			array(
				'meta_key'   => self::SUB_META, // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_value' => $sub, // phpcs:ignore WordPress.DB.SlowDBQuery
				'number'     => 1,
			)
		);
		if ( $linked ) {
			return $linked[0];
		}
		$by_email = get_user_by( 'email', $email );
		return $by_email ? $by_email : null;
	}

	/** "robc", "robc2", … from their first name and surname initial — never their full name. */
	private static function suggest_username( $claims ) {
		$base = sanitize_user( strtolower( remove_accents( $claims['given_name'] . substr( $claims['family_name'], 0, 1 ) ) ), true );
		$base = preg_replace( '/[^a-z0-9]/', '', $base );
		if ( strlen( $base ) < 3 ) {
			$base = 'member';
		}
		$candidate = $base;
		for ( $i = 2; username_exists( $candidate ) && $i < 1000; $i++ ) {
			$candidate = $base . $i;
		}
		return $candidate;
	}
}
