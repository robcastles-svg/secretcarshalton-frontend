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
	}

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
			'id'    => $post->ID,
			'image' => get_post_meta( $post->ID, 'sc_ad_image_url', true ),
			'link'  => get_post_meta( $post->ID, 'sc_ad_link_url', true ),
			'alt'   => get_post_meta( $post->ID, 'sc_ad_alt_text', true ),
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
}
