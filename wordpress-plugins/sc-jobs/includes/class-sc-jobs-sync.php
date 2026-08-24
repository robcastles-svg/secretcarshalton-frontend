<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reed's Job Seeker API (https://www.reed.co.uk/developers/jobseeker) —
 * free tier, HTTP Basic Auth with the API key as username and a blank
 * password, no OAuth flow. One search call with a location + radius covers
 * the whole "local" catchment (Carshalton/Sutton/Croydon/Wallington/Cheam
 * all sit within ~8 miles of Carshalton) rather than one call per suburb.
 *
 * Adzuna (App ID + key, richer category/salary filtering) is the brief's
 * named secondary source — deliberately not built yet. Nothing here is
 * Reed-specific at the call site (register_source() below), so adding it
 * later is a second source class + a second entry in SOURCES, not a
 * rewrite of the sync/dedup/expiry logic.
 */
class SC_Jobs_Sync {

	const OPTION_REED_API_KEY   = 'sc_jobs_reed_api_key';
	const OPTION_LOCATION_NAME  = 'sc_jobs_location_name';
	const OPTION_DISTANCE_MILES = 'sc_jobs_distance_miles';
	const OPTION_LAST_SYNC      = 'sc_jobs_last_sync';
	const CRON_HOOK             = 'sc_jobs_sync_reed';

	public static function default_location_name() {
		return 'Carshalton';
	}

	public static function default_distance_miles() {
		return 8;
	}

	public static function init() {
		add_action( self::CRON_HOOK, array( __CLASS__, 'sync_reed' ) );

		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::CRON_HOOK );
		}
	}

	/**
	 * Safe to call with no key set (returns early) — the plugin installs
	 * and the cron is scheduled either way; it's just a no-op until Rob
	 * pastes a real key into the settings screen (SC_Jobs_Admin).
	 */
	public static function sync_reed() {
		$api_key = get_option( self::OPTION_REED_API_KEY );
		if ( ! $api_key ) {
			return array(
				'ok'      => false,
				'message' => 'No Reed API key set.',
			);
		}

		$location_name  = get_option( self::OPTION_LOCATION_NAME, self::default_location_name() );
		$distance_miles = (int) get_option( self::OPTION_DISTANCE_MILES, self::default_distance_miles() );

		$url = add_query_arg(
			array(
				'locationName'         => $location_name,
				'distanceFromLocation' => $distance_miles,
				'resultsToTake'        => 100,
			),
			'https://www.reed.co.uk/api/1.0/search'
		);

		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 20,
				'headers' => array(
					'Authorization' => 'Basic ' . base64_encode( $api_key . ':' ),
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			$result = array( 'ok' => false, 'message' => $response->get_error_message() );
			update_option( self::OPTION_LAST_SYNC, array_merge( $result, array( 'time' => time() ) ) );
			return $result;
		}

		$code = wp_remote_retrieve_response_code( $response );
		if ( 200 !== $code ) {
			$result = array( 'ok' => false, 'message' => 'Reed API returned HTTP ' . $code . '.' );
			update_option( self::OPTION_LAST_SYNC, array_merge( $result, array( 'time' => time() ) ) );
			return $result;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		$jobs = isset( $body['results'] ) && is_array( $body['results'] ) ? $body['results'] : array();

		$created = 0;
		$updated = 0;
		foreach ( $jobs as $job ) {
			$outcome = self::upsert_reed_job( $job );
			if ( 'created' === $outcome ) {
				++$created;
			} elseif ( 'updated' === $outcome ) {
				++$updated;
			}
		}

		self::expire_stale_listings();

		$result = array(
			'ok'      => true,
			'message' => "Synced {$created} new, {$updated} updated.",
			'created' => $created,
			'updated' => $updated,
		);
		update_option( self::OPTION_LAST_SYNC, array_merge( $result, array( 'time' => time() ) ) );
		return $result;
	}

	/**
	 * Matches the brief's "dedup on re-sync (match on external ID or URL,
	 * not just title)" — jobUrl is Reed's stable per-listing URL, so it
	 * doubles as both the external link shown on the frontend and the
	 * dedup key, no separate ID field needed.
	 */
	private static function find_existing_post_id( $external_url ) {
		$existing = get_posts(
			array(
				'post_type'      => SC_Jobs_CPT::POST_TYPE,
				'post_status'    => 'any',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'meta_query'     => array(
					array(
						'key'   => 'external_url',
						'value' => $external_url,
					),
				),
			)
		);
		return $existing ? $existing[0] : 0;
	}

	private static function format_salary( $job ) {
		$min      = isset( $job['minimumSalary'] ) ? $job['minimumSalary'] : null;
		$max      = isset( $job['maximumSalary'] ) ? $job['maximumSalary'] : null;
		$currency = isset( $job['currency'] ) && $job['currency'] ? $job['currency'] : 'GBP';
		$symbol   = 'GBP' === $currency ? '£' : $currency . ' ';
		$period   = ! empty( $job['salaryType'] ) ? ' ' . strtolower( $job['salaryType'] ) : '';

		if ( ! $min && ! $max ) {
			return '';
		}
		if ( $min && $max && $min !== $max ) {
			return $symbol . number_format( (float) $min ) . ' - ' . $symbol . number_format( (float) $max ) . $period;
		}
		return $symbol . number_format( (float) ( $min ?: $max ) ) . $period;
	}

	private static function upsert_reed_job( $job ) {
		if ( empty( $job['jobUrl'] ) || empty( $job['jobTitle'] ) ) {
			return 'skipped';
		}

		$external_url = esc_url_raw( $job['jobUrl'] );
		$post_id      = self::find_existing_post_id( $external_url );

		$postarr = array(
			'post_type'    => SC_Jobs_CPT::POST_TYPE,
			'post_title'   => sanitize_text_field( $job['jobTitle'] ),
			'post_content' => isset( $job['jobDescription'] ) ? wp_kses_post( $job['jobDescription'] ) : '',
			'post_status'  => 'publish',
		);

		if ( $post_id ) {
			$postarr['ID'] = $post_id;
			wp_update_post( $postarr );
			$outcome = 'updated';
		} else {
			$post_id = wp_insert_post( $postarr );
			if ( ! $post_id || is_wp_error( $post_id ) ) {
				return 'skipped';
			}
			$outcome = 'created';
		}

		update_post_meta( $post_id, 'source', 'api' );
		update_post_meta( $post_id, 'external_url', $external_url );
		update_post_meta( $post_id, 'job_company', isset( $job['employerName'] ) ? sanitize_text_field( $job['employerName'] ) : '' );
		update_post_meta( $post_id, 'job_salary_text', self::format_salary( $job ) );

		if ( ! empty( $job['expirationDate'] ) ) {
			$expiry = date( 'Y-m-d', strtotime( $job['expirationDate'] ) );
			update_post_meta( $post_id, 'expiry_date', $expiry );
		}

		if ( ! empty( $job['locationName'] ) ) {
			wp_set_object_terms( $post_id, sanitize_text_field( $job['locationName'] ), SC_Jobs_CPT::LOCATION_TAXONOMY, false );
		}

		return $outcome;
	}

	/**
	 * A stale Reed listing (past its own expirationDate) is unpublished
	 * rather than deleted — same "don't destroy data, just stop showing
	 * it" convention as sc-directory's claim expiry sweep. A future re-sync
	 * that finds the same jobUrl again (Reed relisted it) will republish it
	 * via wp_update_post's post_status => 'publish' in upsert_reed_job.
	 */
	public static function expire_stale_listings() {
		$expired = new WP_Query(
			array(
				'post_type'      => SC_Jobs_CPT::POST_TYPE,
				'post_status'    => 'publish',
				'posts_per_page' => 200,
				'fields'         => 'ids',
				'meta_query'     => array(
					array(
						'key'     => 'expiry_date',
						'value'   => gmdate( 'Y-m-d' ),
						'compare' => '<',
						'type'    => 'DATE',
					),
				),
			)
		);

		foreach ( $expired->posts as $post_id ) {
			wp_update_post( array( 'ID' => $post_id, 'post_status' => 'draft' ) );
		}
	}
}
