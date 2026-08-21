<?php
/**
 * Plugin Name: Secret Carshalton — Directory
 * Description: Business directory. Replaces Sabai Directory with a REST-first implementation on the same categories/claim/plan model, hooked into sc-membership for claim points and upgrade approval.
 * Version: 0.1.0
 * Author: Secret Carshalton
 * Text Domain: sc-directory
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SC_DIRECTORY_VERSION', '0.1.0' );
define( 'SC_DIRECTORY_DIR', plugin_dir_path( __FILE__ ) );

require_once SC_DIRECTORY_DIR . 'includes/class-sc-directory-cpt.php';
require_once SC_DIRECTORY_DIR . 'includes/class-sc-directory-meta.php';
require_once SC_DIRECTORY_DIR . 'includes/class-sc-directory-rest.php';
require_once SC_DIRECTORY_DIR . 'includes/class-sc-directory-hooks.php';

register_activation_hook( __FILE__, array( 'SC_Directory_CPT', 'install' ) );

add_action( 'init', array( 'SC_Directory_CPT', 'register' ) );
add_action( 'init', array( 'SC_Directory_Meta', 'register' ) );
add_action( 'rest_api_init', array( 'SC_Directory_REST', 'register_routes' ) );
add_action( 'plugins_loaded', array( 'SC_Directory_Hooks', 'init' ) );
