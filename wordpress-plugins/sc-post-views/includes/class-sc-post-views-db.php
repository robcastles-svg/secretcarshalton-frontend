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
	 */
	public static function top( $window, $limit ) {
		global $wpdb;
		$table = self::table();
		$limit = max( 1, (int) $limit );

		$since = 'today' === $window
			? current_time( 'Y-m-d' )
			: gmdate( 'Y-m-d', strtotime( current_time( 'Y-m-d' ) . ' -6 days' ) );

		return $wpdb->get_results(
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
				$limit
			)
		);
	}
}
