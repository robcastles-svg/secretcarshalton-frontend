<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One call per slot: GET /sc-ads/v1/active/{placement} returns the current
 * active ad for that placement, or null. The frontend doesn't need to know
 * anything about post IDs or filter through a list itself.
 */
class SC_Ads_REST {

	public static function register_routes() {
		register_rest_route(
			'sc-ads/v1',
			'/active/(?P<placement>[a-z_]+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_active' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public static function get_active( WP_REST_Request $request ) {
		$placement = sanitize_key( $request->get_param( 'placement' ) );
		$today     = current_time( 'Y-m-d' );

		$query = new WP_Query(
			array(
				'post_type'      => SC_Ads_CPT::POST_TYPE,
				'post_status'    => 'publish',
				'posts_per_page' => 5,
				'orderby'        => 'date',
				'order'          => 'DESC',
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

		foreach ( $query->posts as $post ) {
			$start = get_post_meta( $post->ID, 'sc_ad_start', true );
			$end   = get_post_meta( $post->ID, 'sc_ad_end', true );

			if ( $start && $today < $start ) {
				continue;
			}
			if ( $end && $today > $end ) {
				continue;
			}

			return array(
				'id'       => $post->ID,
				'image'    => get_post_meta( $post->ID, 'sc_ad_image_url', true ),
				'link'     => get_post_meta( $post->ID, 'sc_ad_link_url', true ),
				'alt'      => get_post_meta( $post->ID, 'sc_ad_alt_text', true ),
			);
		}

		return null;
	}
}
