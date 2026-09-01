<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Jobs as a plain custom post type, same trade-off as sc-events/sc-directory:
 * WordPress's own REST controller handles list/detail for free, and the
 * meta fields registered in SC_Jobs_Meta ride along in the same response.
 * Phase 1 (see sc-jobs.php) is API-sourced listings only — no member
 * submission form yet — but the CPT/taxonomy shape already matches what a
 * later member-submission phase would need, so that's a bolt-on rather than
 * a restructure when it happens.
 */
class SC_Jobs_CPT {

	const POST_TYPE = 'job_listing';
	/** Reed's own job categorisation isn't mapped in here (see SC_Jobs_Sync) — this taxonomy exists for the member-submission phase and for manually tagging API listings later. */
	const SECTOR_TAXONOMY  = 'job_sector';
	const LOCATION_TAXONOMY = 'job_location';

	public static function register() {
		register_post_type(
			self::POST_TYPE,
			array(
				'label'           => 'Jobs',
				'public'          => true,
				'show_in_rest'    => true,
				'rest_base'       => 'job-listings',
				'has_archive'     => 'jobs',
				'rewrite'         => array( 'slug' => 'jobs' ),
				'supports'        => array( 'title', 'editor', 'author', 'custom-fields' ),
				'menu_icon'       => 'dashicons-businessman',
				'capability_type' => 'post',
				'map_meta_cap'    => true,
			)
		);

		register_taxonomy(
			self::SECTOR_TAXONOMY,
			self::POST_TYPE,
			array(
				'label'        => 'Job Sectors',
				'public'       => true,
				'show_in_rest' => true,
				'hierarchical' => false,
				'rewrite'      => array( 'slug' => 'jobs/sector' ),
			)
		);

		register_taxonomy(
			self::LOCATION_TAXONOMY,
			self::POST_TYPE,
			array(
				'label'        => 'Job Locations',
				'public'       => true,
				'show_in_rest' => true,
				'hierarchical' => false,
				'rewrite'      => array( 'slug' => 'jobs/location' ),
			)
		);
	}

	public static function install() {
		self::register();
		flush_rewrite_rules();
	}
}
