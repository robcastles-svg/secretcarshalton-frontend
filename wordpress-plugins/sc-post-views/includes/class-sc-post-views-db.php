<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SC_Post_Views_DB {

	/**
	 * Every view a post had before this plugin existed (imported from the
	 * live site's Post Views Counter plugin, see SC_Post_Views_Admin's
	 * backfill) is stored as one row on this sentinel date, per post —
	 * not a separate table. All-time totals (SUM across every row for a
	 * post) pick it up for free; "today"/"this week" windows naturally
	 * exclude it since they filter by real recent dates.
	 */
	const BASELINE_DATE = '1970-01-01';

	/**
	 * Events get a synthetic starting baseline (see EVENT_LISTING_BASELINE_VIEWS
	 * below) since they never had a third-party counter to backfill real
	 * history from, the way posts did (see SC_Post_Views_Admin). Listings
	 * are deliberately NOT in this list — Rob wants directory listings
	 * showing only real accumulated views, no synthetic floor, even if that
	 * means a new one reads "0 views" for a while. (sc_listing WAS in this
	 * list briefly; see remove_listing_baselines() below for the one-time
	 * cleanup that undid it.) Post type kept as a plain string rather than
	 * referencing SC_Events_CPT directly: this plugin has no load-order
	 * dependency on it (same reasoning as this file's own "arbitrary
	 * numeric key" docblock in sc-post-views.php).
	 */
	const EVENT_LISTING_POST_TYPES   = array( 'sc_event' );
	const EVENT_LISTING_BASELINE_VIEWS = 10;

	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'sc_post_views';
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table           = self::table();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			post_id BIGINT UNSIGNED NOT NULL,
			post_slug VARCHAR(200) NOT NULL DEFAULT '',
			post_title VARCHAR(255) NOT NULL DEFAULT '',
			view_date DATE NOT NULL,
			views INT UNSIGNED NOT NULL DEFAULT 0,
			PRIMARY KEY  (id),
			UNIQUE KEY post_date (post_id, view_date),
			KEY view_date (view_date)
		) {$charset_collate};";

		dbDelta( $sql );
	}

	/**
	 * +1 for today, creating the row if this is the post's first view
	 * today. post_slug/post_title are kept fresh on every call (cheap,
	 * and means a renamed/retitled post shows correctly in "top posts"
	 * without a separate sync step).
	 */
	public static function record_view( $post_id, $slug, $title ) {
		global $wpdb;
		$table = self::table();
		$today = current_time( 'Y-m-d' );

		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (post_id, post_slug, post_title, view_date, views) " . // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				'VALUES (%d, %s, %s, %s, 1) ' .
				'ON DUPLICATE KEY UPDATE views = views + 1, post_slug = VALUES(post_slug), post_title = VALUES(post_title)',
				$post_id,
				$slug,
				$title,
				$today
			)
		);
	}

	/**
	 * Gives one post (event or listing) its 10-view starting baseline, if it
	 * doesn't already have one — INSERT IGNORE against the (post_id,
	 * view_date) unique key makes this safe to call repeatedly (a one-time
	 * backfill for existing posts, plus a per-post call whenever a new one
	 * is published — see sc-post-views.php's transition_post_status hook)
	 * without ever double-counting.
	 */
	public static function ensure_event_listing_baseline( $post_id ) {
		global $wpdb;
		$table = self::table();

		$wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$table} (post_id, post_slug, post_title, view_date, views) " . // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				'VALUES (%d, %s, %s, %s, %d)',
				$post_id,
				'',
				'',
				self::BASELINE_DATE,
				self::EVENT_LISTING_BASELINE_VIEWS
			)
		);
	}

	/** One-time backfill: every existing post of a EVENT_LISTING_POST_TYPES type gets its baseline. */
	public static function seed_event_listing_baselines() {
		$ids = get_posts(
			array(
				'post_type'      => self::EVENT_LISTING_POST_TYPES,
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'fields'         => 'ids',
			)
		);
		foreach ( $ids as $post_id ) {
			self::ensure_event_listing_baseline( $post_id );
		}
	}

	/**
	 * One-time cleanup, run once via sc-post-views.php's plugins_loaded hook:
	 * undoes seed_event_listing_baselines() for sc_listing specifically, now
	 * that EVENT_LISTING_POST_TYPES no longer includes it — deletes the
	 * synthetic BASELINE_DATE row (if any) for every sc_listing post, so
	 * total_for() goes back to reporting only real recorded views for
	 * listings. Events are untouched.
	 */
	public static function remove_listing_baselines() {
		global $wpdb;
		$table = self::table();

		$ids = get_posts(
			array(
				'post_type'      => 'sc_listing',
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'fields'         => 'ids',
			)
		);
		if ( empty( $ids ) ) {
			return;
		}

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$table} WHERE view_date = %s AND post_id IN ({$placeholders})", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				array_merge( array( self::BASELINE_DATE ), $ids )
			)
		);
	}

	/** All-time total for one post — baseline row (if any) plus every day since. */
	public static function total_for( $post_id ) {
		global $wpdb;
		$table = self::table();

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COALESCE(SUM(views), 0) FROM {$table} WHERE post_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$post_id
			)
		);
	}

	/**
	 * Top posts by views within a rolling window — 'today' (just today's
	 * date) or 'week' (today plus the preceding 6 days, i.e. a rolling
	 * 7-day window rather than a calendar week, so it always shows a full
	 * week of data regardless of what day it is). The baseline row is
	 * always excluded here since it predates any real "today"/"this
	 * week" by definition.
	 *
	 * This table has no post_type or category of its own — it's just
	 * (post_id, views) — so a "Top stories" sidebar built straight from it
	 * could surface an Event or Directory listing (also tracked by this
	 * same plugin, see EVENT_LISTING_POST_TYPES) or a Spotlight/People
	 * article alongside real News/Stories/Walks content. $post_types and
	 * $category_slugs filter those out using WP's own post/taxonomy APIs
	 * rather than a hand-rolled taxonomy JOIN — overfetches candidates
	 * (5x the limit) when filtering, since some will get excluded.
	 */
	public static function top( $window, $limit, $post_types = null, $category_slugs = null ) {
		global $wpdb;
		$table = self::table();
		$limit = max( 1, (int) $limit );
		$filtering = $post_types || $category_slugs;
		$fetch_limit = $filtering ? max( $limit * 5, 50 ) : $limit;

		$since = 'today' === $window
			? current_time( 'Y-m-d' )
			: gmdate( 'Y-m-d', strtotime( current_time( 'Y-m-d' ) . ' -6 days' ) );

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT post_id, SUM(views) AS total_views, " . // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				'SUBSTRING_INDEX(GROUP_CONCAT(post_slug ORDER BY view_date DESC), \',\', 1) AS post_slug, ' .
				'SUBSTRING_INDEX(GROUP_CONCAT(post_title ORDER BY view_date DESC SEPARATOR \'||\'), \'||\', 1) AS post_title ' .
				"FROM {$table} " . // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				'WHERE view_date >= %s AND view_date <= %s ' .
				'GROUP BY post_id ' .
				'ORDER BY total_views DESC ' .
				'LIMIT %d',
				$since,
				current_time( 'Y-m-d' ),
				$fetch_limit
			)
		);

		if ( ! $filtering ) {
			return $rows;
		}

		$allowed_category_ids = $category_slugs ? self::resolve_category_ids_with_children( $category_slugs ) : null;

		$rows = array_values(
			array_filter(
				$rows,
				function ( $row ) use ( $post_types, $allowed_category_ids ) {
					$post_id = (int) $row->post_id;
					if ( $post_types && ! in_array( get_post_type( $post_id ), $post_types, true ) ) {
						return false;
					}
					if ( null !== $allowed_category_ids ) {
						$cats = wp_get_post_categories( $post_id );
						if ( ! array_intersect( $cats, $allowed_category_ids ) ) {
							return false;
						}
					}
					return true;
				}
			)
		);

		return array_slice( $rows, 0, $limit );
	}

	/** A category slug plus every child category's id — e.g. 'stories' resolves to the Stories parent and every area (Beddington, Carshalton Village, ...) under it. */
	private static function resolve_category_ids_with_children( $slugs ) {
		$ids = array();
		foreach ( $slugs as $slug ) {
			$term = get_category_by_slug( $slug );
			if ( ! $term ) {
				continue;
			}
			$ids[] = $term->term_id;
			$children = get_term_children( $term->term_id, 'category' );
			if ( ! is_wp_error( $children ) ) {
				$ids = array_merge( $ids, $children );
			}
		}
		return array_unique( $ids );
	}
}
