<?php
/**
 * Plugin Name: Secret Carshalton — Events
 * Description: Events. Replaces the EventON data layer with real REST-exposed start/end/venue fields, so the frontend no longer has to scrape schema.org JSON-LD out of rendered HTML to get a date. Hooked into sc-membership for RSVP points.
 * Version: 0.6.0
 * Author: Secret Carshalton
 * Text Domain: sc-events
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SC_EVENTS_VERSION', '0.6.0' );
define( 'SC_EVENTS_DIR', plugin_dir_path( __FILE__ ) );

require_once SC_EVENTS_DIR . 'includes/class-sc-events-cpt.php';
require_once SC_EVENTS_DIR . 'includes/class-sc-events-meta.php';
require_once SC_EVENTS_DIR . 'includes/class-sc-events-rest.php';

register_activation_hook( __FILE__, array( 'SC_Events_CPT', 'install' ) );

add_action( 'init', array( 'SC_Events_CPT', 'register' ) );
add_action( 'init', array( 'SC_Events_Meta', 'register' ) );

/**
 * Deploy path re-uploads new versions over an already-active plugin (see
 * wordpress-plugins/README.md), which never re-fires the activation hook —
 * so anything that needs to run once per version bump (here: seeding the
 * category taxonomy) gets its own version check instead. Hooked on 'init',
 * same as ::register above — NOT 'plugins_loaded'. That distinction is
 * exactly what caused two site-wide outages while building sc-directory:
 * register_post_type()/register_taxonomy() are only safe from 'init' on.
 */
add_action(
	'init',
	function () {
		if ( get_option( 'sc_events_db_version' ) !== SC_EVENTS_VERSION ) {
			SC_Events_CPT::seed_categories();
			SC_Events_CPT::seed_tags();
			SC_Events_CPT::open_comments_on_existing_events();
			update_option( 'sc_events_db_version', SC_EVENTS_VERSION );
		}
	}
);

add_action( 'rest_api_init', array( 'SC_Events_REST', 'register_routes' ) );
