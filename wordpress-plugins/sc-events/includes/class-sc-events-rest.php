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

		register_rest_route(
			'sc-events/v1',
			'/submit',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'submit_event' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);
	}

	/** Same pending-for-review model as sc-directory's submit_listing. */
	public static function submit_event( WP_REST_Request $request ) {
		$title = sanitize_text_field( (string) $request->get_param( 'title' ) );
		if ( ! $title ) {
			return new WP_Error( 'missing_title', 'An event title is required.', array( 'status' => 400 ) );
		}

		$start = sanitize_text_field( (string) $request->get_param( 'start' ) );
		if ( ! $start ) {
			return new WP_Error( 'missing_start', 'A start date/time is required.', array( 'status' => 400 ) );
		}

		$user_id = get_current_user_id();

		$post_id = wp_insert_post(
			array(
				'post_type'    => SC_Events_CPT::POST_TYPE,
				'post_status'  => 'pending',
				'post_title'   => $title,
				'post_content' => wp_kses_post( (string) $request->get_param( 'description' ) ),
				'post_author'  => $user_id,
			),
			true
		);

		if ( is_wp_error( $post_id ) ) {
			return new WP_Error( 'submit_failed', $post_id->get_error_message(), array( 'status' => 400 ) );
		}

		$category = sanitize_key( (string) $request->get_param( 'category' ) );
		if ( $category && term_exists( $category, SC_Events_CPT::TAXONOMY ) ) {
			wp_set_object_terms( $post_id, $category, SC_Events_CPT::TAXONOMY );
		}

		$meta = array(
			'sc_start'         => $start,
			'sc_end'           => sanitize_text_field( (string) $request->get_param( 'end' ) ),
			'sc_venue_name'    => sanitize_text_field( (string) $request->get_param( 'venue_name' ) ),
			'sc_venue_address' => sanitize_text_field( (string) $request->get_param( 'venue_address' ) ),
			'sc_organizer'     => sanitize_text_field( (string) $request->get_param( 'organizer' ) ),
			'sc_event_url'     => esc_url_raw( (string) $request->get_param( 'event_url' ) ),
		);
		foreach ( $meta as $key => $value ) {
			update_post_meta( $post_id, $key, $value );
		}

		return array( 'status' => 'pending', 'id' => $post_id );
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
