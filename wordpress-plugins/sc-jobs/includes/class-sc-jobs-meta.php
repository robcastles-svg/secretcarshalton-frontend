<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The brief's data model calls for source/featured/expiry_date/external_url.
 * job_company and job_salary_text are added beyond that spec — without them
 * a card is just a bare title/link, and Reed's API already hands both over
 * for free on every result (see SC_Jobs_Sync::map_reed_result). Same
 * REST-from-day-one approach as SC_Events_Meta/SC_Directory_Meta.
 */
class SC_Jobs_Meta {

	const FIELDS = array(
		/** 'api' (Reed sync) or 'member' (future submission form) — member listings aren't wired up yet, but every read/write path already branches on this so that phase is additive. */
		'source'          => 'string',
		/** Paid-upgrade flag, reserved for a future tier — same "exposed to REST, admin-set only" pattern as sc_directory's sc_featured / sc_events' sc_event_featured. Never touched by the sync. */
		'featured'        => 'boolean',
		'expiry_date'     => 'string',
		/** For API-sourced listings: the original posting to link/apply through. Also this plugin's dedup key on re-sync (see SC_Jobs_Sync::find_existing_post_id) — matching on this rather than title, per the brief. */
		'external_url'    => 'string',
		'job_company'     => 'string',
		'job_salary_text' => 'string',
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

			if ( 'external_url' === $key ) {
				$args['sanitize_callback'] = 'esc_url_raw';
			} elseif ( 'string' === $type ) {
				$args['sanitize_callback'] = 'sanitize_text_field';
			}

			register_post_meta( SC_Jobs_CPT::POST_TYPE, $key, $args );
		}
	}
}
