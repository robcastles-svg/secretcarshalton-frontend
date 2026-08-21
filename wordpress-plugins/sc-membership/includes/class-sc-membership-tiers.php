<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SC_Membership_Tiers {

	/**
	 * Default tier ladder. Filterable so this can be tuned later
	 * without touching code — e.g. `add_filter( 'sc_membership_tiers', ... )`.
	 * Ordered lowest to highest; 'threshold' is the minimum points to hold the tier.
	 */
	public static function all() {
		$default = array(
			array(
				'slug'      => 'newcomer',
				'label'     => 'Newcomer',
				'threshold' => 0,
			),
			array(
				'slug'      => 'regular',
				'label'     => 'Regular',
				'threshold' => 50,
			),
			array(
				'slug'      => 'local_legend',
				'label'     => 'Local Legend',
				'threshold' => 200,
			),
			array(
				'slug'      => 'carshalton_champion',
				'label'     => 'Carshalton Champion',
				'threshold' => 500,
			),
		);

		return apply_filters( 'sc_membership_tiers', $default );
	}

	public static function base_tier_slug() {
		$tiers = self::all();
		return $tiers[0]['slug'];
	}

	/**
	 * Given a points total, returns the tier slug that total qualifies for
	 * (the highest tier whose threshold the points meet).
	 */
	public static function tier_for_points( $points ) {
		$tiers   = self::all();
		$current = $tiers[0]['slug'];

		foreach ( $tiers as $tier ) {
			if ( $points >= $tier['threshold'] ) {
				$current = $tier['slug'];
			}
		}

		return $current;
	}

	public static function get( $slug ) {
		foreach ( self::all() as $tier ) {
			if ( $tier['slug'] === $slug ) {
				return $tier;
			}
		}
		return null;
	}

	/**
	 * Points still needed to reach the next tier up, or null if already
	 * at the top tier. Used by the frontend to show "42 points to Local Legend".
	 */
	public static function points_to_next_tier( $points ) {
		foreach ( self::all() as $tier ) {
			if ( $points < $tier['threshold'] ) {
				return array(
					'tier'   => $tier,
					'points' => $tier['threshold'] - $points,
				);
			}
		}
		return null;
	}
}
