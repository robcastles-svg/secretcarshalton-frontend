<?php
/**
 * Plugin Name: Secret Carshalton — Jobs
 * Description: Jobs Board. Phase 1: local job listings synced daily from the Reed API, browsable on the frontend. Member submissions are a planned Phase 2 — the data model (source/featured meta) already anticipates it, not wired up yet.
 * Version: 0.1.0
 * Author: Secret Carshalton
 * Text Domain: sc-jobs
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SC_JOBS_VERSION', '0.1.0' );
define( 'SC_JOBS_DIR', plugin_dir_path( __FILE__ ) );

require_once SC_JOBS_DIR . 'includes/class-sc-jobs-cpt.php';
require_once SC_JOBS_DIR . 'includes/class-sc-jobs-meta.php';
require_once SC_JOBS_DIR . 'includes/class-sc-jobs-sync.php';
require_once SC_JOBS_DIR . 'includes/class-sc-jobs-admin.php';

register_activation_hook( __FILE__, array( 'SC_Jobs_CPT', 'install' ) );
register_deactivation_hook(
	__FILE__,
	function () {
		wp_clear_scheduled_hook( SC_Jobs_Sync::CRON_HOOK );
	}
);

add_action( 'init', array( 'SC_Jobs_CPT', 'register' ) );
add_action( 'init', array( 'SC_Jobs_Meta', 'register' ) );

/**
 * Deploy path re-uploads new versions over an already-active plugin, which
 * never re-fires the activation hook — same version-check-on-init pattern
 * as sc-events/sc-directory, needed here so the rewrite rules for the new
 * /jobs archive actually take effect after a fresh install without a manual
 * Settings > Permalinks resave.
 */
add_action(
	'init',
	function () {
		if ( get_option( 'sc_jobs_db_version' ) !== SC_JOBS_VERSION ) {
			flush_rewrite_rules();
			update_option( 'sc_jobs_db_version', SC_JOBS_VERSION );
		}
	}
);

add_action( 'plugins_loaded', array( 'SC_Jobs_Sync', 'init' ) );
add_action( 'admin_menu', array( 'SC_Jobs_Admin', 'register_menu' ) );
add_action( 'admin_post_sc_jobs_save_settings', array( 'SC_Jobs_Admin', 'handle_save_settings' ) );
add_action( 'admin_post_sc_jobs_sync_now', array( 'SC_Jobs_Admin', 'handle_sync_now' ) );
