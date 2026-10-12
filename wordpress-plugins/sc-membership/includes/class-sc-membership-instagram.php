<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The homepage "Reels & photos" strip (lib/instagram.ts on the frontend).
 * Easy Social Feed holds the @secret.carshalton connection and keeps the
 * images on this server, but has no Instagram REST API, so the frontend
 * used to read the feed out of the old WordPress homepage — which stops
 * existing once www points at the new site. This renders the same feed
 * (the shortcode the old homepage used) and returns its HTML.
 */
class SC_Membership_Instagram {

	const SHORTCODE = '[my-instagram-feed user_id="17841437571739168" skin_id="19949" feeds_per_page="15" caption_words="0" cache_unit="1" cache_duration="days" load_more="0" links_new_tab="1" show_stories="0" autoplay="0"]';

	public static function register_routes() {
		register_rest_route(
			'sc-membership/v1',
			'/instagram-feed',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'feed' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public static function feed() {
		if ( ! shortcode_exists( 'my-instagram-feed' ) ) {
			return new WP_Error( 'feed_unavailable', 'Easy Social Feed is not active.', array( 'status' => 503 ) );
		}
		return array( 'html' => do_shortcode( self::SHORTCODE ) );
	}
}
