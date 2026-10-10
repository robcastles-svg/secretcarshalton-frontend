<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Mirrors SC_Directory_Hooks::on_claim_requested exactly — a review queue
 * nobody's watching might as well not exist, so this sends a heads-up the
 * moment a claim request comes in, with a direct link to approve/reject it.
 */
class SC_Events_Hooks {

	public static function init() {
		add_action( 'sc_events_event_claim_requested', array( __CLASS__, 'on_claim_requested' ), 10, 2 );
		add_action( 'sc_events_event_submitted', array( __CLASS__, 'on_event_submitted' ), 10, 2 );
	}

	/**
	 * Submitted events go live straight away (see
	 * SC_Events_REST::submit_event), so this email is the safety net: Rob
	 * hears about every new event the moment it's up, with a one-click
	 * link to edit or bin it. The edit URL is built by hand because
	 * get_edit_post_link() returns null for the submitting member, who
	 * can't edit posts in wp-admin.
	 */
	public static function on_event_submitted( $user_id, $event_id ) {
		$event = get_post( $event_id );
		$user  = get_userdata( $user_id );
		if ( ! $event || ! $user ) {
			return;
		}

		$start    = get_post_meta( $event_id, 'sc_start', true );
		$venue    = get_post_meta( $event_id, 'sc_venue_name', true );
		$edit_url = admin_url( 'post.php?post=' . $event_id . '&action=edit' );

		wp_mail(
			get_option( 'admin_email' ),
			'New event live — ' . $event->post_title,
			"{$user->display_name} ({$user->user_email}) has just added an event. It's live now.\n\n" .
			"Event: {$event->post_title}\n" .
			( $start ? "When: {$start}\n" : '' ) .
			( $venue ? "Where: {$venue}\n" : '' ) .
			"Slug: {$event->post_name}\n\n" .
			"If it's not suitable, edit it or move it to the bin here:\n{$edit_url}"
		);
	}

	public static function on_claim_requested( $user_id, $event_id ) {
		$event = get_post( $event_id );
		$user  = get_userdata( $user_id );
		if ( ! $event || ! $user ) {
			return;
		}

		$review_url = admin_url( 'edit.php?post_type=' . SC_Events_CPT::POST_TYPE . '&page=sc-events-claims' );

		wp_mail(
			get_option( 'admin_email' ),
			'New event claim — ' . $event->post_title,
			"{$user->display_name} ({$user->user_email}) wants to claim the event \"{$event->post_title}\".\n\nReview it here:\n{$review_url}"
		);
	}
}
