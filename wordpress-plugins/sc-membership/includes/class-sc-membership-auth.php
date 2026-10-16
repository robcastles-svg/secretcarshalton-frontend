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

	/**
	 * The public site, for avatar URLs and email links (verification and
	 * so on). The live domain since go-live (16 Oct 2026); before that it
	 * was the Vercel production alias, and before that a branch-preview
	 * alias, which went stale and broke every default avatar.
	 */
	const FRONTEND_URL = 'https://www.secretcarshalton.com';

	/**
	 * Member actions that publish something, which need a confirmed email
	 * address (Rob, Oct 2026 — cuts spam sign-ups). POST only; editing or
	 * deleting what they've already posted is unaffected.
	 */
	const POSTING_ROUTES = array(
		'/sc-membership/v1/comments',
		'/sc-membership/v1/community-submit',
		'/sc-events/v1/submit',
		'/sc-directory/v1/submit',
		'/sc-jobs/v1/submit',
		'/sc-ads/v1/submit',
	);

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

		register_rest_route(
			'sc-membership/v1',
			'/verify-email',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'verify_email' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/me/display-name',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'update_display_name' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/resend-verification',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'resend_verification' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);
	}

	public static function init_bearer_auth() {
		add_filter( 'determine_current_user', array( __CLASS__, 'determine_current_user' ) );
		add_filter( 'rest_request_before_callbacks', array( __CLASS__, 'require_confirmed_email' ), 10, 3 );
	}

	/**
	 * One check for every POSTING_ROUTES route across the sc-* plugins
	 * (their own permission checks only ask "logged in?"), so turning this
	 * on needed no change to the other plugins. Accounts from before email
	 * confirmation existed count as confirmed (is_verified), and Google
	 * sign-ins are confirmed by Google.
	 */
	public static function require_confirmed_email( $response, $handler, WP_REST_Request $request ) {
		if ( 'POST' !== $request->get_method() || ! in_array( untrailingslashit( $request->get_route() ), self::POSTING_ROUTES, true ) ) {
			return $response;
		}
		$user_id = get_current_user_id();
		if ( ! $user_id || self::is_verified( $user_id ) || current_user_can( 'manage_options' ) ) {
			return $response;
		}
		return new WP_Error(
			'email_not_verified',
			'Please confirm your email address first — click the link we emailed you when you joined. Can\'t find it? Check your spam folder, or send a new link from your dashboard.',
			array( 'status' => 403 )
		);
	}

	/**
	 * Why a username can't be used, or null if it can — shared by the
	 * password sign-up and the Google one.
	 */
	public static function username_problem( $username ) {
		if ( strlen( $username ) < 3 || strlen( $username ) > 30 ) {
			return new WP_Error( 'username_invalid', 'Usernames need to be 3 to 30 characters.', array( 'status' => 400 ) );
		}
		if ( username_exists( $username ) ) {
			return new WP_Error( 'username_taken', 'That username is already taken.', array( 'status' => 409 ) );
		}
		return null;
	}

	/**
	 * The member's public name (comments, their profile, the members list).
	 * Their username — and so their profile address — stays the same.
	 */
	public static function update_display_name( WP_REST_Request $request ) {
		$name = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( (string) $request->get_param( 'display_name' ) ) ) );
		if ( mb_strlen( $name ) < 2 || mb_strlen( $name ) > 40 ) {
			return new WP_Error( 'display_name_invalid', 'Your name needs to be 2 to 40 characters.', array( 'status' => 400 ) );
		}
		if ( SC_Membership_DB::username_looks_like_url( $name, $name ) || preg_match( '/https?:|www\.|\.(com|co\.uk|net|org|info)\b/i', $name ) ) {
			return new WP_Error( 'display_name_invalid', 'Your name can\'t be a web address.', array( 'status' => 400 ) );
		}
		if ( preg_match( '/secret\s*carshalton|\badmin\b|moderator/i', $name ) && ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'display_name_invalid', 'Please choose a name that doesn\'t look like the site\'s own.', array( 'status' => 400 ) );
		}

		$user_id = get_current_user_id();
		global $wpdb;
		$taken = (int) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$wpdb->users} WHERE LOWER(display_name) = LOWER(%s) AND ID != %d LIMIT 1", $name, $user_id ) );
		if ( $taken ) {
			return new WP_Error( 'display_name_taken', 'Another member already uses that name — try adding an initial.', array( 'status' => 409 ) );
		}

		$result = wp_update_user( array( 'ID' => $user_id, 'display_name' => $name ) );
		if ( is_wp_error( $result ) ) {
			return new WP_Error( 'display_name_failed', $result->get_error_message(), array( 'status' => 400 ) );
		}
		return array( 'display_name' => $name );
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

		$problem = self::username_problem( $username );
		if ( $problem ) {
			return $problem;
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

		/**
		 * A URL-as-username is the single most common shape of spam
		 * registration this site sees. Flagging it here (rather than
		 * refusing the signup outright) hides them from the public
		 * /members list immediately while still letting a real person
		 * with an unlucky username reach Rob via the pending-review queue
		 * (SC_Membership_Admin::render_pending_members_queue) instead of
		 * just being silently rejected.
		 */
		if ( SC_Membership_DB::username_looks_like_url( $username, $username ) ) {
			SC_Membership_DB::flag_pending_review( $user_id, 'url_username' );
		}

		self::send_verification_email( $user_id );

		$user = get_user_by( 'id', $user_id );
		return self::token_response( $user );
	}

	/**
	 * Verification is soft, not a login gate: a new member lands on their
	 * dashboard immediately (better first-run experience), and the
	 * dashboard shows a "please verify" banner until they click the link.
	 * Nothing currently checks this to block access — it's a nudge, not
	 * a wall.
	 */
	private static function send_verification_email( $user_id ) {
		$user  = get_user_by( 'id', $user_id );
		if ( ! $user ) {
			return;
		}

		$token = wp_generate_password( 32, false );
		update_user_meta( $user_id, 'sc_email_verify_token', $token );
		// Explicit string, not a raw PHP boolean — storing `false` round-trips
		// as an empty string, indistinguishable from the meta never having
		// been set at all (bit us twice already this session with postmeta
		// booleans). '0' here is unambiguous against "never tracked".
		update_user_meta( $user_id, 'sc_email_verified', '0' );

		$link = self::FRONTEND_URL . '/verify-email?token=' . rawurlencode( $token );

		wp_mail(
			$user->user_email,
			'Confirm your Secret Carshalton account',
			"Hi {$user->display_name},\n\nPlease confirm your email address to finish setting up your Secret Carshalton membership:\n\n{$link}\n\nIf you didn't create this account, you can ignore this email."
		);
	}

	public static function verify_email( WP_REST_Request $request ) {
		$token = (string) $request->get_param( 'token' );
		if ( ! $token ) {
			return new WP_Error( 'missing_token', 'No verification token provided.', array( 'status' => 400 ) );
		}

		$users = get_users(
			array(
				'meta_key'   => 'sc_email_verify_token', // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_value' => $token, // phpcs:ignore WordPress.DB.SlowDBQuery
				'number'     => 1,
			)
		);

		if ( empty( $users ) ) {
			return new WP_Error( 'invalid_token', 'This verification link is invalid or has already been used.', array( 'status' => 400 ) );
		}

		$user_id = $users[0]->ID;
		update_user_meta( $user_id, 'sc_email_verified', '1' );
		delete_user_meta( $user_id, 'sc_email_verify_token' );

		return array( 'status' => 'verified' );
	}

	public static function resend_verification( WP_REST_Request $request ) {
		$user_id = get_current_user_id();

		if ( self::is_verified( $user_id ) ) {
			return array( 'status' => 'already_verified' );
		}

		self::send_verification_email( $user_id );
		return array( 'status' => 'sent' );
	}

	/**
	 * Meta never set (empty string on readback) means this account predates
	 * email verification entirely — treat those as verified rather than
	 * retroactively nagging every existing account (including the WP admin
	 * account this was tested with).
	 */
	public static function is_verified( $user_id ) {
		$meta = get_user_meta( $user_id, 'sc_email_verified', true );
		return '' === $meta || '1' === $meta;
	}

	/**
	 * Powers the dashboard's "Hello" vs "Welcome back" greeting — every
	 * session-issuing event (register or login) counts as a visit, so a
	 * brand new member sees "Hello" the first time they land on the
	 * dashboard (count reaches 1 here, whether that came from registering
	 * or logging in) and "Welcome back" on every one after.
	 */
	private static function record_visit( $user_id ) {
		$count = (int) get_user_meta( $user_id, 'sc_member_login_count', true );
		update_user_meta( $user_id, 'sc_member_login_count', $count + 1 );
	}

	public static function token_response( WP_User $user ) {
		self::record_visit( $user->ID );

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
