<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SC_Membership_DB {

	public static function members_table() {
		global $wpdb;
		return $wpdb->prefix . 'sc_members';
	}

	public static function points_log_table() {
		global $wpdb;
		return $wpdb->prefix . 'sc_member_points_log';
	}

	/**
	 * Creates the two tables this plugin owns. Uses dbDelta so it's safe
	 * to call again on every plugin update (activation hook re-runs it).
	 */
	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate = $wpdb->get_charset_collate();
		$members_table   = self::members_table();
		$log_table       = self::points_log_table();

		$sql_members = "CREATE TABLE {$members_table} (
			user_id BIGINT UNSIGNED NOT NULL,
			points INT NOT NULL DEFAULT 0,
			tier VARCHAR(40) NOT NULL DEFAULT 'newcomer',
			directory_upgrade_status VARCHAR(20) DEFAULT NULL,
			directory_upgrade_requested_at DATETIME DEFAULT NULL,
			directory_upgrade_reviewed_by BIGINT UNSIGNED DEFAULT NULL,
			joined_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (user_id),
			KEY tier (tier),
			KEY directory_upgrade_status (directory_upgrade_status)
		) {$charset_collate};";

		$sql_log = "CREATE TABLE {$log_table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			points_delta INT NOT NULL,
			reason VARCHAR(191) NOT NULL,
			source VARCHAR(50) NOT NULL DEFAULT 'manual',
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY user_id (user_id),
			KEY source (source)
		) {$charset_collate};";

		dbDelta( $sql_members );
		dbDelta( $sql_log );
	}

	/**
	 * Fetches a member row, creating one (at the base tier) if this is
	 * the first time we've seen this user_id — every logged-in WP user
	 * is implicitly a member from the moment they interact with anything
	 * that awards points.
	 */
	public static function get_or_create_member( $user_id ) {
		global $wpdb;
		$table = self::members_table();

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE user_id = %d", $user_id ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		if ( $row ) {
			return $row;
		}

		$now = current_time( 'mysql' );
		$wpdb->insert(
			$table,
			array(
				'user_id'    => $user_id,
				'points'     => 0,
				'tier'       => SC_Membership_Tiers::base_tier_slug(),
				'joined_at'  => $now,
				'updated_at' => $now,
			),
			array( '%d', '%d', '%s', '%s', '%s' )
		);

		return $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE user_id = %d", $user_id ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);
	}
}
