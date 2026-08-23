<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reacts to sc-membership's approval decision by actually changing the
 * listing's plan/featured state. sc-membership doesn't know what a
 * "plan" or "featured" is — it only tracks who's waiting on approval —
 * so the plugin that owns those fields is the one that acts on the result.
 */
class SC_Directory_Hooks {

	public static function init() {
		add_action( 'sc_membership_upgrade_reviewed', array( __CLASS__, 'on_upgrade_reviewed' ), 10, 3 );
		add_action( 'sc_directory_listing_claim_requested', array( __CLASS__, 'on_claim_requested' ), 10, 2 );
	}

	/**
	 * Claim requests now sit in a review queue rather than taking effect
	 * immediately (see SC_Directory_REST::claim_listing) — an admin who
	 * isn't actively watching wp-admin would otherwise never know one is
	 * waiting, so this sends a heads-up the moment one comes in, with a
	 * direct link to the review screen.
	 */
	public static function on_claim_requested( $user_id, $listing_id ) {
		$listing = get_post( $listing_id );
		$user    = get_userdata( $user_id );
		if ( ! $listing || ! $user ) {
			return;
		}

		$review_url = admin_url( 'edit.php?post_type=' . SC_Directory_CPT::POST_TYPE . '&page=sc-directory-claims' );

		wp_mail(
			get_option( 'admin_email' ),
			'New directory listing claim — ' . $listing->post_title,
			"{$user->display_name} ({$user->user_email}) wants to claim the listing \"{$listing->post_title}\".\n\nReview it here:\n{$review_url}"
		);
	}

	public static function on_upgrade_reviewed( $user_id, $decision, $listing_id ) {
		if ( ! $listing_id ) {
			return;
		}

		$listing = get_post( $listing_id );
		if ( ! $listing || SC_Directory_CPT::POST_TYPE !== $listing->post_type ) {
			return;
		}

		if ( 'approved' === $decision ) {
			update_post_meta( $listing_id, 'sc_plan', 'paid' );
			update_post_meta( $listing_id, 'sc_featured', true );
		}
		// Rejected: leave the listing as-is — no downgrade, since it likely
		// wasn't upgraded yet in the first place. Nothing to undo.
	}
}
