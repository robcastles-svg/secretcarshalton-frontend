<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Mirrors SC_Events_Hooks::on_claim_requested / SC_Directory_Hooks's
 * pattern exactly — a review queue nobody's watching might as well not
 * exist, so this emails admin_email the moment a member submits a job,
 * with a direct link to review it.
 *
 * It also adds a pending-count bubble to the Jobs admin menu item —
 * the same native "awaiting-mod" style WordPress core already uses for
 * pending comments, so the queue is visible at a glance in wp-admin
 * without a separate notification-bell widget to build and keep
 * working.
 */
class SC_Jobs_Hooks {

	public static function init() {
		add_action( 'sc_jobs_job_submitted', array( __CLASS__, 'on_job_submitted' ), 10, 1 );
		add_filter( 'add_menu_classes', array( __CLASS__, 'add_pending_count_bubble' ) );
	}

	public static function on_job_submitted( $job_id ) {
		$job = get_post( $job_id );
		if ( ! $job ) {
			return;
		}
		$user = get_userdata( $job->post_author );
		$who  = $user ? "{$user->display_name} ({$user->user_email})" : 'A member';

		$review_url = admin_url( 'edit.php?post_status=pending&post_type=' . SC_Jobs_CPT::POST_TYPE );

		wp_mail(
			get_option( 'admin_email' ),
			'New job submitted — ' . $job->post_title,
			"{$who} submitted a job listing: \"{$job->post_title}\".\n\nReview it here:\n{$review_url}"
		);
	}

	public static function add_pending_count_bubble( $menu ) {
		$counts  = wp_count_posts( SC_Jobs_CPT::POST_TYPE );
		$pending = isset( $counts->pending ) ? (int) $counts->pending : 0;
		if ( ! $pending ) {
			return $menu;
		}

		foreach ( $menu as $key => $item ) {
			if ( isset( $item[2] ) && 'edit.php?post_type=' . SC_Jobs_CPT::POST_TYPE === $item[2] ) {
				$menu[ $key ][0] .= sprintf(
					' <span class="awaiting-mod count-%1$d"><span class="pending-count">%1$d</span></span>',
					$pending
				);
				break;
			}
		}

		return $menu;
	}
}
