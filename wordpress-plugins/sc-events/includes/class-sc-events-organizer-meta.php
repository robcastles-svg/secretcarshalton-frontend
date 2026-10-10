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

	/**
	 * The organiser's "about" text is the term's own built-in description,
	 * not a meta field — core already stores, sanitises and REST-exposes it.
	 *
	 * sc_organizer_socials is the old comma-separated list, kept as-is for
	 * migration into the separate per-network fields below; nothing new
	 * should write to it.
	 */
	const FIELDS = array(
		'sc_organizer_address'   => 'string',
		'sc_organizer_phone'     => 'string',
		'sc_organizer_url'       => 'string',
		'sc_organizer_socials'   => 'string',
		'sc_organizer_email'     => 'string',
		/** Media library attachment ID. */
		'sc_organizer_logo'      => 'integer',
		'sc_organizer_facebook'  => 'string',
		'sc_organizer_instagram' => 'string',
		'sc_organizer_x'         => 'string',
		'sc_organizer_tiktok'    => 'string',
	);

	/** Fields that hold a web address — an email typed into one is dropped, see SC_Events_Meta::sanitize_web_url. */
	const URL_FIELDS = array(
		'sc_organizer_url',
		'sc_organizer_facebook',
		'sc_organizer_instagram',
		'sc_organizer_x',
		'sc_organizer_tiktok',
	);

	public static function sanitizer_for( $key ) {
		if ( in_array( $key, self::URL_FIELDS, true ) ) {
			return array( 'SC_Events_Meta', 'sanitize_web_url' );
		}
		if ( 'sc_organizer_email' === $key ) {
			return 'sanitize_email';
		}
		if ( 'sc_organizer_logo' === $key ) {
			return 'absint';
		}
		return 'sanitize_text_field';
	}

	public static function register() {
		foreach ( self::FIELDS as $key => $type ) {
			register_term_meta(
				SC_Events_CPT::ORGANIZER_TAXONOMY,
				$key,
				array(
					'type'              => $type,
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => self::sanitizer_for( $key ),
					'auth_callback'     => function () {
						return current_user_can( 'manage_options' );
					},
				)
			);
		}
	}

	/** Logo attachment ID → URL (medium size), or '' when none/missing. */
	public static function logo_url( $term_id ) {
		$logo_id = (int) get_term_meta( $term_id, 'sc_organizer_logo', true );
		if ( ! $logo_id ) {
			return '';
		}
		$url = wp_get_attachment_image_url( $logo_id, 'medium' );
		return $url ? $url : '';
	}
}
