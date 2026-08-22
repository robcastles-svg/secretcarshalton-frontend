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
	/**
	 * Subject tags (Comedy, Music, Festival, ...) — EventON's event_type
	 * taxonomy, distinct from sc_event_category (which is really a
	 * location grouping: Carshalton / Sutton borough / Outside Sutton,
	 * migrated from EventON's separate event_type_2). Two taxonomies
	 * because that's genuinely two different axes to browse by, matching
	 * what's already live.
	 */
	const TAG_TAXONOMY = 'sc_event_tag';

	public static function default_categories() {
		return array(
			'Whats On in Carshalton',
			'Whats On in Sutton',
			'Whats On Outside Sutton',
		);
	}

	/** The real 13 terms from EventON's event_type taxonomy on the live site (confirmed via its REST API). */
	public static function default_tags() {
		return array(
			'Comedy', 'Dance', 'Festival', 'Fitness', 'Free Entry', 'Heritage',
			'Music', 'Nature', 'Other', 'Quiz', 'Shopping', 'Suitable for kids', 'Theatre',
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
				'supports'     => array( 'title', 'editor', 'thumbnail', 'author', 'custom-fields', 'comments' ),
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

		register_taxonomy(
			self::TAG_TAXONOMY,
			self::POST_TYPE,
			array(
				'label'        => 'Event Tags',
				'public'       => true,
				'show_in_rest' => true,
				'hierarchical' => false,
				'rewrite'      => array( 'slug' => 'events/tag' ),
			)
		);
	}

	/**
	 * True activation only — see sc-events.php for why the version-checked
	 * seed_categories()/seed_tags() calls also have to run independently
	 * on 'init'.
	 */
	public static function install() {
		self::register();
		self::seed_categories();
		self::seed_tags();
		self::open_comments_on_existing_events();
		flush_rewrite_rules();
	}

	public static function seed_categories() {
		foreach ( self::default_categories() as $category ) {
			if ( ! term_exists( $category, self::TAXONOMY ) ) {
				wp_insert_term( $category, self::TAXONOMY );
			}
		}
	}

	public static function seed_tags() {
		foreach ( self::default_tags() as $tag ) {
			if ( ! term_exists( $tag, self::TAG_TAXONOMY ) ) {
				wp_insert_term( $tag, self::TAG_TAXONOMY );
			}
		}
	}

	/**
	 * Adding 'comments' to the CPT's supports array (done alongside this)
	 * only changes the *default* comment_status new posts get going
	 * forward — WordPress doesn't retroactively touch already-created
	 * rows' stored comment_status. Every sc_event submitted before this
	 * version was inserted with comments implicitly closed, so without
	 * this one-time backfill the comment box would silently 403 on any
	 * event that existed before this feature shipped.
	 */
	public static function open_comments_on_existing_events() {
		$ids = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'meta_query'     => array(
					array(
						'key'     => '_sc_events_comments_backfilled',
						'compare' => 'NOT EXISTS',
					),
				),
			)
		);
		foreach ( $ids as $id ) {
			wp_update_post( array( 'ID' => $id, 'comment_status' => 'open' ) );
			update_post_meta( $id, '_sc_events_comments_backfilled', 1 );
		}
	}
}
