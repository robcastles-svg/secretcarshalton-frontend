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
