<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Phase 2 of the brief: member-submitted job listings alongside the
 * Reed-synced ones. Same CPT and 'source' meta the sync already writes
 * ('api' vs 'member' — see SC_Jobs_Meta's docblock, which anticipated
 * exactly this) — always lands as 'pending', the same draft → human
 * approval → publish model every other submission path in this codebase
 * already uses (directory listings, events, ads).
 */
class SC_Jobs_REST {

	public static function register_routes() {
		register_rest_route(
			'sc-jobs/v1',
			'/submit',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'submit_job' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-jobs/v1',
			'/mine',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_my_jobs' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);
	}

	public static function submit_job( WP_REST_Request $request ) {
		$title = sanitize_text_field( (string) $request->get_param( 'title' ) );
		if ( ! $title ) {
			return new WP_Error( 'missing_title', 'A job title is required.', array( 'status' => 400 ) );
		}

		$salary_amount = round( (float) $request->get_param( 'salary_amount' ), 2 );
		$salary_period = 'year' === $request->get_param( 'salary_period' ) ? 'year' : 'hour';
		if ( $salary_amount <= 0 ) {
			return new WP_Error( 'missing_salary', 'Please enter the pay for this job.', array( 'status' => 400 ) );
		}

		$post_id = wp_insert_post(
			array(
				'post_type'    => SC_Jobs_CPT::POST_TYPE,
				'post_status'  => 'pending',
				'post_title'   => $title,
				'post_content' => wp_kses_post( (string) $request->get_param( 'description' ) ),
				'post_author'  => get_current_user_id(),
			),
			true
		);

		if ( is_wp_error( $post_id ) ) {
			return new WP_Error( 'submit_failed', $post_id->get_error_message(), array( 'status' => 400 ) );
		}

		update_post_meta( $post_id, 'source', 'member' );
		update_post_meta( $post_id, 'job_company', sanitize_text_field( (string) $request->get_param( 'company' ) ) );
		update_post_meta( $post_id, 'job_salary_amount', $salary_amount );
		update_post_meta( $post_id, 'job_salary_period', $salary_period );
		update_post_meta( $post_id, 'job_salary_text', self::salary_text( $salary_amount, $salary_period ) );
		// Decided here from the pay entered, never taken from the form.
		update_post_meta( $post_id, 'job_rate_bracket', self::rate_bracket( self::annual_salary( $salary_amount, $salary_period ) ) );
		// Stays 'pending' until paid for through the site's checkout (see
		// payment_products below), which publishes it for 7 days.
		update_post_meta( $post_id, 'payment_status', 'pending' );

		// The form accepts either a link or a plain email address ("how to
		// apply") — is_email() catches the latter and gets a mailto: prefix
		// so it renders as a working link rather than a broken bare-email href.
		$apply_url = trim( (string) $request->get_param( 'apply_url' ) );
		if ( $apply_url ) {
			if ( is_email( $apply_url ) ) {
				$apply_url = 'mailto:' . $apply_url;
			}
			update_post_meta( $post_id, 'external_url', esc_url_raw( $apply_url ) );
		}

		do_action( 'sc_jobs_job_submitted', $post_id );

		$band = self::RATE_BRACKETS[ get_post_meta( $post_id, 'job_rate_bracket', true ) ] ?? null;
		return array(
			'id'     => $post_id,
			'status' => 'pending',
			'price'  => $band ? $band[1] : '',
		);
	}

	/**
	 * Job posts are priced on annual pay; an hourly rate is converted at
	 * 37.5 hours × 52 weeks. Must match HOURS_PER_YEAR, jobRateBracket and
	 * formatJobSalary in lib/pricing.ts (kept by hand on both sides, like
	 * the other prices).
	 */
	const HOURS_PER_YEAR = 1950;

	/** Bracket slug => [label, price], for the wp-admin metabox. */
	const RATE_BRACKETS = array(
		'under_30k'  => array( 'Under £30,000 a year', '£15' ),
		'30k_to_40k' => array( '£30,000–£40,000 a year', '£20' ),
		'over_40k'   => array( 'Over £40,000 a year', '£40' ),
	);

	public static function annual_salary( $amount, $period ) {
		return 'hour' === $period ? $amount * self::HOURS_PER_YEAR : $amount;
	}

	public static function rate_bracket( $annual ) {
		if ( $annual < 30000 ) {
			return 'under_30k';
		}
		return $annual <= 40000 ? '30k_to_40k' : 'over_40k';
	}

	private static function pounds( $n ) {
		return '£' . number_format( $n, floor( $n ) == $n ? 0 : 2 );
	}

	/** "£18 per hour (about £35,100 a year)" / "£30,000 a year (about £15.38 per hour)". */
	public static function salary_text( $amount, $period ) {
		if ( 'hour' === $period ) {
			return self::pounds( $amount ) . ' per hour (about ' . self::pounds( round( $amount * self::HOURS_PER_YEAR ) ) . ' a year)';
		}
		return self::pounds( $amount ) . ' a year (about ' . self::pounds( round( $amount / self::HOURS_PER_YEAR, 2 ) ) . ' per hour)';
	}

	const LIVE_DAYS = 7;

	/** Pounds charged per band; older submissions may carry the retired hourly bands. */
	const BAND_PRICES = array(
		'under_30k'  => 15,
		'30k_to_40k' => 20,
		'over_40k'   => 40,
		'up_to_15'   => 15,
		'15_to_20'   => 20,
		'over_20'    => 40,
	);

	/**
	 * A member's job on the site's shared checkout (SC_Ads_Payments): paid
	 * for after submitting, it goes live straight away for LIVE_DAYS days
	 * (SC_Jobs_Sync's daily sweep unpublishes it once expiry_date passes).
	 */
	public static function payment_products( $products ) {
		$products['job'] = array(
			'label'    => 'Job post',
			'title'    => 'get_the_title',
			'edit_url' => function ( $id ) {
				return admin_url( 'post.php?post=' . (int) $id . '&action=edit' );
			},
			'can_pay'  => function ( $id, $user_id, $stage ) {
				$job = get_post( $id );
				if ( ! $job || SC_Jobs_CPT::POST_TYPE !== $job->post_type || 'member' !== get_post_meta( $id, 'source', true ) ) {
					return new WP_Error( 'not_found', 'Job not found.', array( 'status' => 404 ) );
				}
				if ( (int) $job->post_author !== (int) $user_id ) {
					return new WP_Error( 'not_owner', 'You can only pay for your own job posts.', array( 'status' => 403 ) );
				}
				if ( 'start' === $stage && 'paid' === get_post_meta( $id, 'payment_status', true ) && 'publish' === $job->post_status ) {
					return new WP_Error( 'already_paid', 'This job is already paid for and live.', array( 'status' => 400 ) );
				}
				return true;
			},
			'price'    => function ( $id ) {
				$price = self::BAND_PRICES[ get_post_meta( $id, 'job_rate_bracket', true ) ] ?? null;
				if ( null === $price ) {
					return new WP_Error( 'no_price', "This job has no pay band, so it can't be priced — please contact us.", array( 'status' => 400 ) );
				}
				return array( $price, 'Secret Carshalton job post: ' . get_the_title( $id ) . ' (' . self::LIVE_DAYS . ' days)' );
			},
			'on_paid'  => function ( $id, $payment_id ) {
				$until = wp_date( 'Y-m-d', strtotime( '+' . self::LIVE_DAYS . ' days' ) );
				update_post_meta( $id, 'payment_status', 'paid' );
				update_post_meta( $id, 'amount_paid', '£' . get_post_meta( $payment_id, 'amount', true ) );
				update_post_meta( $id, 'expiry_date', $until );
				wp_update_post( array( 'ID' => $id, 'post_status' => 'publish' ) );
				update_post_meta( $payment_id, 'note', 'Live until ' . wp_date( 'j F Y', strtotime( $until ) ) . '.' );
				return array(
					'slug'  => get_post_field( 'post_name', $id ),
					'until' => $until,
				);
			},
			'undo'     => function ( $id ) {
				wp_update_post( array( 'ID' => $id, 'post_status' => 'draft' ) );
				return 'The job is unpublished.';
			},
		);
		return $products;
	}

	/** The dashboard's "Your jobs" section. */
	public static function get_my_jobs( WP_REST_Request $request ) {
		$posts = get_posts(
			array(
				'post_type'      => SC_Jobs_CPT::POST_TYPE,
				'author'         => get_current_user_id(),
				'post_status'    => array( 'publish', 'pending', 'draft' ),
				'posts_per_page' => 50,
				'orderby'        => 'date',
				'order'          => 'DESC',
			)
		);

		return array_map(
			function ( $post ) {
				return array(
					'id'            => $post->ID,
					'title'         => get_the_title( $post ),
					'status'        => $post->post_status,
					'slug'          => $post->post_name,
					'date'          => $post->post_date,
					'company'       => get_post_meta( $post->ID, 'job_company', true ),
					'paymentStatus' => get_post_meta( $post->ID, 'payment_status', true ),
					'price'         => isset( self::BAND_PRICES[ get_post_meta( $post->ID, 'job_rate_bracket', true ) ] ) ? '£' . self::BAND_PRICES[ get_post_meta( $post->ID, 'job_rate_bracket', true ) ] : '',
					'expiresOn'     => (string) get_post_meta( $post->ID, 'expiry_date', true ),
				);
			},
			$posts
		);
	}
}
