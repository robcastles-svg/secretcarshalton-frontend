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

		/*
		 * Reply emails: transition_comment_status covers a reply approved
		 * from the moderation queue; comment_post covers one approved the
		 * moment it's written (a reply posted from wp-admin, which skips
		 * moderation). maybe_notify_reply() only ever sends once per reply.
		 */
		add_action( 'transition_comment_status', array( __CLASS__, 'on_reply_status_transition' ), 10, 3 );
		add_action( 'comment_post', array( __CLASS__, 'on_reply_posted' ), 10, 2 );

		add_action( 'sc_events_rsvp', array( __CLASS__, 'on_event_rsvp' ), 10, 2 );
		add_action( 'sc_events_event_claimed', array( __CLASS__, 'on_event_claimed' ), 10, 2 );
		add_action( 'sc_events_event_submitted', array( __CLASS__, 'on_event_submitted' ), 10, 2 );

		add_action( 'sc_directory_listing_claimed', array( __CLASS__, 'on_listing_claimed' ), 10, 2 );
		add_action( 'sc_directory_listing_submitted', array( __CLASS__, 'on_listing_submitted' ), 10, 2 );
		add_action( 'sc_directory_upgrade_requested', array( __CLASS__, 'on_upgrade_requested' ), 10, 3 );
	}

	/** Must match the slugs SC_Directory_REST::request_upgrade accepts and SC_Directory_Hooks::on_upgrade_reviewed writes onto the listing. */
	const VALID_UPGRADE_TIERS = array( 'featured', 'featured_6mo', 'featured_plus', 'featured_gold' );

	public static function on_comment_status_transition( $new_status, $old_status, $comment ) {
		if ( 'approved' === $new_status && 'approved' !== $old_status && (int) $comment->user_id > 0 ) {
			sc_membership_award_points( (int) $comment->user_id, 2, 'Left a comment', 'comment' );
		}
	}

	public static function on_reply_status_transition( $new_status, $old_status, $comment ) {
		if ( 'approved' === $new_status && 'approved' !== $old_status ) {
			self::maybe_notify_reply( $comment );
		}
	}

	public static function on_reply_posted( $comment_id, $approved ) {
		if ( 1 === (int) $approved ) {
			self::maybe_notify_reply( get_comment( $comment_id ) );
		}
	}

	/**
	 * Emails a member when a reply to their comment goes public. Members
	 * only (the parent comment has a real user_id) — guest/legacy comments
	 * never opted in to anything — and never for replying to yourself.
	 * sc_reply_notified marks the reply so a later unapprove/re-approve
	 * doesn't send it twice.
	 */
	private static function maybe_notify_reply( $reply ) {
		if ( ! $reply || ! (int) $reply->comment_parent || get_comment_meta( $reply->comment_ID, 'sc_reply_notified', true ) ) {
			return;
		}

		$parent = get_comment( $reply->comment_parent );
		if ( ! $parent || ! (int) $parent->user_id || (int) $parent->user_id === (int) $reply->user_id ) {
			return;
		}

		$recipient = get_userdata( (int) $parent->user_id );
		$post      = get_post( $reply->comment_post_ID );
		if ( ! $recipient || ! $recipient->user_email || ! $post ) {
			return;
		}

		update_comment_meta( $reply->comment_ID, 'sc_reply_notified', 1 );

		$paths = array(
			'sc_event'   => '/events/',
			'sc_listing' => '/directory/',
		);
		$path  = isset( $paths[ $post->post_type ] ) ? $paths[ $post->post_type ] : '/';
		$link  = SC_Membership_Auth::FRONTEND_URL . $path . $post->post_name . '#comments';
		$title = wp_specialchars_decode( get_the_title( $post ), ENT_QUOTES );
		$who   = $reply->comment_author ? $reply->comment_author : 'Someone';
		$text  = wp_strip_all_tags( $reply->comment_content );

		wp_mail(
			$recipient->user_email,
			"{$who} replied to your comment on \"{$title}\"",
			"Hi {$recipient->display_name},\n\n{$who} replied to your comment on \"{$title}\":\n\n\"{$text}\"\n\nSee the conversation:\n{$link}\n\n— Secret Carshalton"
		);
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
	 * @param string   $tier       Which Featured package was requested — one
	 *                             of VALID_UPGRADE_TIERS. Carried onto the
	 *                             listing's own sc_featured_tier meta once
	 *                             approved, see SC_Directory_Hooks::on_upgrade_reviewed.
	 */
	public static function on_upgrade_requested( $user_id, $listing_id = null, $tier = '' ) {
		global $wpdb;
		$user_id = (int) $user_id;
		$tier    = in_array( $tier, self::VALID_UPGRADE_TIERS, true ) ? $tier : '';

		SC_Membership_DB::get_or_create_member( $user_id );

		$wpdb->update(
			SC_Membership_DB::members_table(),
			array(
				'directory_upgrade_status'       => 'pending',
				'directory_upgrade_tier'         => $tier ? $tier : null,
				'directory_upgrade_listing_id'   => $listing_id ? (int) $listing_id : null,
				'directory_upgrade_requested_at' => current_time( 'mysql' ),
				'updated_at'                      => current_time( 'mysql' ),
			),
			array( 'user_id' => $user_id ),
			array( '%s', '%s', '%d', '%s', '%s' ),
			array( '%d' )
		);
	}
}
