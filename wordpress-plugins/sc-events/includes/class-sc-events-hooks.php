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
