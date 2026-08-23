<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SC_Ads_Meta {

	const FIELDS = array(
		'sc_ad_image_url' => 'string',
		'sc_ad_link_url'  => 'string',
		'sc_ad_alt_text'  => 'string',
		'sc_ad_placement' => 'string',
		'sc_ad_active'    => 'boolean',
		'sc_ad_start'     => 'string',  // ISO date, empty = no restriction
		'sc_ad_end'       => 'string',  // ISO date, empty = no restriction
		'sc_ad_weight'    => 'integer', // relative odds within its placement's rotation pool, default 1
		'sc_ad_clicks'    => 'integer', // incremented by the click-tracking endpoint, not admin-editable
	);

	public static function register() {
		foreach ( self::FIELDS as $key => $type ) {
			$args = array(
				'type'          => $type,
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function ( $allowed, $meta_key, $post_id ) {
					return current_user_can( 'edit_post', $post_id );
				},
			);

			if ( in_array( $key, array( 'sc_ad_image_url', 'sc_ad_link_url' ), true ) ) {
				$args['sanitize_callback'] = 'esc_url_raw';
			} elseif ( 'string' === $type ) {
				$args['sanitize_callback'] = 'sanitize_text_field';
			} elseif ( 'integer' === $type ) {
				$args['sanitize_callback'] = 'absint';
			}

			register_post_meta( SC_Ads_CPT::POST_TYPE, $key, $args );
		}
	}
}
