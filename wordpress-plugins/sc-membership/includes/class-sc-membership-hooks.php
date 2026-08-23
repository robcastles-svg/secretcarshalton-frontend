<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires up the points system to the rest of the site. This is the one
 * file that should need editing when a new plugin wants to award points —
 * everything else in sc-membership is generic.
 */
class SC_Membership_Hooks {

	public static function init() {
		/**
		 * Not comment_approved_ (a dynamic hook keyed by comment_type) —
		 * that only fires for comments with an empty comment_type, but
		 * SC_Membership_REST::submit_comment explicitly inserts comments
		 * with comment_type => 'comment' (WordPress core's own default
		 * since 5.5), so the real fired hook is comment_approved_comment
		 * and the empty-type listener never matched a single one of this
		 * site's actual member comments — confirmed against real data:
		 * members who'd definitely commented were showing 0 points.
		 * transition_comment_status fires for every status change
		 * regardless of comment_type, and covers both an auto-approved
		 * comment (approved at insert) and one an admin approves later
		 * from the moderation queue, which comment_approved_'s partner
		 * wp_set_comment_status hook only ever caught the second case of.
		 */
		add_action( 'transition_comment_status', array( __CLASS__, 'on_comment_status_transition' ), 10, 3 );

		add_action( 'sc_events_rsvp', array( __CLASS__, 'on_event_rsvp' ), 10, 2 );
		add_action( 'sc_events_event_claimed', array( __CLASS__, 'on_event_claimed' ), 10, 2 );
		add_action( 'sc_events_event_submitted', array( __CLASS__, 'on_event_submitted' ), 10, 2 );

		add_action( 'sc_directory_listing_claimed', array( __CLASS__, 'on_listing_claimed' ), 10, 2 );
		add_action( 'sc_directory_listing_submitted', array( __CLASS__, 'on_listing_submitted' ), 10, 2 );
		add_action( 'sc_directory_upgrade_requested', array( __CLASS__, 'on_upgrade_requested' ), 10, 2 );
	}

	public static function on_comment_status_transition( $new_status, $old_status, $comment ) {
		if ( 'approved' === $new_status && 'approved' !== $old_status && (int) $comment->user_id > 0 ) {
			sc_membership_award_points( (int) $comment->user_id, 2, 'Left a comment', 'comment' );
		}
	}

	public static function on_event_rsvp( $user_id, $event_id ) {
		sc_membership_award_points( (int) $user_id, 5, 'Marked interested in an event', 'event_rsvp' );
	}

	public static function on_event_claimed( $user_id, $event_id ) {
		sc_membership_award_points( (int) $user_id, 10, 'Claimed an event listing', 'event_claim' );
	}

	public static function on_event_submitted( $user_id, $event_id ) {
		sc_membership_award_points( (int) $user_id, 5, 'Submitted an event', 'event_submit' );
	}

	public static function on_listing_claimed( $user_id, $listing_id ) {
		sc_membership_award_points( (int) $user_id, 15, 'Claimed a directory listing', 'directory_claim' );
	}

	public static function on_listing_submitted( $user_id, $listing_id ) {
		sc_membership_award_points( (int) $user_id, 5, 'Submitted a directory listing', 'directory_submit' );
	}

	/**
	 * Marks a member's upgrade request as pending, for the admin approval
	 * queue. Doesn't award points — approval is a manual, paid-tier decision,
	 * not something earned by engagement.
	 *
	 * @param int      $user_id
	 * @param int|null $listing_id Which listing the upgrade is for, when the
	 *                             request came from sc-directory. Null for a
	 *                             general membership-level request.
	 */
	public static function on_upgrade_requested( $user_id, $listing_id = null ) {
		global $wpdb;
		$user_id = (int) $user_id;

		SC_Membership_DB::get_or_create_member( $user_id );

		$wpdb->update(
			SC_Membership_DB::members_table(),
			array(
				'directory_upgrade_status'       => 'pending',
				'directory_upgrade_listing_id'   => $listing_id ? (int) $listing_id : null,
				'directory_upgrade_requested_at' => current_time( 'mysql' ),
				'updated_at'                      => current_time( 'mysql' ),
			),
			array( 'user_id' => $user_id ),
			array( '%s', '%d', '%s', '%s' ),
			array( '%d' )
		);
	}
}
