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

	/**
	 * Mirrors the real zone structure found on the live site's AdRotate
	 * setup (confirmed by sampling rendered pages — see g-N/a-N markup):
	 * group 1 is a genuine multi-ad rotation pool, groups 3/4/5/7 are
	 * single-advertiser exclusive slots, two of which (5, 7) sit inside
	 * the article body itself rather than around it.
	 */
	const PLACEMENTS = array(
		'billboard'   => 'Billboard (full-width, top of page)',
		'leaderboard' => 'Leaderboard (beside logo in header — rotation pool)',
		'sidebar'     => 'Sidebar (article pages) — 300×250 MPU',
		'in_post_1'   => 'In-article — first slot',
		'in_post_2'   => 'In-article — second slot',
		'in_feed'     => 'In-feed card (mixed into the story/listing grid on News, Directory, Discover etc.)',
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
				'supports'        => array( 'title', 'custom-fields' ),
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
