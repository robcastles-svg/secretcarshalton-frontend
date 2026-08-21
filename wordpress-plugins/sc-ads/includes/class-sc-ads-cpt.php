<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Ads are not public content — no front-end single page or archive of
 * their own, just admin-editable records the Next.js frontend reads by
 * placement. show_in_rest stays true so the custom /sc-ads/v1/active/{slot}
 * route (and, if ever needed, the standard wp/v2/sc-ads route) can read them.
 */
class SC_Ads_CPT {

	const POST_TYPE = 'sc_ad';

	const PLACEMENTS = array(
		'billboard'   => 'Billboard (full-width, top of page)',
		'leaderboard' => 'Leaderboard (beside logo in header)',
		'sidebar'     => 'Sidebar (article pages)',
		'in_article'  => 'In-article',
	);

	public static function register() {
		register_post_type(
			self::POST_TYPE,
			array(
				'label'           => 'Ads',
				'public'          => false,
				'show_ui'         => true,
				'show_in_menu'    => true,
				'show_in_rest'    => true,
				'rest_base'       => 'sc-ads',
				'supports'        => array( 'title' ),
				'menu_icon'       => 'dashicons-megaphone',
				'capability_type' => 'post',
				'map_meta_cap'    => true,
			)
		);
	}

	public static function install() {
		self::register();
	}
}
