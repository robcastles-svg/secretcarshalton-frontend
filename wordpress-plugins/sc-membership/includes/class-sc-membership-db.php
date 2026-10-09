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

	public static function bookmarks_table() {
		global $wpdb;
		return $wpdb->prefix . 'sc_bookmarks';
	}

	public static function comment_votes_table() {
		global $wpdb;
		return $wpdb->prefix . 'sc_comment_votes';
	}

	/**
	 * Creates the tables this plugin owns. Uses dbDelta so it's safe
	 * to call again on every plugin update (activation hook re-runs it).
	 */
	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate     = $wpdb->get_charset_collate();
		$members_table       = self::members_table();
		$log_table           = self::points_log_table();
		$bookmarks_table     = self::bookmarks_table();
		$comment_votes_table = self::comment_votes_table();

		$sql_members = "CREATE TABLE {$members_table} (
			user_id BIGINT UNSIGNED NOT NULL,
			points INT NOT NULL DEFAULT 0,
			tier VARCHAR(40) NOT NULL DEFAULT 'newcomer',
			directory_upgrade_status VARCHAR(20) DEFAULT NULL,
			directory_upgrade_tier VARCHAR(40) DEFAULT NULL,
			directory_upgrade_listing_id BIGINT UNSIGNED DEFAULT NULL,
			directory_upgrade_requested_at DATETIME DEFAULT NULL,
			directory_upgrade_reviewed_by BIGINT UNSIGNED DEFAULT NULL,
			directory_upgrade_amount_paid VARCHAR(20) DEFAULT NULL,
			directory_upgrade_payment_status VARCHAR(20) DEFAULT NULL,
			directory_upgrade_expires_at DATETIME DEFAULT NULL,
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

		$sql_bookmarks = "CREATE TABLE {$bookmarks_table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			content_type VARCHAR(20) NOT NULL,
			content_id BIGINT UNSIGNED NOT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY user_content (user_id, content_type, content_id),
			KEY content (content_type, content_id)
		) {$charset_collate};";

		$sql_comment_votes = "CREATE TABLE {$comment_votes_table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			comment_id BIGINT UNSIGNED NOT NULL,
			value TINYINT NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY user_comment (user_id, comment_id),
			KEY comment_id (comment_id)
		) {$charset_collate};";

		dbDelta( $sql_members );
		dbDelta( $sql_log );
		dbDelta( $sql_bookmarks );
		dbDelta( $sql_comment_votes );
	}

	/** Total bookmark count for one piece of content — a public aggregate, same "no privacy concern" bar as this site's post view counts. */
	public static function bookmark_count( $content_type, $content_id ) {
		global $wpdb;
		$table = self::bookmarks_table();
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE content_type = %s AND content_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$content_type,
				$content_id
			)
		);
	}

	public static function is_bookmarked( $user_id, $content_type, $content_id ) {
		global $wpdb;
		$table = self::bookmarks_table();
		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT 1 FROM {$table} WHERE user_id = %d AND content_type = %s AND content_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$user_id,
				$content_type,
				$content_id
			)
		);
	}

	/** All of one member's bookmarks, newest first — powers the dashboard's "Bookmarks" list. */
	public static function bookmarks_for_user( $user_id ) {
		global $wpdb;
		$table = self::bookmarks_table();
		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT content_type, content_id, created_at FROM {$table} WHERE user_id = %d ORDER BY created_at DESC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$user_id
			)
		);
	}

	/** Adds or removes the bookmark and returns the new state (true = now bookmarked). */
	public static function toggle_bookmark( $user_id, $content_type, $content_id ) {
		global $wpdb;
		$table = self::bookmarks_table();

		if ( self::is_bookmarked( $user_id, $content_type, $content_id ) ) {
			$wpdb->delete(
				$table,
				array( 'user_id' => $user_id, 'content_type' => $content_type, 'content_id' => $content_id ),
				array( '%d', '%s', '%d' )
			);
			return false;
		}

		$wpdb->insert(
			$table,
			array(
				'user_id'      => $user_id,
				'content_type' => $content_type,
				'content_id'   => $content_id,
				'created_at'   => current_time( 'mysql' ),
			),
			array( '%d', '%s', '%d', '%s' )
		);
		return true;
	}

	/**
	 * Upvote (value 1) or downvote (value -1) count for one comment — a
	 * public aggregate, same "no privacy concern" bar as
	 * bookmark_count/post view counts. Rows from before downvotes existed
	 * got value 1 from the column default, so they stay upvotes.
	 */
	public static function comment_vote_count( $comment_id, $value = 1 ) {
		global $wpdb;
		$table = self::comment_votes_table();
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE comment_id = %d AND value = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$comment_id,
				$value
			)
		);
	}

	public static function has_voted_comment( $user_id, $comment_id ) {
		global $wpdb;
		$table = self::comment_votes_table();
		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT 1 FROM {$table} WHERE user_id = %d AND comment_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$user_id,
				$comment_id
			)
		);
	}

	/**
	 * Which of a given batch of comment ids this user has already voted on
	 * — powers the frontend's initial "already upvoted" state for a whole
	 * thread in one query, rather than one has_voted_comment() call per
	 * comment. $comment_ids is assumed already sanitised to ints by the
	 * caller (see SC_Membership_REST::get_my_comment_votes).
	 */
	public static function voted_comment_ids( $user_id, $comment_ids, $value = 1 ) {
		global $wpdb;
		if ( empty( $comment_ids ) ) {
			return array();
		}
		$table        = self::comment_votes_table();
		$placeholders = implode( ', ', array_fill( 0, count( $comment_ids ), '%d' ) );
		$query        = $wpdb->prepare(
			"SELECT comment_id FROM {$table} WHERE user_id = %d AND value = %d AND comment_id IN ({$placeholders})", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			array_merge( array( $user_id, $value ), $comment_ids )
		);
		return array_map( 'intval', $wpdb->get_col( $query ) );
	}

	/**
	 * One vote per member per comment, up (1) or down (-1). Voting the
	 * same way again removes the vote; voting the other way switches it.
	 * Returns the member's vote afterwards: 1, -1 or 0 (none).
	 */
	public static function toggle_comment_vote( $user_id, $comment_id, $value = 1 ) {
		global $wpdb;
		$table = self::comment_votes_table();
		$value = -1 === (int) $value ? -1 : 1;

		$current = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT value FROM {$table} WHERE user_id = %d AND comment_id = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$user_id,
				$comment_id
			)
		);

		if ( null !== $current && (int) $current === $value ) {
			$wpdb->delete(
				$table,
				array( 'user_id' => $user_id, 'comment_id' => $comment_id ),
				array( '%d', '%d' )
			);
			return 0;
		}

		if ( null !== $current ) {
			$wpdb->update(
				$table,
				array( 'value' => $value ),
				array( 'user_id' => $user_id, 'comment_id' => $comment_id ),
				array( '%d' ),
				array( '%d', '%d' )
			);
			return $value;
		}

		$wpdb->insert(
			$table,
			array(
				'user_id'    => $user_id,
				'comment_id' => $comment_id,
				'value'      => $value,
				'created_at' => current_time( 'mysql' ),
			),
			array( '%d', '%d', '%d', '%s' )
		);
		return $value;
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
