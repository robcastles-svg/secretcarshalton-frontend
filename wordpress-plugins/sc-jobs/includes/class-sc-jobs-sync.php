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

	/**
	 * Reed's search results only carry a ~450-character plain-text summary
	 * (no paragraphs, cut off with "…"). The full, formatted description
	 * (paragraphs, lists) needs a second call per job to /jobs/{jobId}.
	 * META_FULL marks a job whose post_content is that full version, so a
	 * later search sync doesn't overwrite it with the summary again.
	 * Only jobs posted in the last DETAILS_MAX_AGE_DAYS get it (Rob, Oct
	 * 2026: the latest jobs and every new one from now on, not the whole
	 * backlog); DETAILS_PER_RUN caps the calls per sync. Reed's API is free.
	 */
	const META_FULL       = 'reed_full_description';
	const META_JOB_ID     = 'reed_job_id';
	const DETAILS_PER_RUN      = 40;
	const DETAILS_MAX_AGE_DAYS = 7;
	/** Retired 0.10.0 hourly top-up; only cleared now. */
	const DETAILS_CRON_HOOK = 'sc_jobs_fill_reed_details';
	/** Last Reed details-call problem, for the settings screen / debugging. */
	const OPTION_LAST_DETAIL_ERROR = 'sc_jobs_last_detail_error';

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
		if ( wp_next_scheduled( self::DETAILS_CRON_HOOK ) ) {
			wp_clear_scheduled_hook( self::DETAILS_CRON_HOOK );
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
		delete_option( self::OPTION_LAST_DETAIL_ERROR );
		$filled  = self::fill_full_descriptions( $api_key );
		$problem = get_option( self::OPTION_LAST_DETAIL_ERROR );
		$note    = $problem ? ' Reed stopped the full descriptions early (' . $problem['error'] . ' on job ' . $problem['job'] . '); the rest follow next sync.' : '';

		$result = array(
			'ok'      => true,
			'message' => "Synced {$created} new, {$updated} updated, {$filled} full descriptions fetched.{$note}",
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

	/**
	 * Reed's date/expirationDate fields come back as "dd/mm/yyyy" (UK
	 * format) — PHP's strtotime() guesses at ambiguous strings like
	 * "03/04/2026" as US-format (month first), silently swapping day and
	 * month for anything in the first 12 days of a month. Parsing against
	 * the known format explicitly avoids that instead of guessing.
	 */
	private static function parse_reed_date( $value ) {
		if ( empty( $value ) ) {
			return null;
		}
		$dt = DateTime::createFromFormat( 'd/m/Y', trim( $value ) );
		return $dt ?: null;
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
			'post_type'   => SC_Jobs_CPT::POST_TYPE,
			'post_title'  => sanitize_text_field( $job['jobTitle'] ),
			'post_status' => 'publish',
		);
		// Only the search summary here — and never over a full description
		// fetched earlier (see fill_full_descriptions).
		if ( ! $post_id || ! get_post_meta( $post_id, self::META_FULL, true ) ) {
			$postarr['post_content'] = isset( $job['jobDescription'] ) ? wp_kses_post( $job['jobDescription'] ) : '';
		}

		/**
		 * Reed's own "date" field is when the job was actually posted, not
		 * when we happened to sync it — without this, post_date defaults to
		 * "now" on every insert, so a job Reed posted two weeks ago would
		 * misleadingly show as "Posted today" here, and a "last 7 days"
		 * filter on the frontend would be filtering by sync time rather
		 * than real recency. Set on every upsert (not just create) so a
		 * listing that already exists gets corrected too.
		 */
		$posted = self::parse_reed_date( $job['date'] ?? '' );
		if ( $posted ) {
			$postarr['post_date']     = $posted->format( 'Y-m-d H:i:s' );
			$postarr['post_date_gmt'] = $posted->format( 'Y-m-d H:i:s' );
		}

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
		if ( ! empty( $job['jobId'] ) ) {
			update_post_meta( $post_id, self::META_JOB_ID, (int) $job['jobId'] );
		}
		update_post_meta( $post_id, 'job_company', isset( $job['employerName'] ) ? sanitize_text_field( $job['employerName'] ) : '' );
		update_post_meta( $post_id, 'job_salary_text', self::format_salary( $job ) );

		$expiry = self::parse_reed_date( $job['expirationDate'] ?? '' );
		if ( $expiry ) {
			update_post_meta( $post_id, 'expiry_date', $expiry->format( 'Y-m-d' ) );
		}

		if ( ! empty( $job['locationName'] ) ) {
			wp_set_object_terms( $post_id, sanitize_text_field( $job['locationName'] ), SC_Jobs_CPT::LOCATION_TAXONOMY, false );
		}

		return $outcome;
	}

	/**
	 * Replaces the search summary with Reed's full, formatted description
	 * for up to DETAILS_PER_RUN published Reed jobs that don't have it yet,
	 * newest first. Jobs synced before reed_job_id was stored get their id
	 * from the jobUrl (Reed's URLs end in the numeric job id). Returns how
	 * many were filled.
	 */
	public static function fill_full_descriptions( $api_key ) {
		$todo = get_posts(
			array(
				'post_type'      => SC_Jobs_CPT::POST_TYPE,
				'post_status'    => 'publish',
				'posts_per_page' => self::DETAILS_PER_RUN,
				'orderby'        => 'date',
				'order'          => 'DESC',
				'fields'         => 'ids',
				'date_query'     => array(
					array( 'after' => self::DETAILS_MAX_AGE_DAYS . ' days ago' ),
				),
				'meta_query'     => array(
					array( 'key' => 'source', 'value' => 'api' ),
					array( 'key' => self::META_FULL, 'compare' => 'NOT EXISTS' ),
				),
			)
		);

		$filled = 0;
		foreach ( $todo as $post_id ) {
			$job_id = (int) get_post_meta( $post_id, self::META_JOB_ID, true );
			if ( ! $job_id && preg_match( '#/(\d{5,})(?:[/?#]|$)#', (string) get_post_meta( $post_id, 'external_url', true ), $m ) ) {
				$job_id = (int) $m[1];
				update_post_meta( $post_id, self::META_JOB_ID, $job_id );
			}
			if ( ! $job_id ) {
				update_post_meta( $post_id, self::META_FULL, 'none' ); // No id to look up; don't retry every run.
				continue;
			}

			$response = wp_remote_get(
				'https://www.reed.co.uk/api/1.0/jobs/' . $job_id,
				array(
					'timeout' => 10,
					'headers' => array( 'Authorization' => 'Basic ' . base64_encode( $api_key . ':' ) ),
				)
			);
			if ( is_wp_error( $response ) ) {
				update_option( self::OPTION_LAST_DETAIL_ERROR, array( 'time' => time(), 'job' => $job_id, 'error' => $response->get_error_message() ), false );
				break; // Network trouble: try the rest next run.
			}
			$code = wp_remote_retrieve_response_code( $response );
			if ( 200 !== $code ) {
				update_option( self::OPTION_LAST_DETAIL_ERROR, array( 'time' => time(), 'job' => $job_id, 'error' => 'HTTP ' . $code ), false );
			}
			if ( 404 === $code ) {
				update_post_meta( $post_id, self::META_FULL, 'none' ); // Gone from Reed; keep the summary.
				continue;
			}
			if ( 200 !== $code ) {
				break; // Rate limit or outage: try again next run.
			}

			$detail = json_decode( wp_remote_retrieve_body( $response ), true );
			$html   = isset( $detail['jobDescription'] ) ? trim( (string) $detail['jobDescription'] ) : '';
			if ( '' === $html ) {
				update_post_meta( $post_id, self::META_FULL, 'none' );
				continue;
			}
			wp_update_post(
				array(
					'ID'           => $post_id,
					'post_content' => wp_kses_post( $html ),
				)
			);
			update_post_meta( $post_id, self::META_FULL, '1' );
			++$filled;
		}
		return $filled;
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
