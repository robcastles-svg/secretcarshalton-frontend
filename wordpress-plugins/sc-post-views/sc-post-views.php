<?php
/**
 * Plugin Name: Secret Carshalton — Post Views
 * Description: Our own view-counting store, keyed by post ID with a daily bucket per post — lets the frontend show a real view count plus genuinely time-windowed "top posts today/this week" without the third-party Post Views Counter plugin's REST API, which only ever returns one post's all-time total per request. Runs on staging even though the posts themselves live on the production site — same pattern already used for comments (see sc-membership's submit_comment): the numeric post ID from the production site is just an arbitrary key here, no relationship to any post actually stored on this install.
 * Version: 0.5.1
 * Author: Secret Carshalton
 * Text Domain: sc-post-views
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SC_POST_VIEWS_VERSION', '0.5.1' );
define( 'SC_POST_VIEWS_DIR', plugin_dir_path( __FILE__ ) );

require_once SC_POST_VIEWS_DIR . 'includes/class-sc-post-views-db.php';
require_once SC_POST_VIEWS_DIR . 'includes/class-sc-post-views-rest.php';
require_once SC_POST_VIEWS_DIR . 'includes/class-sc-post-views-admin.php';

register_activation_hook( __FILE__, array( 'SC_Post_Views_DB', 'install' ) );

/**
 * Uploading a new version over an already-active plugin (our deploy path)
 * does NOT re-fire the activation hook — see sc-membership's identical
 * comment on this. Schema changes need their own version check on every
 * load instead.
 */
add_action(
	'plugins_loaded',
	function () {
		if ( get_option( 'sc_post_views_db_version' ) !== SC_POST_VIEWS_VERSION ) {
			SC_Post_Views_DB::install();
			update_option( 'sc_post_views_db_version', SC_POST_VIEWS_VERSION );
		}
	}
);

add_action( 'rest_api_init', array( 'SC_Post_Views_REST', 'register_routes' ) );
add_action( 'admin_menu', array( 'SC_Post_Views_Admin', 'register_menu' ) );
add_action( 'admin_post_sc_post_views_backfill_batch', array( 'SC_Post_Views_Admin', 'handle_backfill_batch' ) );

/** One-time: give every existing event its 10-view starting baseline (see EVENT_LISTING_BASELINE_VIEWS). */
add_action(
	'plugins_loaded',
	function () {
		if ( ! get_option( 'sc_post_views_event_listing_baseline_seeded' ) ) {
			SC_Post_Views_DB::seed_event_listing_baselines();
			update_option( 'sc_post_views_event_listing_baseline_seeded', '1' );
		}
	}
);

/**
 * One-time cleanup: sc_listing was briefly in EVENT_LISTING_POST_TYPES (so
 * the seed above once gave every listing a synthetic 10-view baseline too)
 * — Rob wants listings showing only real views, no synthetic floor, so this
 * removes those rows. See remove_listing_baselines()'s own docblock.
 */
add_action(
	'plugins_loaded',
	function () {
		if ( ! get_option( 'sc_post_views_listing_baseline_removed' ) ) {
			SC_Post_Views_DB::remove_listing_baselines();
			update_option( 'sc_post_views_listing_baseline_removed', '1' );
		}
	}
);

/**
 * Listings' real view history from the old Sabai directory (see
 * seed_listing_live_baselines()), plus removing the article views that
 * were misfiled against two listings. Runs once per value of
 * SC_POST_VIEWS_LISTING_SEED, which should match the "generated" date in
 * data/listing-baselines.json: bump both when uploading a regenerated
 * file and the seed re-runs. The baseline upsert runs first and
 * re-stamps each baseline row with the listing's own slug, so the
 * cleanup can't delete it.
 */
define( 'SC_POST_VIEWS_LISTING_SEED', '2026-10-11' );
add_action(
	'init',
	function () {
		if ( get_option( 'sc_post_views_listing_live_seed' ) === SC_POST_VIEWS_LISTING_SEED ) {
			return;
		}
		SC_Post_Views_DB::seed_listing_live_baselines();
		SC_Post_Views_DB::remove_misfiled_article_views();
		update_option( 'sc_post_views_listing_live_seed', SC_POST_VIEWS_LISTING_SEED );
	},
	20
);

/** Same pattern for the re-created articles (see seed_article_live_baselines() and data/article-baselines.json). */
define( 'SC_POST_VIEWS_ARTICLE_SEED', '2026-10-11' );
add_action(
	'init',
	function () {
		if ( get_option( 'sc_post_views_article_live_seed' ) === SC_POST_VIEWS_ARTICLE_SEED ) {
			return;
		}
		SC_Post_Views_DB::seed_article_live_baselines();
		update_option( 'sc_post_views_article_live_seed', SC_POST_VIEWS_ARTICLE_SEED );
	},
	20
);

/** Same baseline for every event published from now on, not just the ones that already existed. */
add_action(
	'transition_post_status',
	function ( $new_status, $old_status, $post ) {
		if ( 'publish' !== $new_status || 'publish' === $old_status ) {
			return;
		}
		if ( in_array( $post->post_type, SC_Post_Views_DB::EVENT_LISTING_POST_TYPES, true ) ) {
			SC_Post_Views_DB::ensure_event_listing_baseline( $post->ID );
		}
	},
	10,
	3
);
