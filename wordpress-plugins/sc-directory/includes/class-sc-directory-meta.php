<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Per-listing fields, modeled on what a real listing actually contains on
 * the live site (scraped from a published Sabai listing): structured
 * address, website, description (that's just post_content), claim/feature
 * state, and a plan. Phone is the one field added beyond what was directly
 * observed — a near-universal directory field, worth having even though
 * the one sample listing checked didn't happen to show it.
 *
 * All registered with show_in_rest so they ride along on the normal
 * wp/v2/sc-listings endpoints WordPress already provides for the CPT —
 * no custom REST controller needed for reading or editing these.
 */
class SC_Directory_Meta {

	const FIELDS = array(
		'sc_address_street'   => 'string',
		'sc_address_town'     => 'string',
		'sc_address_region'   => 'string',
		'sc_address_postcode' => 'string',
		'sc_address_country'  => 'string',
		'sc_website'          => 'string',
		'sc_phone'            => 'string',
		'sc_email'            => 'string',
		'sc_tagline'          => 'string', // Short one-line teaser shown under the title/on cards, separate from the full description.
		/**
		 * Attachment ID of a square/white-background logo for the
		 * homepage's Featured-member strip (SponsorStrip) — deliberately
		 * separate from sc_gallery (the listing-page photo slider), which
		 * holds real in-context photos, not a brand mark meant to sit in a
		 * small white tile next to other brands. Resolved to a URL by the
		 * sc_logo_image REST field below rather than exposing the raw ID.
		 */
		'sc_logo'             => 'integer',
		'sc_facebook'         => 'string',
		'sc_instagram'        => 'string',
		'sc_twitter'          => 'string',
		'sc_linkedin'         => 'string',
		'sc_youtube'          => 'string',
		'sc_lat'              => 'string', // Geocoded from the address server-side — see SC_Directory_REST::geocode_address().
		'sc_lng'              => 'string',
		'sc_featured'         => 'boolean',
		'sc_verified'         => 'boolean',
		'sc_claimed'          => 'boolean',
		'sc_plan'             => 'string', // 'free' | 'paid'
		'sc_claim_expires_at' => 'string', // ISO date, empty string when not applicable
		/**
		 * Which Featured package this listing is on — 'featured' |
		 * 'featured_6mo' | 'featured_plus' | 'featured_gold', empty when
		 * sc_featured is false. Set by SC_Directory_Hooks::on_upgrade_reviewed
		 * from whatever the member picked on /dashboard/upgrade (see
		 * SC_Membership_Hooks::VALID_UPGRADE_TIERS in sc-membership) —
		 * never set directly here.
		 */
		'sc_featured_tier'    => 'string',
		/**
		 * Community Group Promotion — a separate, cheaper, time-limited
		 * (30 day) boost for "groups-to-join" listings, distinct from the
		 * Featured tiers above. Same request → admin-approve → expire
		 * shape as sc_claimed/sc_claim_expires_at, see
		 * SC_Directory_REST::request_promotion/SC_Directory_Admin's
		 * promotion queue, and SC_Directory_Hooks::expire_claims (which
		 * also sweeps this).
		 */
		'sc_group_promoted'          => 'boolean',
		'sc_group_promo_expires_at'  => 'string', // ISO date, empty when not applicable
		/**
		 * The directory-upgrade perk of showing up in News/Discover/etc
		 * category grids, not just the Directory page's own featured
		 * section — capped at 150 impressions/month for now (Rob's holding
		 * figure), no option to buy more yet. Reset monthly by comparing
		 * sc_featured_views_month against the current Y-m rather than a
		 * cron job — see SC_Directory_REST::is_grid_eligible.
		 */
		'sc_featured_views_used'  => 'integer',
		'sc_featured_views_month' => 'string', // 'Y-m' of the last reset
	);

	/** Registered separately from FIELDS — an array of attachment IDs needs an explicit REST schema, unlike the scalar string/boolean fields above. */
	const GALLERY_FIELD = 'sc_gallery';

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

			if ( 'string' === $type ) {
				$url_fields                = array( 'sc_website', 'sc_facebook', 'sc_instagram', 'sc_twitter', 'sc_linkedin', 'sc_youtube' );
				if ( 'sc_email' === $key ) {
					$args['sanitize_callback'] = 'sanitize_email';
				} else {
					$args['sanitize_callback'] = in_array( $key, $url_fields, true ) ? 'esc_url_raw' : 'sanitize_text_field';
				}
			}

			register_post_meta( SC_Directory_CPT::POST_TYPE, $key, $args );
		}

		register_post_meta(
			SC_Directory_CPT::POST_TYPE,
			self::GALLERY_FIELD,
			array(
				'type'          => 'array',
				'single'        => true,
				'show_in_rest'  => array(
					'schema' => array(
						'type'  => 'array',
						'items' => array( 'type' => 'integer' ),
					),
				),
				'auth_callback' => function ( $allowed, $meta_key, $post_id ) {
					return current_user_can( 'edit_post', $post_id );
				},
			)
		);
	}
}
