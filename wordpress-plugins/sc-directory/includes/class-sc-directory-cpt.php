<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Listings are a plain custom post type rather than a bespoke table (which
 * is what Sabai Directory uses). That trade means WordPress's own REST
 * controller already handles list/detail/create/update for us — we only
 * need custom endpoints for the two actions that aren't "edit a post":
 * claiming a listing, and requesting a paid upgrade.
 *
 * Categories match the real ones scraped from the live Sabai install, so
 * existing listing data has a direct home to migrate into.
 */
class SC_Directory_CPT {

	const POST_TYPE = 'sc_listing';
	const TAXONOMY  = 'sc_listing_category';

	/**
	 * Real category set scraped from the live Sabai Directory admin —
	 * kept identical so a data migration doesn't need a category remap.
	 */
	public static function default_categories() {
		return array(
			'B2B',
			'Trades',
			'House and Home',
			'Fitness',
			'Families',
			'Pets',
			'Everything else',
			'Places to go',
			'Places to stay',
			'Groups to join',
			'Venues for hire',
		);
	}

	public static function register() {
		register_post_type(
			self::POST_TYPE,
			array(
				'label'        => 'Directory Listings',
				'public'       => true,
				'show_in_rest' => true,
				'rest_base'    => 'sc-listings',
				'has_archive'  => 'directory',
				'rewrite'      => array( 'slug' => 'directory/listing' ),
				'supports'     => array( 'title', 'editor', 'thumbnail', 'author' ),
				'menu_icon'    => 'dashicons-location',
				'capability_type' => 'post',
				'map_meta_cap' => true,
			)
		);

		register_taxonomy(
			self::TAXONOMY,
			self::POST_TYPE,
			array(
				'label'        => 'Listing Categories',
				'public'       => true,
				'show_in_rest' => true,
				'hierarchical' => false,
				'rewrite'      => array( 'slug' => 'directory/category' ),
			)
		);
	}

	/**
	 * True activation only (fires register_activation_hook, which never
	 * re-fires on our upload-a-new-version deploy path — see
	 * sc-directory.php for the 'init' version-check that handles that case
	 * by calling seed_categories() alone, without the rewrite flush).
	 */
	public static function install() {
		self::register();
		self::seed_categories();
		flush_rewrite_rules();
	}

	public static function seed_categories() {
		foreach ( self::default_categories() as $category ) {
			if ( ! term_exists( $category, self::TAXONOMY ) ) {
				wp_insert_term( $category, self::TAXONOMY );
			}
		}
	}
}
