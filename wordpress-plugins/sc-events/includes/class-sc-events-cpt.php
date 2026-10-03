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
	/**
	 * Reusable organiser profiles (name + address/phone/url/socials as term
	 * meta — see SC_Events_Organizer_Meta) — a real taxonomy rather than
	 * sc_organizer's plain free-text meta field, specifically so "all other
	 * events by this organiser" is a normal term query instead of a
	 * name-matching hack (the trade-off sc_venue_name's own docblock
	 * already flags as future work if venues ever need the same). The
	 * legacy sc_organizer/sc_event_url meta fields stay as the fallback
	 * for events that only ever had plain text.
	 */
	const ORGANIZER_TAXONOMY = 'sc_event_organizer';

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

		register_taxonomy(
			self::ORGANIZER_TAXONOMY,
			self::POST_TYPE,
			array(
				'label'        => 'Event Organisers',
				'public'       => true,
				'show_in_rest' => true,
				'hierarchical' => false,
				'rewrite'      => array( 'slug' => 'events/organiser' ),
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

	/**
	 * Wires every event's legacy sc_organizer/sc_event_url text into a real
	 * sc_event_organizer term — the same taxonomy a fresh submission
	 * attaches to via SC_Events_REST::set_organizer_from_request. Without
	 * this, the ~257 events that existed before that feature shipped would
	 * have no sc_event_organizer_profile, and the frontend's "Organised
	 * By" row would keep linking straight off the site to sc_event_url
	 * instead of an internal organiser page — exactly what Rob flagged.
	 *
	 * Reuses an existing term by name rather than inserting a new one per
	 * event, so e.g. every "Carshalton Jazz" event ends up sharing one
	 * organiser term and showing up on that one organiser page together,
	 * the same cross-linking a fresh submission already gets for free.
	 *
	 * Idempotent via the same "_sc_events_..._backfilled" marker-meta
	 * pattern as open_comments_on_existing_events, so re-running this on
	 * every version bump (not just once) is cheap and safe — an event
	 * someone re-attaches a different organiser to later isn't touched
	 * again, since it already has a term.
	 */
	public static function backfill_organizer_terms() {
		$ids = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'meta_query'     => array(
					array(
						'key'     => '_sc_events_organizer_backfilled',
						'compare' => 'NOT EXISTS',
					),
				),
			)
		);

		foreach ( $ids as $id ) {
			update_post_meta( $id, '_sc_events_organizer_backfilled', 1 );

			$existing = wp_get_post_terms( $id, self::ORGANIZER_TAXONOMY, array( 'fields' => 'ids' ) );
			if ( ! is_wp_error( $existing ) && ! empty( $existing ) ) {
				continue; // Already has a profile — e.g. submitted after the organiser picker shipped.
			}

			$name = trim( (string) get_post_meta( $id, 'sc_organizer', true ) );
			if ( '' === $name ) {
				continue; // Nothing to migrate — this event never had an organiser name at all.
			}

			$term = get_term_by( 'name', $name, self::ORGANIZER_TAXONOMY );
			if ( $term ) {
				$term_id = $term->term_id;
			} else {
				$inserted = wp_insert_term( $name, self::ORGANIZER_TAXONOMY );
				if ( is_wp_error( $inserted ) ) {
					continue;
				}
				$term_id = is_array( $inserted ) ? $inserted['term_id'] : $inserted;

				$url = get_post_meta( $id, 'sc_event_url', true );
				if ( $url ) {
					update_term_meta( $term_id, 'sc_organizer_url', esc_url_raw( $url ) );
				}
			}

			wp_set_object_terms( $id, array( $term_id ), self::ORGANIZER_TAXONOMY );
		}
	}
}
