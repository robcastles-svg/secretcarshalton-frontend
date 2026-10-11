<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Adds a pending-count bubble to the Jobs admin menu item — the same
 * native "awaiting-mod" style WordPress core uses for pending comments.
 * (A member's job goes live as soon as it's paid for — see
 * SC_Jobs_REST::payment_products — and the payment email is Rob's
 * notification, so there's no separate "job submitted" email any more;
 * pending jobs are ones that were never paid for.)
 */
class SC_Jobs_Hooks {

	public static function init() {
		add_filter( 'add_menu_classes', array( __CLASS__, 'add_pending_count_bubble' ) );
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
