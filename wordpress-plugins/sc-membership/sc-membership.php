<?php
/**
 * Plugin Name: Secret Carshalton — Membership
 * Description: Central member record (points, tiers, directory-upgrade approvals) shared by the directory, events, and comments. Other Secret Carshalton plugins hook into this rather than keeping their own copy of "who's a member."
 * Version: 0.1.0
 * Author: Secret Carshalton
 * Text Domain: sc-membership
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SC_MEMBERSHIP_VERSION', '0.1.0' );
define( 'SC_MEMBERSHIP_DIR', plugin_dir_path( __FILE__ ) );

require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-db.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-tiers.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-points.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-hooks.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-rest.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-admin.php';

register_activation_hook( __FILE__, array( 'SC_Membership_DB', 'install' ) );

/**
 * Uploading a new version over an already-active plugin (our deploy path —
 * see wordpress-plugins/README.md) does NOT re-fire the activation hook,
 * only activating from scratch does. So schema changes need their own
 * version check here, run on every load, rather than living only in
 * register_activation_hook.
 */
add_action(
	'plugins_loaded',
	function () {
		if ( get_option( 'sc_membership_db_version' ) !== SC_MEMBERSHIP_VERSION ) {
			SC_Membership_DB::install();
			update_option( 'sc_membership_db_version', SC_MEMBERSHIP_VERSION );
		}
	}
);

add_action( 'plugins_loaded', array( 'SC_Membership_Hooks', 'init' ) );
add_action( 'rest_api_init', array( 'SC_Membership_REST', 'register_routes' ) );
add_action( 'admin_menu', array( 'SC_Membership_Admin', 'register_menu' ) );
add_action( 'admin_post_sc_membership_review_upgrade', array( 'SC_Membership_Admin', 'handle_review_upgrade' ) );

/**
 * Award (or deduct, with a negative amount) points for a member and
 * recalculate their tier. This is the one entry point every other
 * Secret Carshalton plugin should call — comments, events, directory
 * actions all funnel through here so tier logic lives in one place.
 *
 * @param int    $user_id
 * @param int    $points  Positive to award, negative to deduct.
 * @param string $reason  Short human-readable reason, shown in the member's activity log.
 * @param string $source  Machine tag: 'comment' | 'event_rsvp' | 'directory_claim' | 'manual' | ...
 * @return bool
 */
function sc_membership_award_points( $user_id, $points, $reason, $source = 'manual' ) {
	return SC_Membership_Points::award( $user_id, $points, $reason, $source );
}
