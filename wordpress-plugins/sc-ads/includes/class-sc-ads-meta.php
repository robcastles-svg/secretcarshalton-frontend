<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SC_Ads_Meta {

	const FIELDS = array(
		'sc_ad_headline'  => 'string', // short text, e.g. "20% off this month" — the main thing shown for every placement except Billboard
		'sc_ad_body'      => 'string', // optional one-line description under the headline
		'sc_ad_image_url' => 'string', // optional for text/image placements, required in practice for Billboard (the one placement still a plain image banner)
		'sc_ad_link_url'  => 'string',
		'sc_ad_alt_text'  => 'string',
		'sc_ad_placement' => 'string',
		'sc_ad_active'    => 'boolean',
		'sc_ad_start'     => 'string',  // ISO date, empty = no restriction
		'sc_ad_end'       => 'string',  // ISO date, empty = no restriction
		'sc_ad_weight'    => 'integer', // relative odds within its placement's rotation pool, default 1
		'sc_ad_clicks'    => 'integer', // incremented by the click-tracking endpoint, not admin-editable
		'sc_ad_views'     => 'integer', // incremented by the impression-tracking endpoint, fired client-side from AdCard so an ISR background regen never counts as a view — not admin-editable
		// Payment holding fields — pricing isn't finalised and there's no
		// payment automation yet, so these are filled in by hand (submit_ad
		// sets days_requested from what the advertiser asked for and
		// payment_status to 'pending'; an admin fills in amount_paid and
		// flips payment_status/sc_ad_active together once paid).
		'sc_ad_days_requested' => 'integer',
		'sc_ad_amount_paid'    => 'string',
		'sc_ad_payment_status' => 'string', // '' | 'pending' | 'paid'
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
