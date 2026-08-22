<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Start/end/venue as real registered meta, REST-exposed from day one —
 * the whole point of replacing EventON's data layer. sc_start and sc_end
 * are ISO 8601 strings so the frontend can pass them straight to `new
 * Date()` instead of parsing schema.org markup.
 */
class SC_Events_Meta {

	const FIELDS = array(
		'sc_start'         => 'string',
		'sc_end'           => 'string',
		'sc_venue_name'    => 'string',
		'sc_venue_address' => 'string',
		'sc_organizer'     => 'string',
		'sc_event_url'     => 'string',
		/**
		 * The sc-listings post ID of the business/organisation this event
		 * belongs to — distinct from post_author (a WP *user* account).
		 * "Submitted by [member]" was never the right public-facing credit
		 * for an event a business owns; this is what "Hosted by [company]"
		 * on the frontend actually reads from. Only ever set through
		 * SC_Events_REST::set_taxonomies_from_request's sibling validation
		 * (must be a listing the current user owns) — see update_event's
		 * docblock — never accepted at face value from the request.
		 */
		'sc_event_listing_id' => 'integer',
	);

	public static function register() {
		foreach ( self::FIELDS as $key => $type ) {
			$args = array(
				'type'          => $type,
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function ( $allowed, $meta_key, $post_id ) {
					return current_user_can( 'edit_post', $post_id );
				},
			);

			if ( 'sc_event_url' === $key ) {
				$args['sanitize_callback'] = 'esc_url_raw';
			} elseif ( 'string' === $type ) {
				$args['sanitize_callback'] = 'sanitize_text_field';
			} elseif ( 'integer' === $type ) {
				$args['sanitize_callback'] = 'absint';
			}

			register_post_meta( SC_Events_CPT::POST_TYPE, $key, $args );
		}
	}
}
