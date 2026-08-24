<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reading (and, for an admin's Bearer token, editing) already works
 * through WordPress's own wp/v2/sc-listings routes — registered
 * automatically because the CPT has show_in_rest. But a member editing
 * their *own* listing needs the same workaround events already has
 * (update_listing/check_owns_listing below): Subscriber has no
 * edit_posts capability at all, so core REST 403s them regardless of
 * ownership. Beyond that: claiming an unclaimed listing, and requesting
 * a paid/featured upgrade.
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

		register_rest_route(
			'sc-directory/v1',
			'/submit',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'submit_listing' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-directory/v1',
			'/mine',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_my_listings' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_field(
			SC_Directory_CPT::POST_TYPE,
			'sc_claim_pending',
			array(
				'get_callback' => function ( $post ) {
					return ! get_post_meta( $post['id'], 'sc_claimed', true )
						&& (bool) get_post_meta( $post['id'], 'sc_claim_requested_by', true );
				},
				'schema'       => array( 'type' => 'boolean' ),
			)
		);

		register_rest_route(
			'sc-directory/v1',
			'/(?P<id>\d+)',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'update_listing' ),
				'permission_callback' => array( __CLASS__, 'check_owns_listing' ),
			)
		);
	}

	/**
	 * Same reasoning as SC_Events_REST::check_owns_event — a Subscriber
	 * (which is what every member is) has no edit_posts capability at
	 * all, so WordPress's own wp/v2/sc-listings/{id} route 403s them even
	 * for their own listing. This custom route checks ownership manually
	 * instead, same as the docblock on the CPT said only "an admin
	 * editing through core REST" was covered — this is the other half,
	 * an owner editing their own listing. Admins can edit any listing.
	 */
	public static function check_owns_listing( WP_REST_Request $request ) {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'not_logged_in', 'You must be logged in.', array( 'status' => 401 ) );
		}
		$listing = get_post( (int) $request->get_param( 'id' ) );
		if ( ! $listing || SC_Directory_CPT::POST_TYPE !== $listing->post_type ) {
			return new WP_Error( 'not_found', 'Listing not found.', array( 'status' => 404 ) );
		}
		$current_user_id = get_current_user_id();
		if ( (int) $listing->post_author !== $current_user_id && ! user_can( $current_user_id, 'manage_options' ) ) {
			return new WP_Error( 'forbidden', 'You can only edit your own listing.', array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * Every field optional, same as SC_Events_REST::update_event — a
	 * partial edit (e.g. just fixing the phone number) shouldn't force
	 * resending the whole form. Deliberately doesn't touch
	 * sc_featured/sc_verified/sc_claimed/sc_plan — those stay
	 * admin-controlled from wp-admin, not something a member (or even an
	 * admin through this member-facing form) can flip from here.
	 */
	public static function update_listing( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'id' );
		$update  = array( 'ID' => $post_id );

		if ( null !== $request->get_param( 'title' ) ) {
			$title = sanitize_text_field( (string) $request->get_param( 'title' ) );
			if ( ! $title ) {
				return new WP_Error( 'missing_title', 'A business/organisation name is required.', array( 'status' => 400 ) );
			}
			$update['post_title'] = $title;
		}
		if ( null !== $request->get_param( 'description' ) ) {
			$update['post_content'] = wp_kses_post( (string) $request->get_param( 'description' ) );
		}

		if ( count( $update ) > 1 ) {
			$result = wp_update_post( $update, true );
			if ( is_wp_error( $result ) ) {
				return new WP_Error( 'update_failed', $result->get_error_message(), array( 'status' => 400 ) );
			}
		}

		if ( null !== $request->get_param( 'category' ) ) {
			$category = sanitize_key( (string) $request->get_param( 'category' ) );
			if ( $category && term_exists( $category, SC_Directory_CPT::TAXONOMY ) ) {
				wp_set_object_terms( $post_id, $category, SC_Directory_CPT::TAXONOMY );
			}
		}

		$meta_fields = array(
			'address_street'   => 'sc_address_street',
			'address_town'     => 'sc_address_town',
			'address_region'   => 'sc_address_region',
			'address_postcode' => 'sc_address_postcode',
			'address_country'  => 'sc_address_country',
			'phone'            => 'sc_phone',
		);
		foreach ( $meta_fields as $param => $meta_key ) {
			if ( null === $request->get_param( $param ) ) {
				continue;
			}
			update_post_meta( $post_id, $meta_key, sanitize_text_field( (string) $request->get_param( $param ) ) );
		}
		$url_fields = array(
			'website'   => 'sc_website',
			'facebook'  => 'sc_facebook',
			'instagram' => 'sc_instagram',
			'twitter'   => 'sc_twitter',
		);
		foreach ( $url_fields as $param => $meta_key ) {
			if ( null === $request->get_param( $param ) ) {
				continue;
			}
			update_post_meta( $post_id, $meta_key, esc_url_raw( (string) $request->get_param( $param ) ) );
		}

		return array( 'status' => get_post_status( $post_id ), 'id' => $post_id );
	}

	/**
	 * A member's own listings regardless of status — the dashboard's
	 * "Your directory listing" section, and the reason a plain wp/v2
	 * query wasn't used: a subscriber lacks the capability to see their
	 * own 'pending' posts through the generic REST controller's status
	 * filter, only 'publish'.
	 */
	public static function get_my_listings( WP_REST_Request $request ) {
		$posts = get_posts(
			array(
				'post_type'      => SC_Directory_CPT::POST_TYPE,
				'author'         => get_current_user_id(),
				'post_status'    => array( 'publish', 'pending', 'draft' ),
				'posts_per_page' => 50,
				'orderby'        => 'date',
				'order'          => 'DESC',
			)
		);

		return array_map(
			function ( $post ) {
				return array(
					'id'     => $post->ID,
					'title'  => get_the_title( $post ),
					'status' => $post->post_status,
					'slug'   => $post->post_name,
					'date'   => $post->post_date,
				);
			},
			$posts
		);
	}

	/**
	 * A member submitting a brand-new listing (as opposed to claiming an
	 * existing one). Always lands as 'pending' — a public directory that
	 * anyone logged in can publish to unmoderated is a spam/quality risk,
	 * and the brief's own editorial model is draft → human approval →
	 * publish throughout, not just for articles. Rob reviews and publishes
	 * from the normal wp-admin listings screen, same as any other pending post.
	 */
	public static function submit_listing( WP_REST_Request $request ) {
		$title = sanitize_text_field( (string) $request->get_param( 'title' ) );
		if ( ! $title ) {
			return new WP_Error( 'missing_title', 'A business/organisation name is required.', array( 'status' => 400 ) );
		}

		$user_id = get_current_user_id();

		$post_id = wp_insert_post(
			array(
				'post_type'    => SC_Directory_CPT::POST_TYPE,
				'post_status'  => 'pending',
				'post_title'   => $title,
				'post_content' => wp_kses_post( (string) $request->get_param( 'description' ) ),
				'post_author'  => $user_id,
			),
			true
		);

		if ( is_wp_error( $post_id ) ) {
			return new WP_Error( 'submit_failed', $post_id->get_error_message(), array( 'status' => 400 ) );
		}

		$category = sanitize_key( (string) $request->get_param( 'category' ) );
		if ( $category && term_exists( $category, SC_Directory_CPT::TAXONOMY ) ) {
			wp_set_object_terms( $post_id, $category, SC_Directory_CPT::TAXONOMY );
		}

		$meta = array(
			'sc_address_street'   => sanitize_text_field( (string) $request->get_param( 'address_street' ) ),
			'sc_address_town'     => sanitize_text_field( (string) $request->get_param( 'address_town' ) ),
			'sc_address_region'   => sanitize_text_field( (string) $request->get_param( 'address_region' ) ),
			'sc_address_postcode' => sanitize_text_field( (string) $request->get_param( 'address_postcode' ) ),
			'sc_address_country'  => sanitize_text_field( (string) $request->get_param( 'address_country' ) ),
			'sc_website'          => esc_url_raw( (string) $request->get_param( 'website' ) ),
			'sc_phone'            => sanitize_text_field( (string) $request->get_param( 'phone' ) ),
			'sc_facebook'         => esc_url_raw( (string) $request->get_param( 'facebook' ) ),
			'sc_instagram'        => esc_url_raw( (string) $request->get_param( 'instagram' ) ),
			'sc_twitter'          => esc_url_raw( (string) $request->get_param( 'twitter' ) ),
			'sc_claimed'          => '1', // The submitter is the owner by definition.
			'sc_featured'         => '0',
			'sc_verified'         => '0',
			'sc_plan'             => 'free',
		);
		foreach ( $meta as $key => $value ) {
			update_post_meta( $post_id, $key, $value );
		}

		do_action( 'sc_directory_listing_submitted', $user_id, $post_id );

		return array( 'status' => 'pending', 'id' => $post_id );
	}

	/**
	 * Claiming used to be instant — one click reassigned post_author with
	 * no review at all, which meant anyone could take over any unclaimed
	 * listing (a real local business's page) just by being logged in.
	 * This now only *requests* a claim: it records who's asking and
	 * leaves the listing exactly as it was until an admin approves it
	 * from the "Claim Requests" screen (SC_Directory_Admin), which is
	 * also where sc_directory_listing_claimed actually fires — see
	 * SC_Directory_Admin::handle_review_claim(). A truthy check on
	 * sc_claimed here, not a strict comparison: update_post_meta stores a
	 * raw PHP `true` back as the string '1', so '===' against either
	 * literal would never match.
	 */
	public static function claim_listing( WP_REST_Request $request ) {
		$listing_id = (int) $request->get_param( 'id' );
		$listing    = get_post( $listing_id );

		if ( ! $listing || SC_Directory_CPT::POST_TYPE !== $listing->post_type ) {
			return new WP_Error( 'not_found', 'Listing not found.', array( 'status' => 404 ) );
		}

		if ( get_post_meta( $listing_id, 'sc_claimed', true ) ) {
			return new WP_Error( 'already_claimed', 'This listing is already claimed.', array( 'status' => 409 ) );
		}

		if ( get_post_meta( $listing_id, 'sc_claim_requested_by', true ) ) {
			return new WP_Error( 'already_requested', 'A claim request for this listing is already awaiting review.', array( 'status' => 409 ) );
		}

		$user_id = get_current_user_id();

		update_post_meta( $listing_id, 'sc_claim_requested_by', $user_id );
		update_post_meta( $listing_id, 'sc_claim_requested_at', current_time( 'mysql' ) );

		/** sc-directory's own admin queue picks this up; sc-directory's hooks class emails Rob about it. */
		do_action( 'sc_directory_listing_claim_requested', $user_id, $listing_id );

		return array( 'status' => 'pending' );
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
