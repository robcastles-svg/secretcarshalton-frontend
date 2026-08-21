<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface the Next.js frontend talks to for the member dashboard.
 * Namespace: sc-membership/v1
 */
class SC_Membership_REST {

	public static function register_routes() {
		register_rest_route(
			'sc-membership/v1',
			'/me',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_me' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/directory-upgrade-request',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'request_directory_upgrade' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/leaderboard',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_leaderboard' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public static function get_me( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		$member  = SC_Membership_DB::get_or_create_member( $user_id );
		$tier    = SC_Membership_Tiers::get( $member->tier );
		$next    = SC_Membership_Tiers::points_to_next_tier( (int) $member->points );

		return array(
			'email_verified'           => SC_Membership_Auth::is_verified( $user_id ),
			'points'                   => (int) $member->points,
			'tier'                     => array(
				'slug'  => $tier['slug'],
				'label' => $tier['label'],
			),
			'points_to_next_tier'      => $next ? $next['points'] : null,
			'next_tier'                => $next ? array(
				'slug'  => $next['tier']['slug'],
				'label' => $next['tier']['label'],
			) : null,
			'directory_upgrade_status' => $member->directory_upgrade_status,
			'directory_upgrade_listing_id' => $member->directory_upgrade_listing_id ? (int) $member->directory_upgrade_listing_id : null,
			'joined_at'                => $member->joined_at,
			'recent_activity'          => array_map(
				function ( $entry ) {
					return array(
						'points' => (int) $entry->points_delta,
						'reason' => $entry->reason,
						'source' => $entry->source,
						'date'   => $entry->created_at,
					);
				},
				SC_Membership_Points::recent_activity( $user_id, 10 )
			),
		);
	}

	public static function request_directory_upgrade( WP_REST_Request $request ) {
		$user_id    = get_current_user_id();
		$member     = SC_Membership_DB::get_or_create_member( $user_id );
		$listing_id = $request->get_param( 'listing_id' ) ? (int) $request->get_param( 'listing_id' ) : null;

		if ( 'pending' === $member->directory_upgrade_status ) {
			return new WP_Error( 'already_pending', 'An upgrade request is already pending review.', array( 'status' => 409 ) );
		}

		do_action( 'sc_directory_upgrade_requested', $user_id, $listing_id );

		return array( 'status' => 'pending' );
	}

	public static function get_leaderboard( WP_REST_Request $request ) {
		global $wpdb;
		$table = SC_Membership_DB::members_table();

		$rows = $wpdb->get_results(
			"SELECT user_id, points, tier FROM {$table} ORDER BY points DESC LIMIT 10" // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		);

		return array_map(
			function ( $row ) {
				$user = get_userdata( $row->user_id );
				$tier = SC_Membership_Tiers::get( $row->tier );
				return array(
					'display_name' => $user ? $user->display_name : 'Member',
					'points'       => (int) $row->points,
					'tier'         => $tier ? $tier['label'] : $row->tier,
				);
			},
			$rows
		);
	}
}
