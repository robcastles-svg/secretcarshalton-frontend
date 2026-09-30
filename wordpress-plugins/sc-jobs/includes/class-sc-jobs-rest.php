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
		update_post_meta( $post_id, 'job_salary_text', sanitize_text_field( (string) $request->get_param( 'salary' ) ) );
		// A member job posting is paid — no automated payment yet, so this
		// just flags it for Rob to arrange payment before approving (same
		// holding pattern as sc-ads' payment_status).
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

		return array( 'id' => $post_id, 'status' => 'pending' );
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
				);
			},
			$posts
		);
	}
}
