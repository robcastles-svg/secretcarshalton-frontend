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
			directory_upgrade_listing_id BIGINT UNSIGNED DEFAULT NULL,
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

	/**
	 * Spam registrations on this site tend to use a URL as the username —
	 * checked against both user_login and display_name since a bot can
	 * set either. Lives here (not in the REST or Admin classes) because
	 * both SC_Membership_Auth::register() (flag on signup) and
	 * SC_Membership_Admin (the manual re-scan button) need it, and this
	 * is the one class both already depend on.
	 */
	public static function username_looks_like_url( $user_login, $display_name = '' ) {
		foreach ( array( $user_login, $display_name ) as $value ) {
			$value = strtolower( trim( (string) $value ) );
			if ( '' === $value ) {
				continue;
			}
			// A scheme or www. prefix is unambiguous. A bare "contains a
			// TLD" check was tried and dropped — chrisperr54@hotmail.com is
			// a completely normal WP username (login = own email address,
			// a common registration pattern on this site), and it matched
			// "\.com" just as readily as an actual spam URL would, hiding
			// dozens of real members. A scheme/www prefix has no such
			// false-positive path against a plain email address.
			if ( preg_match( '#^(https?://|www\.)#i', $value ) ) {
				return true;
			}
		}
		return false;
	}

	/** True once an admin has explicitly restored a flagged account — stops the re-scan button from flagging it again. */
	public static function is_reviewed( $user_id ) {
		return '1' === get_user_meta( $user_id, 'sc_member_reviewed', true );
	}

	public static function is_pending_review( $user_id ) {
		return '1' === get_user_meta( $user_id, 'sc_member_pending_review', true );
	}

	public static function flag_pending_review( $user_id, $reason ) {
		update_user_meta( $user_id, 'sc_member_pending_review', '1' );
		update_user_meta( $user_id, 'sc_member_pending_reason', $reason );
	}
}
