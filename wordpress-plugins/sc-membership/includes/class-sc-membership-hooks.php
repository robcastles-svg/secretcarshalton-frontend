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
		// Native WordPress: an approved comment earns a small amount of points.
		add_action( 'comment_approved_', array( __CLASS__, 'on_comment_approved' ), 10, 1 );
		add_action( 'wp_set_comment_status', array( __CLASS__, 'on_comment_status_change' ), 10, 2 );

		// sc-events (not built yet) will fire this when a member RSVPs to an event.
		add_action( 'sc_events_rsvp', array( __CLASS__, 'on_event_rsvp' ), 10, 2 );
		add_action( 'sc_events_event_claimed', array( __CLASS__, 'on_event_claimed' ), 10, 2 );

		// sc-directory (not built yet) will fire these. Registering the listeners
		// now means the approval queue works the moment that plugin exists —
		// nothing changes on this side when it ships.
		add_action( 'sc_directory_listing_claimed', array( __CLASS__, 'on_listing_claimed' ), 10, 2 );
		add_action( 'sc_directory_upgrade_requested', array( __CLASS__, 'on_upgrade_requested' ), 10, 2 );
	}

	public static function on_comment_approved( $comment_id ) {
		$comment = get_comment( $comment_id );
		if ( $comment && (int) $comment->user_id > 0 ) {
			sc_membership_award_points( (int) $comment->user_id, 2, 'Left a comment', 'comment' );
		}
	}

	public static function on_comment_status_change( $comment_id, $status ) {
		if ( 'approve' === $status ) {
			self::on_comment_approved( $comment_id );
		}
	}

	public static function on_event_rsvp( $user_id, $event_id ) {
		sc_membership_award_points( (int) $user_id, 5, 'RSVP\'d to an event', 'event_rsvp' );
	}

	public static function on_event_claimed( $user_id, $event_id ) {
		sc_membership_award_points( (int) $user_id, 10, 'Claimed an event listing', 'event_claim' );
	}

	public static function on_listing_claimed( $user_id, $listing_id ) {
		sc_membership_award_points( (int) $user_id, 15, 'Claimed a directory listing', 'directory_claim' );
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
