<?php
/**
 * Plugin Name: Secret Carshalton — Directory
 * Description: Business directory. Replaces Sabai Directory with a REST-first implementation on the same categories/claim/plan model, hooked into sc-membership for claim points and upgrade approval.
 * Version: 0.2.0
 * Author: Secret Carshalton
 * Text Domain: sc-directory
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SC_DIRECTORY_VERSION', '0.2.0' );
define( 'SC_DIRECTORY_DIR', plugin_dir_path( __FILE__ ) );

require_once SC_DIRECTORY_DIR . 'includes/class-sc-directory-cpt.php';
require_once SC_DIRECTORY_DIR . 'includes/class-sc-directory-meta.php';
require_once SC_DIRECTORY_DIR . 'includes/class-sc-directory-rest.php';
require_once SC_DIRECTORY_DIR . 'includes/class-sc-directory-hooks.php';

register_activation_hook( __FILE__, array( 'SC_Directory_CPT', 'install' ) );

add_action( 'init', array( 'SC_Directory_CPT', 'register' ) );

/**
 * See sc-membership.php for why this exists: our deploy path uploads new
 * versions over an already-active plugin, which never re-fires the
 * activation hook, so category seeding needs its own version check that
 * runs on every load instead. Hooked on 'init' (after ::register above,
 * same priority default so it runs second) rather than 'plugins_loaded' —
 * register_post_type()/register_taxonomy() are only safe to call from
 * 'init' onward; calling this earlier caused a site-wide fatal.
 */
add_action(
	'init',
	function () {
		if ( get_option( 'sc_directory_db_version' ) !== SC_DIRECTORY_VERSION ) {
			SC_Directory_CPT::seed_categories();
			update_option( 'sc_directory_db_version', SC_DIRECTORY_VERSION );
		}
	}
);
add_action( 'init', array( 'SC_Directory_Meta', 'register' ) );
add_action( 'rest_api_init', array( 'SC_Directory_REST', 'register_routes' ) );
add_action( 'plugins_loaded', array( 'SC_Directory_Hooks', 'init' ) );
