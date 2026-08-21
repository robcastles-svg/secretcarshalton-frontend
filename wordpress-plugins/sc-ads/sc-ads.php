<?php
/**
 * Plugin Name: Secret Carshalton — Ads
 * Description: Admin-manageable ad slots (billboard, leaderboard, sidebar, in-article) — no code editing needed to change a creative. Replaces the hardcoded ad images in the Next.js layout.
 * Version: 0.1.0
 * Author: Secret Carshalton
 * Text Domain: sc-ads
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SC_ADS_VERSION', '0.1.0' );
define( 'SC_ADS_DIR', plugin_dir_path( __FILE__ ) );

require_once SC_ADS_DIR . 'includes/class-sc-ads-cpt.php';
require_once SC_ADS_DIR . 'includes/class-sc-ads-meta.php';
require_once SC_ADS_DIR . 'includes/class-sc-ads-metabox.php';
require_once SC_ADS_DIR . 'includes/class-sc-ads-rest.php';

register_activation_hook( __FILE__, array( 'SC_Ads_CPT', 'install' ) );

add_action( 'init', array( 'SC_Ads_CPT', 'register' ) );
add_action( 'init', array( 'SC_Ads_Meta', 'register' ) );
add_action( 'add_meta_boxes', array( 'SC_Ads_Metabox', 'register' ) );
add_action( 'save_post_' . SC_Ads_CPT::POST_TYPE, array( 'SC_Ads_Metabox', 'save' ) );
add_action( 'rest_api_init', array( 'SC_Ads_REST', 'register_routes' ) );
