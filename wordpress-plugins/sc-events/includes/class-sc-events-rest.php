<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The one action beyond plain post editing: RSVP. Fires sc_events_rsvp,
 * which sc-membership already listens for (5 points per RSVP) — see
 * SC_Membership_Hooks::on_event_rsvp, wired up before this plugin existed.
 */
class SC_Events_REST {

	public static function register_routes() {
		register_rest_route(
			'sc-events/v1',
			'/(?P<id>\d+)/rsvp',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'rsvp' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);
	}

	public static function rsvp( WP_REST_Request $request ) {
		$event_id = (int) $request->get_param( 'id' );
		$event    = get_post( $event_id );

		if ( ! $event || SC_Events_CPT::POST_TYPE !== $event->post_type ) {
			return new WP_Error( 'not_found', 'Event not found.', array( 'status' => 404 ) );
		}

		$user_id = get_current_user_id();

		do_action( 'sc_events_rsvp', $user_id, $event_id );

		return array( 'status' => 'rsvpd' );
	}
}
