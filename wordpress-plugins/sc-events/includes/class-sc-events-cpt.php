<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Events as a plain custom post type, same trade-off as sc-directory:
 * WordPress's own REST controller handles list/detail/create/update for
 * free. The one thing EventON never gave the frontend for free was a
 * proper date/venue field over REST — lib/wordpress.ts in the Next.js app
 * currently has to fetch each event's rendered HTML page and scrape a
 * schema.org JSON-LD block out of it to get a start time. sc-events makes
 * that unnecessary: start/end/venue are plain REST meta from the start.
 */
class SC_Events_CPT {

	const POST_TYPE = 'sc_event';
	const TAXONOMY  = 'sc_event_category';

	public static function default_categories() {
		return array(
			'Whats On in Carshalton',
			'Whats On in Sutton',
			'Whats On Outside Sutton',
		);
	}

	public static function register() {
		register_post_type(
			self::POST_TYPE,
			array(
				'label'        => 'Events',
				'public'       => true,
				'show_in_rest' => true,
				'rest_base'    => 'sc-events',
				'has_archive'  => 'events',
				'rewrite'      => array( 'slug' => 'events' ),
				'supports'     => array( 'title', 'editor', 'thumbnail', 'author', 'custom-fields' ),
				'menu_icon'    => 'dashicons-calendar-alt',
				'capability_type' => 'post',
				'map_meta_cap' => true,
			)
		);

		register_taxonomy(
			self::TAXONOMY,
			self::POST_TYPE,
			array(
				'label'        => 'Event Categories',
				'public'       => true,
				'show_in_rest' => true,
				'hierarchical' => false,
				'rewrite'      => array( 'slug' => 'events/category' ),
			)
		);
	}

	/**
	 * True activation only — see sc-events.php for why the version-checked
	 * seed_categories() call also has to run independently on 'init'.
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
