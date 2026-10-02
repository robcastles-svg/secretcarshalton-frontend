<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * GET /sc-ads/v1/active/{placement} — weighted-random pick among every
 * currently Active, in-date-range ad in that placement. This is what
 * AdRotate itself does per page load (see the plugin's docblock for the
 * live-site zone structure this mirrors); the frontend calls this from a
 * client component on every pageview rather than through Next's ISR cache,
 * so rotation is genuinely per-visit, not frozen for the ISR window.
 *
 * POST /sc-ads/v1/click/{id} — increments the click counter and hands
 * back the ad's link, so the frontend can route clicks through a
 * trackable redirect the way AdRotate's gofollow links do.
 */
class SC_Ads_REST {

	public static function register_routes() {
		register_rest_route(
			'sc-ads/v1',
			'/active/(?P<placement>[a-z0-9_]+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_active' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-ads/v1',
			'/click/(?P<id>\d+)',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'record_click' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-ads/v1',
			'/submit',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'submit_ad' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-ads/v1',
			'/mine',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_my_ads' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-ads/v1',
			'/impression/(?P<id>\d+)',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'record_impression' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-ads/v1',
			'/(?P<id>\d+)/extend',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'extend_ad' ),
				'permission_callback' => array( __CLASS__, 'check_owns_ad' ),
			)
		);
	}

	/** Owner-or-admin — same shape as sc-events' check_owns_event. */
	public static function check_owns_ad( WP_REST_Request $request ) {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'not_logged_in', 'You must be logged in.', array( 'status' => 401 ) );
		}
		$ad = get_post( (int) $request->get_param( 'id' ) );
		if ( ! $ad || SC_Ads_CPT::POST_TYPE !== $ad->post_type ) {
			return new WP_Error( 'not_found', 'Ad not found.', array( 'status' => 404 ) );
		}
		$current_user_id = get_current_user_id();
		if ( (int) $ad->post_author !== $current_user_id && ! user_can( $current_user_id, 'manage_options' ) ) {
			return new WP_Error( 'not_owner', 'You can only manage your own ads.', array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * Billboard/Leaderboard stay admin-set premium banner slots — sold and
	 * placed directly, not self-serve. in_feed removed: it rendered
	 * identically to sidebar (same stack), and that visual territory is
	 * reserved for directory-upgrade featured listings, not blue ads.
	 */
	const MEMBER_SUBMITTABLE_PLACEMENTS = array( 'sidebar', 'in_article' );

	private static function eligible_ads( $placement ) {
		$today = current_time( 'Y-m-d' );

		$query = new WP_Query(
			array(
				'post_type'      => SC_Ads_CPT::POST_TYPE,
				'post_status'    => 'publish',
				'posts_per_page' => 50,
				'meta_query'     => array(
					'relation' => 'AND',
					array(
						'key'   => 'sc_ad_placement',
						'value' => $placement,
					),
					array(
						'key'   => 'sc_ad_active',
						'value' => '1',
					),
				),
			)
		);

		$eligible = array();
		foreach ( $query->posts as $post ) {
			$start = get_post_meta( $post->ID, 'sc_ad_start', true );
			$end   = get_post_meta( $post->ID, 'sc_ad_end', true );

			if ( $start && $today < $start ) {
				continue;
			}
			if ( $end && $today > $end ) {
				continue;
			}

			$weight = max( 1, (int) get_post_meta( $post->ID, 'sc_ad_weight', true ) ?: 1 );
			$eligible[] = array( 'post' => $post, 'weight' => $weight );
		}

		return $eligible;
	}

	/** Weighted random pick — a plain array_rand() would treat every ad as equally likely, ignoring Weight. */
	private static function weighted_pick( $eligible ) {
		$total = 0;
		foreach ( $eligible as $entry ) {
			$total += $entry['weight'];
		}

		$roll     = wp_rand( 1, $total );
		$running  = 0;
		foreach ( $eligible as $entry ) {
			$running += $entry['weight'];
			if ( $roll <= $running ) {
				return $entry['post'];
			}
		}

		return $eligible[0]['post'];
	}

	public static function get_active( WP_REST_Request $request ) {
		$placement = sanitize_key( $request->get_param( 'placement' ) );
		$eligible  = self::eligible_ads( $placement );

		if ( empty( $eligible ) ) {
			return null;
		}

		$post = self::weighted_pick( $eligible );

		return array(
			'id'       => $post->ID,
			'headline' => get_post_meta( $post->ID, 'sc_ad_headline', true ),
			'body'     => get_post_meta( $post->ID, 'sc_ad_body', true ),
			'image'    => get_post_meta( $post->ID, 'sc_ad_image_url', true ),
			'link'     => get_post_meta( $post->ID, 'sc_ad_link_url', true ),
			'alt'      => get_post_meta( $post->ID, 'sc_ad_alt_text', true ),
		);
	}

	public static function record_click( WP_REST_Request $request ) {
		$id   = absint( $request->get_param( 'id' ) );
		$post = get_post( $id );

		if ( ! $post || SC_Ads_CPT::POST_TYPE !== $post->post_type ) {
			return new WP_Error( 'sc_ad_not_found', 'Ad not found.', array( 'status' => 404 ) );
		}

		$clicks = (int) get_post_meta( $id, 'sc_ad_clicks', true );
		update_post_meta( $id, 'sc_ad_clicks', $clicks + 1 );

		return array(
			'link' => get_post_meta( $id, 'sc_ad_link_url', true ),
		);
	}

	/** Fire-and-forget from AdCard when it actually renders client-side — same reasoning as sc-post-views/the featured-listing tracker: never counted during SSR/ISR regeneration. */
	public static function record_impression( WP_REST_Request $request ) {
		$id   = absint( $request->get_param( 'id' ) );
		$post = get_post( $id );

		if ( ! $post || SC_Ads_CPT::POST_TYPE !== $post->post_type ) {
			return new WP_Error( 'sc_ad_not_found', 'Ad not found.', array( 'status' => 404 ) );
		}

		$views = (int) get_post_meta( $id, 'sc_ad_views', true );
		update_post_meta( $id, 'sc_ad_views', $views + 1 );

		return array( 'views' => $views + 1 );
	}

	/**
	 * Buy more days on an already-approved ad without a fresh content
	 * review — the content isn't changing, only the run length, so this
	 * deliberately never touches sc_ad_active (an already-live ad stays
	 * live while the extension payment is pending). Adds to whatever days
	 * are already on the ad and resets payment_status to 'pending' so it
	 * shows up for Rob to confirm once paid, same holding pattern as the
	 * original submission.
	 */
	public static function extend_ad( WP_REST_Request $request ) {
		$id   = absint( $request->get_param( 'id' ) );
		$days = max( 1, absint( $request->get_param( 'days' ) ) ?: 1 );

		$current_days = (int) get_post_meta( $id, 'sc_ad_days_requested', true );
		update_post_meta( $id, 'sc_ad_days_requested', $current_days + $days );
		update_post_meta( $id, 'sc_ad_payment_status', 'pending' );

		return array(
			'daysRequested' => $current_days + $days,
			'paymentStatus' => 'pending',
		);
	}

	/**
	 * A member writing and submitting their own text ad. Created with
	 * sc_ad_active = false — nothing shows publicly until payment is
	 * confirmed (outside this flow for now, see the plugin's docblock)
	 * and an admin flips Active in wp-admin, the same metabox every other
	 * ad already goes through. No separate "pending" post_status: Active
	 * is already this plugin's one gate, so reusing it keeps review in
	 * the one place it already lives rather than adding a second state.
	 */
	public static function submit_ad( WP_REST_Request $request ) {
		$headline  = sanitize_text_field( (string) $request->get_param( 'headline' ) );
		$body      = sanitize_text_field( (string) $request->get_param( 'body' ) );
		$link      = esc_url_raw( (string) $request->get_param( 'link' ) );
		$placement = sanitize_key( (string) $request->get_param( 'placement' ) );
		$days      = max( 1, absint( $request->get_param( 'days' ) ) ?: 1 );

		if ( ! $headline || ! $link ) {
			return new WP_Error( 'missing_fields', 'A headline and link are required.', array( 'status' => 400 ) );
		}
		if ( ! in_array( $placement, self::MEMBER_SUBMITTABLE_PLACEMENTS, true ) ) {
			return new WP_Error( 'invalid_placement', 'Choose a valid ad placement.', array( 'status' => 400 ) );
		}

		$post_id = wp_insert_post(
			array(
				'post_type'   => SC_Ads_CPT::POST_TYPE,
				'post_status' => 'publish',
				'post_title'  => $headline,
				'post_author' => get_current_user_id(),
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		update_post_meta( $post_id, 'sc_ad_headline', $headline );
		update_post_meta( $post_id, 'sc_ad_body', $body );
		update_post_meta( $post_id, 'sc_ad_link_url', $link );
		update_post_meta( $post_id, 'sc_ad_alt_text', $headline );
		update_post_meta( $post_id, 'sc_ad_placement', $placement );
		update_post_meta( $post_id, 'sc_ad_active', false );
		update_post_meta( $post_id, 'sc_ad_weight', 1 );
		update_post_meta( $post_id, 'sc_ad_days_requested', $days );
		update_post_meta( $post_id, 'sc_ad_payment_status', 'pending' );

		if ( ! empty( $_FILES['image']['tmp_name'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			require_once ABSPATH . 'wp-admin/includes/image.php';
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/media.php';

			$attachment_id = media_handle_upload( 'image', $post_id );
			if ( ! is_wp_error( $attachment_id ) ) {
				update_post_meta( $post_id, 'sc_ad_image_url', wp_get_attachment_url( $attachment_id ) );
			}
		}

		return array(
			'id'     => $post_id,
			'status' => 'pending_payment',
		);
	}

	/** The dashboard's "Text adverts" section — a member's own ads, with the stats that justify what they paid for. */
	public static function get_my_ads( WP_REST_Request $request ) {
		$posts = get_posts(
			array(
				'post_type'      => SC_Ads_CPT::POST_TYPE,
				'author'         => get_current_user_id(),
				'post_status'    => 'publish',
				'posts_per_page' => 50,
				'orderby'        => 'date',
				'order'          => 'DESC',
			)
		);

		return array_map(
			function ( $post ) {
				return array(
					'id'            => $post->ID,
					'headline'      => get_post_meta( $post->ID, 'sc_ad_headline', true ),
					'body'          => get_post_meta( $post->ID, 'sc_ad_body', true ),
					'image'         => get_post_meta( $post->ID, 'sc_ad_image_url', true ),
					'link'          => get_post_meta( $post->ID, 'sc_ad_link_url', true ),
					'placement'     => get_post_meta( $post->ID, 'sc_ad_placement', true ),
					'active'        => (bool) get_post_meta( $post->ID, 'sc_ad_active', true ),
					'clicks'        => (int) get_post_meta( $post->ID, 'sc_ad_clicks', true ),
					'views'         => (int) get_post_meta( $post->ID, 'sc_ad_views', true ),
					'daysRequested' => (int) get_post_meta( $post->ID, 'sc_ad_days_requested', true ),
					'paymentStatus' => get_post_meta( $post->ID, 'sc_ad_payment_status', true ),
				);
			},
			$posts
		);
	}
}
