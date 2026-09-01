<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SC_Membership_Points {

	/**
	 * Awards (or deducts, with a negative $points) points to a member,
	 * logs the transaction, and recalculates + persists their tier.
	 * Fires `sc_membership_tier_changed` if the tier actually moved.
	 */
	public static function award( $user_id, $points, $reason, $source = 'manual' ) {
		global $wpdb;

		$user_id = (int) $user_id;
		$points  = (int) $points;

		if ( ! $user_id || ! $points || ! get_userdata( $user_id ) ) {
			return false;
		}

		$member   = SC_Membership_DB::get_or_create_member( $user_id );
		$old_tier = $member->tier;

		$new_total = max( 0, (int) $member->points + $points );
		$new_tier  = SC_Membership_Tiers::tier_for_points( $new_total );
		$now       = current_time( 'mysql' );

		$wpdb->update(
			SC_Membership_DB::members_table(),
			array(
				'points'     => $new_total,
				'tier'       => $new_tier,
				'updated_at' => $now,
			),
			array( 'user_id' => $user_id ),
			array( '%d', '%s', '%s' ),
			array( '%d' )
		);

		$wpdb->insert(
			SC_Membership_DB::points_log_table(),
			array(
				'user_id'      => $user_id,
				'points_delta' => $points,
				'reason'       => sanitize_text_field( $reason ),
				'source'       => sanitize_key( $source ),
				'created_at'   => $now,
			),
			array( '%d', '%d', '%s', '%s', '%s' )
		);

		if ( $new_tier !== $old_tier ) {
			/**
			 * Fires when a member's points cross a tier threshold.
			 * Other plugins (directory badges, email notifications) hook in here.
			 */
			do_action( 'sc_membership_tier_changed', $user_id, $old_tier, $new_tier );
		}

		return true;
	}

	/**
	 * Recent points-log entries for a member, newest first — powers the
	 * "how did I earn these points" list on the member dashboard.
	 */
	public static function recent_activity( $user_id, $limit = 10 ) {
		global $wpdb;
		$table = SC_Membership_DB::points_log_table();

		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT points_delta, reason, source, created_at FROM {$table} WHERE user_id = %d ORDER BY created_at DESC LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$user_id,
				$limit
			)
		);
	}
}
