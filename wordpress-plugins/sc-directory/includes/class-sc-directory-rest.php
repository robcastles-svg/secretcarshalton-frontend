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
 * ownership. Beyond that: claiming an unclaimed listing, requesting a
 * paid/featured upgrade, managing the photo gallery, and renewing a
 * claim before/after it expires.
 */
class SC_Directory_REST {

	/** Plan-gated limits — mirrors the old Sabai paid-plan add-on caps, minus the multi-location/leads add-ons Rob doesn't want rebuilt. */
	const FREE_CATEGORY_LIMIT = 1;
	const PAID_CATEGORY_LIMIT = 3;
	const FREE_PHOTO_LIMIT    = 3;
	const PAID_PHOTO_LIMIT    = 10;

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
			'/(?P<id>\d+)/renew-claim',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'renew_claim' ),
				'permission_callback' => array( __CLASS__, 'check_owns_listing' ),
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

		/**
		 * sc_gallery (registered in SC_Directory_Meta) only stores
		 * attachment IDs — resolving those to actual URLs here, rather
		 * than making the frontend issue a follow-up wp/v2/media request
		 * per listing, the same reasoning _embed already gets for the
		 * single featured image.
		 */
		register_rest_field(
			SC_Directory_CPT::POST_TYPE,
			'sc_gallery_images',
			array(
				'get_callback' => function ( $post ) {
					$ids = (array) get_post_meta( $post['id'], 'sc_gallery', true );
					return array_values(
						array_filter(
							array_map(
								function ( $attachment_id ) {
									$attachment_id = (int) $attachment_id;
									$src           = wp_get_attachment_image_src( $attachment_id, 'large' );
									if ( ! $src ) {
										return null;
									}
									return array(
										'id'  => $attachment_id,
										'url' => $src[0],
										'alt' => get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
									);
								},
								$ids
							)
						)
					);
				},
				'schema'       => array(
					'type'  => 'array',
					'items' => array( 'type' => 'object' ),
				),
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

		register_rest_route(
			'sc-directory/v1',
			'/(?P<id>\d+)/photos',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'upload_photos' ),
				'permission_callback' => array( __CLASS__, 'check_owns_listing' ),
			)
		);

		register_rest_route(
			'sc-directory/v1',
			'/(?P<id>\d+)/photos/delete',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'delete_photo' ),
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
	 * Normalizes whatever shape the categories arrived in — a single
	 * `category` slug (old clients, or a free-plan submit form that only
	 * ever sends one), or a `categories[]` array (the multi-category
	 * form) — into a deduplicated list of slugs, capped to what the
	 * listing's plan allows. Only slugs that actually exist as terms are
	 * kept, same guard the original single-category code had.
	 */
	private static function resolve_categories( WP_REST_Request $request, $plan ) {
		$raw = $request->get_param( 'categories' );
		if ( null === $raw ) {
			$raw = $request->get_param( 'category' );
		}
		if ( null === $raw ) {
			return null;
		}

		$slugs = array();
		foreach ( (array) $raw as $slug ) {
			$slug = sanitize_key( (string) $slug );
			if ( $slug && term_exists( $slug, SC_Directory_CPT::TAXONOMY ) && ! in_array( $slug, $slugs, true ) ) {
				$slugs[] = $slug;
			}
		}

		$limit = 'paid' === $plan ? self::PAID_CATEGORY_LIMIT : self::FREE_CATEGORY_LIMIT;
		return array_slice( $slugs, 0, $limit );
	}

	/**
	 * Geocodes the listing's current address via OSM Nominatim (free,
	 * no API key — unlike Google's Geocoding API, which would need
	 * billing Rob has deliberately not set up) and stores the result as
	 * sc_lat/sc_lng. Best-effort: an unresolved or ambiguous address just
	 * leaves lat/lng unset, and the frontend map falls back to a live
	 * text-query embed in that case. Nominatim's usage policy wants a
	 * real User-Agent and no more than ~1 req/sec, both fine for this
	 * site's submission volume.
	 */
	private static function geocode_address( $post_id ) {
		$parts = array_filter(
			array(
				get_post_meta( $post_id, 'sc_address_street', true ),
				get_post_meta( $post_id, 'sc_address_town', true ),
				get_post_meta( $post_id, 'sc_address_region', true ),
				get_post_meta( $post_id, 'sc_address_postcode', true ),
				get_post_meta( $post_id, 'sc_address_country', true ),
			)
		);
		if ( empty( $parts ) ) {
			return;
		}

		$response = wp_remote_get(
			'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' . rawurlencode( implode( ', ', $parts ) ),
			array(
				'timeout' => 8,
				'headers' => array( 'User-Agent' => 'SecretCarshalton.com listing geocoder (admin@secretcarshalton.com)' ),
			)
		);
		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( empty( $body[0]['lat'] ) || empty( $body[0]['lon'] ) ) {
			return;
		}

		update_post_meta( $post_id, 'sc_lat', sanitize_text_field( $body[0]['lat'] ) );
		update_post_meta( $post_id, 'sc_lng', sanitize_text_field( $body[0]['lon'] ) );
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

		$plan       = get_post_meta( $post_id, 'sc_plan', true ) ?: 'free';
		$categories = self::resolve_categories( $request, $plan );
		if ( null !== $categories && ! empty( $categories ) ) {
			wp_set_object_terms( $post_id, $categories, SC_Directory_CPT::TAXONOMY );
		}

		$text_fields = array(
			'address_street'   => 'sc_address_street',
			'address_town'     => 'sc_address_town',
			'address_region'   => 'sc_address_region',
			'address_postcode' => 'sc_address_postcode',
			'address_country'  => 'sc_address_country',
			'phone'            => 'sc_phone',
			'tagline'          => 'sc_tagline',
		);
		foreach ( $text_fields as $param => $meta_key ) {
			if ( null === $request->get_param( $param ) ) {
				continue;
			}
			update_post_meta( $post_id, $meta_key, sanitize_text_field( (string) $request->get_param( $param ) ) );
		}

		if ( null !== $request->get_param( 'email' ) ) {
			update_post_meta( $post_id, 'sc_email', sanitize_email( (string) $request->get_param( 'email' ) ) );
		}

		$url_fields = array(
			'website'   => 'sc_website',
			'facebook'  => 'sc_facebook',
			'instagram' => 'sc_instagram',
			'twitter'   => 'sc_twitter',
			'linkedin'  => 'sc_linkedin',
			'youtube'   => 'sc_youtube',
		);
		foreach ( $url_fields as $param => $meta_key ) {
			if ( null === $request->get_param( $param ) ) {
				continue;
			}
			update_post_meta( $post_id, $meta_key, esc_url_raw( (string) $request->get_param( $param ) ) );
		}

		$address_params = array( 'address_street', 'address_town', 'address_region', 'address_postcode', 'address_country' );
		foreach ( $address_params as $param ) {
			if ( null !== $request->get_param( $param ) ) {
				self::geocode_address( $post_id );
				break;
			}
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

		$categories = self::resolve_categories( $request, 'free' );
		if ( ! empty( $categories ) ) {
			wp_set_object_terms( $post_id, $categories, SC_Directory_CPT::TAXONOMY );
		}

		$meta = array(
			'sc_address_street'   => sanitize_text_field( (string) $request->get_param( 'address_street' ) ),
			'sc_address_town'     => sanitize_text_field( (string) $request->get_param( 'address_town' ) ),
			'sc_address_region'   => sanitize_text_field( (string) $request->get_param( 'address_region' ) ),
			'sc_address_postcode' => sanitize_text_field( (string) $request->get_param( 'address_postcode' ) ),
			'sc_address_country'  => sanitize_text_field( (string) $request->get_param( 'address_country' ) ),
			'sc_website'          => esc_url_raw( (string) $request->get_param( 'website' ) ),
			'sc_phone'            => sanitize_text_field( (string) $request->get_param( 'phone' ) ),
			'sc_email'            => sanitize_email( (string) $request->get_param( 'email' ) ),
			'sc_tagline'          => sanitize_text_field( (string) $request->get_param( 'tagline' ) ),
			'sc_facebook'         => esc_url_raw( (string) $request->get_param( 'facebook' ) ),
			'sc_instagram'        => esc_url_raw( (string) $request->get_param( 'instagram' ) ),
			'sc_twitter'          => esc_url_raw( (string) $request->get_param( 'twitter' ) ),
			'sc_linkedin'         => esc_url_raw( (string) $request->get_param( 'linkedin' ) ),
			'sc_youtube'          => esc_url_raw( (string) $request->get_param( 'youtube' ) ),
			'sc_claimed'          => '1', // The submitter is the owner by definition.
			'sc_featured'         => '0',
			'sc_verified'         => '0',
			'sc_plan'             => 'free',
		);
		foreach ( $meta as $key => $value ) {
			update_post_meta( $post_id, $key, $value );
		}

		self::geocode_address( $post_id );
		self::save_uploaded_photos( $request, $post_id, self::FREE_PHOTO_LIMIT );

		do_action( 'sc_directory_listing_submitted', $user_id, $post_id );

		return array( 'status' => 'pending', 'id' => $post_id );
	}

	/**
	 * Shared by submit_listing (initial photos) and upload_photos (adding
	 * more later) — sideloads each uploaded file as a media attachment
	 * parented to the listing, appends its ID to sc_gallery, and stops
	 * once the plan's photo cap is reached rather than erroring, so a
	 * free-plan owner selecting 5 files at once just gets the first 3.
	 */
	private static function save_uploaded_photos( WP_REST_Request $request, $post_id, $limit ) {
		$files = $request->get_file_params();
		if ( empty( $files['photos'] ) ) {
			return 0;
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$gallery = (array) get_post_meta( $post_id, 'sc_gallery', true );
		$uploaded = array();

		$file_list = $files['photos'];
		// A single-file upload arrives as one assoc array; multiple files
		// arrive as parallel arrays keyed by index — normalize to a list.
		$is_multi = isset( $file_list['name'] ) && is_array( $file_list['name'] );
		$count    = $is_multi ? count( $file_list['name'] ) : 1;

		for ( $i = 0; $i < $count; $i++ ) {
			if ( count( $gallery ) + count( $uploaded ) >= $limit ) {
				break;
			}
			$single = $is_multi
				? array(
					'name'     => $file_list['name'][ $i ],
					'type'     => $file_list['type'][ $i ],
					'tmp_name' => $file_list['tmp_name'][ $i ],
					'error'    => $file_list['error'][ $i ],
					'size'     => $file_list['size'][ $i ],
				)
				: $file_list;

			if ( ! empty( $single['error'] ) || empty( $single['tmp_name'] ) ) {
				continue;
			}

			$_FILES['sc_directory_photo'] = $single;
			$attachment_id                = media_handle_upload( 'sc_directory_photo', $post_id );
			unset( $_FILES['sc_directory_photo'] );

			if ( ! is_wp_error( $attachment_id ) ) {
				$uploaded[] = $attachment_id;
			}
		}

		if ( $uploaded ) {
			update_post_meta( $post_id, 'sc_gallery', array_merge( $gallery, $uploaded ) );

			/*
			 * Neither the submit nor edit form has ever had a separate
			 * "featured image" field — photos only ever land in the
			 * gallery. Without this, a listing with real uploaded photos
			 * still shows no image anywhere on the frontend (cards, the
			 * listing page's slider) until an admin manually sets one in
			 * wp-admin, which is why gallery photos looked like they
			 * "weren't showing" — they were saved, just never visible.
			 * First photo ever uploaded becomes the cover image; leaves an
			 * existing featured image (however it was set) alone.
			 */
			if ( ! get_post_thumbnail_id( $post_id ) ) {
				set_post_thumbnail( $post_id, $uploaded[0] );
			}
		}
		return count( $uploaded );
	}

	/** Adding photos to an existing listing after submission — the edit page's gallery manager. */
	public static function upload_photos( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'id' );
		$plan    = get_post_meta( $post_id, 'sc_plan', true ) ?: 'free';
		$limit   = 'paid' === $plan ? self::PAID_PHOTO_LIMIT : self::FREE_PHOTO_LIMIT;

		$existing = (array) get_post_meta( $post_id, 'sc_gallery', true );
		if ( count( $existing ) >= $limit ) {
			return new WP_Error( 'photo_limit', "This listing's plan allows up to {$limit} photos.", array( 'status' => 400 ) );
		}

		$added = self::save_uploaded_photos( $request, $post_id, $limit );
		if ( 0 === $added ) {
			return new WP_Error( 'upload_failed', 'No photos were uploaded — check the file(s) and try again.', array( 'status' => 400 ) );
		}

		return array( 'gallery' => array_map( 'intval', (array) get_post_meta( $post_id, 'sc_gallery', true ) ) );
	}

	public static function delete_photo( WP_REST_Request $request ) {
		$post_id       = (int) $request->get_param( 'id' );
		$attachment_id = (int) $request->get_param( 'attachment_id' );

		$gallery = (array) get_post_meta( $post_id, 'sc_gallery', true );
		if ( ! in_array( $attachment_id, array_map( 'intval', $gallery ), true ) ) {
			return new WP_Error( 'not_found', 'That photo is not part of this listing.', array( 'status' => 404 ) );
		}

		$gallery = array_values( array_diff( array_map( 'intval', $gallery ), array( $attachment_id ) ) );
		update_post_meta( $post_id, 'sc_gallery', $gallery );
		wp_delete_attachment( $attachment_id, true );

		return array( 'gallery' => $gallery );
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

	/**
	 * Lets an already-verified owner push their claim's expiry out
	 * another year themselves — no need to go back through admin review,
	 * since check_owns_listing already proved they're the listing's
	 * author. Works whether called before expiry (extends it) or after
	 * SC_Directory_Hooks::expire_claims() has already flipped sc_claimed
	 * back off (re-claims it) — a lapsed owner clicking "Renew" shouldn't
	 * have to file a fresh claim request just because they were slow.
	 */
	public static function renew_claim( WP_REST_Request $request ) {
		$listing_id = (int) $request->get_param( 'id' );

		update_post_meta( $listing_id, 'sc_claimed', '1' );
		update_post_meta( $listing_id, 'sc_claim_expires_at', gmdate( 'Y-m-d\TH:i:s', strtotime( '+1 year' ) ) );

		return array( 'status' => 'renewed', 'expires_at' => get_post_meta( $listing_id, 'sc_claim_expires_at', true ) );
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
