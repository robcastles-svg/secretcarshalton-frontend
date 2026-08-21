<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The two actions that aren't plain post editing: claiming an unclaimed
 * listing, and requesting a paid/featured upgrade. Reading and editing
 * listings already works through WordPress's own wp/v2/sc-listings
 * routes (registered automatically because the CPT has show_in_rest).
 */
class SC_Directory_REST {

	public static function register_routes() {
		register_rest_route(
			'sc-directory/v1',
			'/(?P<id>\d+)/claim',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'claim_listing' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-directory/v1',
			'/(?P<id>\d+)/request-upgrade',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'request_upgrade' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);
	}

	public static function claim_listing( WP_REST_Request $request ) {
		$listing_id = (int) $request->get_param( 'id' );
		$listing    = get_post( $listing_id );

		if ( ! $listing || SC_Directory_CPT::POST_TYPE !== $listing->post_type ) {
			return new WP_Error( 'not_found', 'Listing not found.', array( 'status' => 404 ) );
		}

		if ( 'true' === get_post_meta( $listing_id, 'sc_claimed', true ) || true === get_post_meta( $listing_id, 'sc_claimed', true ) ) {
			return new WP_Error( 'already_claimed', 'This listing is already claimed.', array( 'status' => 409 ) );
		}

		$user_id = get_current_user_id();

		update_post_meta( $listing_id, 'sc_claimed', true );
		wp_update_post(
			array(
				'ID'          => $listing_id,
				'post_author' => $user_id,
			)
		);

		/**
		 * sc-membership listens for this and awards claim points.
		 */
		do_action( 'sc_directory_listing_claimed', $user_id, $listing_id );

		return array( 'status' => 'claimed' );
	}

	public static function request_upgrade( WP_REST_Request $request ) {
		$listing_id = (int) $request->get_param( 'id' );
		$listing    = get_post( $listing_id );
		$user_id    = get_current_user_id();

		if ( ! $listing || SC_Directory_CPT::POST_TYPE !== $listing->post_type ) {
			return new WP_Error( 'not_found', 'Listing not found.', array( 'status' => 404 ) );
		}

		if ( (int) $listing->post_author !== $user_id && ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'not_owner', 'You can only request an upgrade for a listing you own.', array( 'status' => 403 ) );
		}

		/**
		 * Lands in the same approval queue sc-membership already exposes
		 * at Membership → Directory Upgrade Requests, with the listing
		 * attached so the reviewer knows which one it's for.
		 */
		do_action( 'sc_directory_upgrade_requested', $user_id, $listing_id );

		return array( 'status' => 'pending' );
	}
}
