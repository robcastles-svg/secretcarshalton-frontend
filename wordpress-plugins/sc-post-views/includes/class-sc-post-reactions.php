<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Likes and share counts for articles (Rob, 2026-10): the 👍 / 💬 / ↗
 * row on every article card and at the top of each article.
 *
 * Keyed by the article's slug rather than an ID: articles still live on
 * the production WordPress while this runs on staging (the same split as
 * views and comments), and a slug is the one key that means the same
 * thing on both and survives the move to one site at go-live.
 *
 * - Anyone can like, logged in or not; one like per person per article,
 *   tapping again takes it back. A member is recognised by their account,
 *   a visitor by a random ID their browser keeps (sent as `visitor`).
 *   No made-up starting numbers: everything starts at 0.
 * - A share is counted each time someone opens the share button.
 * - Writes are capped per IP address per hour, so a script can't run the
 *   numbers up.
 */
class SC_Post_Reactions {

	const MAX_SLUGS        = 60;
	const WRITES_PER_HOUR  = 120;

	public static function totals_table() {
		global $wpdb;
		return $wpdb->prefix . 'sc_post_reactions';
	}

	public static function likes_table() {
		global $wpdb;
		return $wpdb->prefix . 'sc_post_likes';
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset_collate = $wpdb->get_charset_collate();
		$totals          = self::totals_table();
		$likes           = self::likes_table();

		dbDelta(
			"CREATE TABLE {$totals} (
				slug VARCHAR(200) NOT NULL,
				likes INT UNSIGNED NOT NULL DEFAULT 0,
				shares INT UNSIGNED NOT NULL DEFAULT 0,
				PRIMARY KEY  (slug)
			) {$charset_collate};"
		);
		dbDelta(
			"CREATE TABLE {$likes} (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				slug VARCHAR(200) NOT NULL,
				liker VARCHAR(80) NOT NULL,
				created_at DATETIME NOT NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY slug_liker (slug, liker)
			) {$charset_collate};"
		);
	}

	public static function register_routes() {
		register_rest_route(
			'sc-post-views/v1',
			'/reactions',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_reactions' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'sc-post-views/v1',
			'/reactions/like',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'like' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'sc-post-views/v1',
			'/reactions/share',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'share' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/* ------------------------------------------------------------------
	 * Helpers
	 * ---------------------------------------------------------------- */

	/** Who's liking: "u123" for a member, "v<id>" for a visitor's browser, '' if neither is usable. */
	private static function liker( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		if ( $user_id ) {
			return 'u' . $user_id;
		}
		$visitor = strtolower( (string) $request->get_param( 'visitor' ) );
		return preg_match( '/^[a-z0-9-]{16,64}$/', $visitor ) ? 'v' . $visitor : '';
	}

	private static function slug( WP_REST_Request $request ) {
		$slug = sanitize_title( (string) $request->get_param( 'slug' ) );
		return mb_strlen( $slug ) <= 200 ? $slug : '';
	}

	/** False once this IP has made WRITES_PER_HOUR likes/shares this hour. */
	private static function within_limit() {
		$ip  = isset( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ? trim( explode( ',', sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) )[0] ) : ( isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '' );
		$key = 'sc_react_' . md5( $ip . gmdate( 'YmdH' ) );
		$n   = (int) get_transient( $key );
		if ( $n >= self::WRITES_PER_HOUR ) {
			return false;
		}
		set_transient( $key, $n + 1, HOUR_IN_SECONDS );
		return true;
	}

	private static function totals( array $slugs ) {
		global $wpdb;
		$out = array();
		foreach ( $slugs as $slug ) {
			$out[ $slug ] = array( 'likes' => 0, 'shares' => 0, 'liked' => false );
		}
		if ( ! $slugs ) {
			return $out;
		}
		$table = self::totals_table();
		$in    = implode( ',', array_fill( 0, count( $slugs ), '%s' ) );
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT slug, likes, shares FROM {$table} WHERE slug IN ({$in})", $slugs ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		foreach ( (array) $rows as $row ) {
			$out[ $row->slug ]['likes']  = (int) $row->likes;
			$out[ $row->slug ]['shares'] = (int) $row->shares;
		}
		return $out;
	}

	/* ------------------------------------------------------------------
	 * Routes
	 * ---------------------------------------------------------------- */

	/** GET ?slugs=a,b,c[&visitor=…] → { slug: {likes, shares, liked} }. */
	public static function get_reactions( WP_REST_Request $request ) {
		$slugs = array_slice( array_values( array_unique( array_filter( array_map( 'sanitize_title', explode( ',', (string) $request->get_param( 'slugs' ) ) ) ) ) ), 0, self::MAX_SLUGS );
		$out   = self::totals( $slugs );

		$liker = self::liker( $request );
		if ( $liker && $slugs ) {
			global $wpdb;
			$table = self::likes_table();
			$in    = implode( ',', array_fill( 0, count( $slugs ), '%s' ) );
			$liked = $wpdb->get_col( $wpdb->prepare( "SELECT slug FROM {$table} WHERE liker = %s AND slug IN ({$in})", array_merge( array( $liker ), $slugs ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			foreach ( (array) $liked as $slug ) {
				$out[ $slug ]['liked'] = true;
			}
		}
		return $out;
	}

	/** POST {slug, visitor?, liked: bool} → {likes, liked}. */
	public static function like( WP_REST_Request $request ) {
		$slug  = self::slug( $request );
		$liker = self::liker( $request );
		if ( ! $slug || ! $liker ) {
			return new WP_Error( 'bad_request', 'Missing article or visitor.', array( 'status' => 400 ) );
		}
		if ( ! self::within_limit() ) {
			return new WP_Error( 'slow_down', 'Too many in a short time — try again later.', array( 'status' => 429 ) );
		}

		global $wpdb;
		$likes  = self::likes_table();
		$totals = self::totals_table();
		$want   = rest_sanitize_boolean( $request->get_param( 'liked' ) );

		if ( $want ) {
			$added = $wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$likes} (slug, liker, created_at) VALUES (%s, %s, %s)", $slug, $liker, current_time( 'mysql', true ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			if ( $added ) {
				$wpdb->query( $wpdb->prepare( "INSERT INTO {$totals} (slug, likes, shares) VALUES (%s, 1, 0) ON DUPLICATE KEY UPDATE likes = likes + 1", $slug ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			}
		} else {
			$removed = $wpdb->query( $wpdb->prepare( "DELETE FROM {$likes} WHERE slug = %s AND liker = %s", $slug, $liker ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			if ( $removed ) {
				$wpdb->query( $wpdb->prepare( "UPDATE {$totals} SET likes = GREATEST(likes, 1) - 1 WHERE slug = %s", $slug ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			}
		}

		$now = self::totals( array( $slug ) )[ $slug ];
		return array(
			'likes' => $now['likes'],
			'liked' => $want,
		);
	}

	/** POST {slug} → {shares}. Counted each time the share button is opened. */
	public static function share( WP_REST_Request $request ) {
		$slug = self::slug( $request );
		if ( ! $slug ) {
			return new WP_Error( 'bad_request', 'Missing article.', array( 'status' => 400 ) );
		}
		if ( ! self::within_limit() ) {
			return new WP_Error( 'slow_down', 'Too many in a short time — try again later.', array( 'status' => 429 ) );
		}
		global $wpdb;
		$totals = self::totals_table();
		$wpdb->query( $wpdb->prepare( "INSERT INTO {$totals} (slug, likes, shares) VALUES (%s, 0, 1) ON DUPLICATE KEY UPDATE shares = shares + 1", $slug ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		return array( 'shares' => self::totals( array( $slug ) )[ $slug ]['shares'] );
	}
}
