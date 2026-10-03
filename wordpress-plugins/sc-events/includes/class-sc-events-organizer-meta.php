<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Term meta for the sc_event_organizer taxonomy — the structured profile
 * (address/phone/url/socials) behind a reusable organiser. Members never
 * write this through WordPress's own REST meta auth (they have no
 * manage_categories capability to create or edit a term at all); it's set
 * on their behalf by SC_Events_REST::set_organizer_from_request, which
 * calls update_term_meta() directly in PHP — the same "the REST layer
 * trusts its own validation, not the submitter's WP capabilities" pattern
 * the rest of this plugin already uses for post_author and listing_id.
 * auth_callback here only gates the generic wp-admin/REST meta editing
 * core exposes once a term exists.
 */
class SC_Events_Organizer_Meta {

	const FIELDS = array(
		'sc_organizer_address' => 'string',
		'sc_organizer_phone'   => 'string',
		'sc_organizer_url'     => 'string',
		'sc_organizer_socials' => 'string',
	);

	public static function register() {
		foreach ( self::FIELDS as $key => $type ) {
			register_term_meta(
				SC_Events_CPT::ORGANIZER_TAXONOMY,
				$key,
				array(
					'type'              => $type,
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'sc_organizer_url' === $key ? 'esc_url_raw' : 'sanitize_text_field',
					'auth_callback'     => function () {
						return current_user_can( 'manage_options' );
					},
				)
			);
		}
	}
}
