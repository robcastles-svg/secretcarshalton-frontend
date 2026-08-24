<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface the Next.js frontend talks to. Namespace: sc-post-views/v1
 */
class SC_Post_Views_REST {

	public static function register_routes() {
		register_rest_route(
			'sc-post-views/v1',
			'/record',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'record' ),
				/**
				 * Public and unauthenticated on purpose, same as sc-ads'
				 * click-tracking route — a view counter has to work for
				 * every visitor, not just logged-in members. No rate
				 * limiting beyond what the frontend already does (fires
				 * once per page load via a client-side effect, not on
				 * every render) — matches this project's existing bar for
				 * click/view tracking rather than adding new
				 * infrastructure for a problem that hasn't shown up yet.
				 */
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-post-views/v1',
			'/count/(?P<id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'count' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-post-views/v1',
			'/top',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'top' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public static function record( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'post_id' );
		if ( ! $post_id ) {
			return new WP_Error( 'missing_post_id', 'A post_id is required.', array( 'status' => 400 ) );
		}

		$slug  = sanitize_title( (string) $request->get_param( 'slug' ) );
		$title = wp_specialchars_decode( sanitize_text_field( (string) $request->get_param( 'title' ) ), ENT_QUOTES );

		SC_Post_Views_DB::record_view( $post_id, $slug, $title );

		return array( 'status' => 'recorded' );
	}

	public static function count( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'id' );
		return array(
			'post_id' => $post_id,
			'views'   => SC_Post_Views_DB::total_for( $post_id ),
		);
	}

	public static function top( WP_REST_Request $request ) {
		$window = sanitize_key( (string) $request->get_param( 'window' ) );
		if ( ! in_array( $window, array( 'today', 'week' ), true ) ) {
			$window = 'week';
		}
		$limit = (int) $request->get_param( 'limit' );
		if ( ! $limit ) {
			$limit = 10;
		}

		/**
		 * Both optional, comma-separated — e.g. post_type=post to exclude
		 * events/listings (also tracked by this same plugin), and
		 * categories=news,stories,walks so a "Top stories" sidebar only
		 * ever surfaces News/Stories/Walks content, not Spotlight/People.
		 */
		$post_type_param = (string) $request->get_param( 'post_type' );
		$post_types       = $post_type_param ? array_map( 'sanitize_key', explode( ',', $post_type_param ) ) : null;

		$categories_param = (string) $request->get_param( 'categories' );
		$category_slugs   = $categories_param ? array_map( 'sanitize_title', explode( ',', $categories_param ) ) : null;

		$rows = SC_Post_Views_DB::top( $window, $limit, $post_types, $category_slugs );

		return array_map(
			function ( $row ) {
				return array(
					'post_id' => (int) $row->post_id,
					'slug'    => $row->post_slug,
					'title'   => $row->post_title,
					'views'   => (int) $row->total_views,
				);
			},
			$rows
		);
	}
}
