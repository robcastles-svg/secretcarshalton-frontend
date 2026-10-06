<?php
/**
 * Plugin Name: Secret Carshalton — Ads
 * Description: Admin-manageable, weighted-random-rotating ad zones (billboard, leaderboard, sidebar, two in-article slots) with click tracking — mirrors the live site's former AdRotate zone structure. No code editing needed to change a creative.
 * Version: 0.9.5
 * Author: Secret Carshalton
 * Text Domain: sc-ads
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SC_ADS_VERSION', '0.9.5' );
define( 'SC_ADS_DIR', plugin_dir_path( __FILE__ ) );

require_once SC_ADS_DIR . 'includes/class-sc-ads-cpt.php';
require_once SC_ADS_DIR . 'includes/class-sc-ads-meta.php';
require_once SC_ADS_DIR . 'includes/class-sc-ads-metabox.php';
require_once SC_ADS_DIR . 'includes/class-sc-ads-rest.php';
require_once SC_ADS_DIR . 'includes/class-sc-ads-paypal-settings.php';
require_once SC_ADS_DIR . 'includes/class-sc-ads-paypal.php';
require_once SC_ADS_DIR . 'includes/class-sc-ads-paypal-rest.php';

register_activation_hook( __FILE__, array( 'SC_Ads_CPT', 'install' ) );

add_action( 'init', array( 'SC_Ads_CPT', 'register' ) );
add_action( 'init', array( 'SC_Ads_Meta', 'register' ) );
add_action( 'add_meta_boxes', array( 'SC_Ads_Metabox', 'register' ) );
add_action( 'save_post_' . SC_Ads_CPT::POST_TYPE, array( 'SC_Ads_Metabox', 'save' ) );
add_action( 'rest_api_init', array( 'SC_Ads_REST', 'register_routes' ) );
add_action( 'rest_api_init', array( 'SC_Ads_PayPal_REST', 'register_routes' ) );
add_action( 'admin_menu', array( 'SC_Ads_PayPal_Settings', 'register_menu' ) );
add_action( 'admin_post_sc_ads_paypal_setup_webhook', array( 'SC_Ads_PayPal_Settings', 'handle_setup_webhook' ) );
