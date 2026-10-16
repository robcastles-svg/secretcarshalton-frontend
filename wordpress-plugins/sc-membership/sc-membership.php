<?php
/**
 * Plugin Name: Secret Carshalton — Membership
 * Description: Central member record (points, tiers, directory-upgrade approvals) shared by the directory, events, and comments. Other Secret Carshalton plugins hook into this rather than keeping their own copy of "who's a member."
 * Version: 0.29.2
 * Author: Secret Carshalton
 * Text Domain: sc-membership
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SC_MEMBERSHIP_VERSION', '0.29.2' );
define( 'SC_MEMBERSHIP_DIR', plugin_dir_path( __FILE__ ) );

require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-db.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-tiers.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-points.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-hooks.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-rest.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-admin.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-auth.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-google.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-contact.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-instagram.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-messages.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-activity.php';
require_once SC_MEMBERSHIP_DIR . 'includes/class-sc-membership-admin-alerts.php';

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
add_action( 'plugins_loaded', array( 'SC_Membership_Messages', 'init' ) );
add_action( 'plugins_loaded', array( 'SC_Membership_Activity', 'init' ) );
add_action( 'plugins_loaded', array( 'SC_Membership_Admin_Alerts', 'init' ) );
add_action( 'rest_api_init', array( 'SC_Membership_REST', 'register_routes' ) );
add_action( 'rest_api_init', array( 'SC_Membership_Contact', 'register_routes' ) );
add_action( 'rest_api_init', array( 'SC_Membership_Instagram', 'register_routes' ) );
add_filter( 'get_avatar_url', array( 'SC_Membership_REST', 'filter_default_avatar' ), 20, 3 );

/**
 * Enforces a ban (see SC_Membership_REST::is_banned) — blocks both wp-admin's cookie
 * login and the JWT bridge's login() below, since both call
 * wp_authenticate() and this filter runs inside that.
 */
add_filter(
	'wp_authenticate_user',
	function ( $user, $password ) {
		if ( ! is_wp_error( $user ) && SC_Membership_REST::is_banned( $user->ID ) ) {
			return new WP_Error( 'account_banned', 'This account has been suspended.' );
		}
		return $user;
	},
	30,
	2
);
add_action( 'rest_api_init', array( 'SC_Membership_Auth', 'register_routes' ) );
add_action( 'rest_api_init', array( 'SC_Membership_Google', 'register_routes' ) );
add_action( 'init', array( 'SC_Membership_Google', 'register_settings' ) );
add_action( 'rest_api_init', array( 'SC_Membership_Auth', 'init_bearer_auth' ), 5 );
add_action( 'admin_menu', array( 'SC_Membership_Admin', 'register_menu' ) );

/** wp-admin → Users → a member: when they confirmed the Insider newsletter at sign-up (proof of the double opt-in). */
$sc_newsletter_consent_row = function ( $user ) {
	$at = get_user_meta( $user->ID, 'sc_newsletter_confirmed_at', true );
	if ( ! $at ) {
		return;
	}
	echo '<h2>Insider newsletter</h2><table class="form-table"><tr><th>Double opt-in</th><td>'
		. esc_html( 'Ticked the newsletter box at sign-up, then confirmed their email on ' . get_date_from_gmt( $at, 'j M Y, H:i' ) . '.' )
		. '</td></tr></table>';
};
add_action( 'show_user_profile', $sc_newsletter_consent_row );
add_action( 'edit_user_profile', $sc_newsletter_consent_row );
add_action( 'admin_post_sc_membership_review_upgrade', array( 'SC_Membership_Admin', 'handle_review_upgrade' ) );
add_action( 'admin_post_sc_membership_review_pending_member', array( 'SC_Membership_Admin', 'handle_review_pending_member' ) );
add_action( 'admin_post_sc_membership_scan_pending_members', array( 'SC_Membership_Admin', 'handle_scan_pending_members' ) );
add_action( 'admin_post_sc_membership_backfill_points', array( 'SC_Membership_Admin', 'handle_backfill_points' ) );

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
