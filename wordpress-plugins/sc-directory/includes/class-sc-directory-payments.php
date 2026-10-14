<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The directory's paid products, on the site's shared checkout
 * (SC_Ads_Payments in sc-ads). Paid things go live straight away; each
 * payment is emailed to Rob and can be refunded or unpublished from
 * Payments in wp-admin (Rob, 2026-10).
 *
 * - standard_listing: £2.50/year, a PayPal subscription that renews
 *   itself. Publishes the listing; if the subscription lapses, the
 *   listing is unpublished 30 days after its paid year ends.
 * - featured: the four Featured packages, one-off payments covering one
 *   month (six for featured_6mo). Publishes a new listing too. A week
 *   before the period ends the owner is emailed a link to renew; if they
 *   don't, it drops back to a standard listing. Listings featured before
 *   this (no sc_featured_until) are never expired — they're grandfathered.
 * - group_promotion: £10 for 30 days in the Community section (meant for
 *   community groups).
 *
 * Community groups themselves stay free (and reviewed by Rob as before).
 */
class SC_Directory_Payments {

	const STANDARD_PRICE = 2.50;
	const PROMOTION_PRICE = 10;
	const PROMOTION_DAYS  = 30;
	const REMIND_DAYS     = 7;

	/** Tier => [price, months]. Must match FEATURED_DIRECTORY_TIERS in lib/pricing.ts. */
	const FEATURED_TIERS = array(
		'featured'      => array( 50, 1 ),
		'featured_6mo'  => array( 150, 6 ),
		'featured_plus' => array( 70, 1 ),
		'featured_gold' => array( 150, 1 ),
	);

	const GROUPS_CATEGORY = 'groups-to-join';

	public static function init() {
		add_filter( 'sc_payments_products', array( __CLASS__, 'products' ) );
		add_action( 'sc_payments_daily', array( __CLASS__, 'daily' ) );
	}

	public static function is_group( $id ) {
		return has_term( self::GROUPS_CATEGORY, SC_Directory_CPT::TAXONOMY, $id );
	}

	public static function edit_url( $id ) {
		return admin_url( 'post.php?post=' . (int) $id . '&action=edit' );
	}

	/** The listing exists and belongs to $user_id (WP_Error otherwise). */
	private static function owned_listing( $id, $user_id ) {
		$listing = get_post( $id );
		if ( ! $listing || SC_Directory_CPT::POST_TYPE !== $listing->post_type || 'trash' === $listing->post_status ) {
			return new WP_Error( 'not_found', 'Listing not found.', array( 'status' => 404 ) );
		}
		if ( (int) $listing->post_author !== (int) $user_id ) {
			return new WP_Error( 'not_owner', 'You can only pay for your own listing.', array( 'status' => 403 ) );
		}
		return $listing;
	}

	private static function publish( $id ) {
		if ( 'publish' !== get_post_status( $id ) ) {
			wp_update_post( array( 'ID' => $id, 'post_status' => 'publish' ) );
		}
	}

	public static function products( $products ) {
		$common = array(
			'title'    => 'get_the_title',
			'edit_url' => array( __CLASS__, 'edit_url' ),
		);

		$products['standard_listing'] = $common + array(
			'label'        => 'Standard listing',
			'subscription' => array(
				'key'   => 'standard_listing',
				'name'  => 'Secret Carshalton standard directory listing (yearly)',
				'price' => self::STANDARD_PRICE,
			),
			'can_pay'      => function ( $id, $user_id, $stage ) {
				$listing = self::owned_listing( $id, $user_id );
				if ( is_wp_error( $listing ) ) {
					return $listing;
				}
				if ( self::is_group( $id ) ) {
					return new WP_Error( 'group_is_free', 'Community group listings are free.', array( 'status' => 400 ) );
				}
				if ( 'start' === $stage && get_post_meta( $id, 'sc_standard_subscription_id', true ) && 'publish' === $listing->post_status ) {
					return new WP_Error( 'already_subscribed', 'This listing already has a yearly subscription.', array( 'status' => 400 ) );
				}
				return true;
			},
			'on_paid'      => function ( $id, $payment_id, $context ) {
				update_post_meta( $id, 'sc_standard_subscription_id', $context['subscription_id'] ?? '' );
				update_post_meta( $id, 'sc_plan', get_post_meta( $id, 'sc_featured', true ) ? 'paid' : 'standard' );
				self::publish( $id );
				return array( 'slug' => get_post_field( 'post_name', $id ) );
			},
			'undo'         => function ( $id ) {
				wp_update_post( array( 'ID' => $id, 'post_status' => 'draft' ) );
				return 'The listing is unpublished (kept as a draft).';
			},
			'lapse'        => function ( $id ) {
				delete_post_meta( $id, 'sc_standard_subscription_id' );
				wp_update_post( array( 'ID' => $id, 'post_status' => 'draft' ) );
			},
		);

		$products['featured'] = $common + array(
			'label'   => 'Featured listing',
			'can_pay' => function ( $id, $user_id ) {
				$listing = self::owned_listing( $id, $user_id );
				return is_wp_error( $listing ) ? $listing : true;
			},
			'price'   => function ( $id, WP_REST_Request $request ) {
				$tier = sanitize_key( (string) $request->get_param( 'tier' ) );
				if ( ! $tier ) {
					$tier = (string) get_post_meta( $id, 'sc_featured_requested_tier', true );
				}
				if ( ! isset( self::FEATURED_TIERS[ $tier ] ) ) {
					return new WP_Error( 'unknown_tier', 'Please choose a Featured package.', array( 'status' => 400 ) );
				}
				list( $price, $months ) = self::FEATURED_TIERS[ $tier ];
				return array(
					$price,
					'Secret Carshalton Featured listing: ' . get_the_title( $id ) . ' (' . $months . ( 1 === $months ? ' month' : ' months' ) . ')',
					array( 'tier' => $tier ),
				);
			},
			'on_paid' => function ( $id, $payment_id, $context ) {
				$tier   = $context['tier'] ?? 'featured';
				$months = self::FEATURED_TIERS[ $tier ][1] ?? 1;
				// Renewing early adds on to the current period rather than replacing it.
				$current = (int) get_post_meta( $id, 'sc_featured_until', true );
				$from    = max( time(), $current );
				$until   = strtotime( '+' . $months . ' months', $from );

				update_post_meta( $id, 'sc_plan', 'paid' );
				update_post_meta( $id, 'sc_featured', true );
				update_post_meta( $id, 'sc_featured_tier', $tier );
				update_post_meta( $id, 'sc_featured_until', $until );
				delete_post_meta( $id, 'sc_featured_reminded' );
				delete_post_meta( $id, 'sc_featured_requested_tier' );
				self::publish( $id );
				self::mark_member_upgraded( $id, $tier, $payment_id );
				// Featured Plus/Gold: the package's text ad goes up with it (SC_Directory_Campaign).
				if ( in_array( $tier, SC_Directory_Campaign::TIERS, true ) ) {
					SC_Directory_Campaign::sync_ad( $id, $until );
				}
				update_post_meta( $payment_id, 'note', 'Featured until ' . wp_date( 'j F Y', $until ) . '.' );
				return array(
					'slug'  => get_post_field( 'post_name', $id ),
					'until' => wp_date( 'Y-m-d', $until ),
				);
			},
			'undo'    => function ( $id ) {
				self::unfeature( $id );
				return 'The listing is no longer Featured (it stays live as a standard listing).';
			},
		);

		$products['group_promotion'] = $common + array(
			'label'   => 'Group promotion',
			'can_pay' => function ( $id, $user_id ) {
				// Any listing the member owns (meant for groups, but /directory/{slug}/promote doesn't restrict it).
				$listing = self::owned_listing( $id, $user_id );
				return is_wp_error( $listing ) ? $listing : true;
			},
			'price'   => function ( $id ) {
				return array( self::PROMOTION_PRICE, 'Secret Carshalton group promotion: ' . get_the_title( $id ) . ' (' . self::PROMOTION_DAYS . ' days)' );
			},
			'on_paid' => function ( $id, $payment_id ) {
				$current = strtotime( (string) get_post_meta( $id, 'sc_group_promo_expires_at', true ) . ' UTC' );
				$from    = get_post_meta( $id, 'sc_group_promoted', true ) && $current > time() ? $current : time();
				$until   = $from + self::PROMOTION_DAYS * DAY_IN_SECONDS;
				update_post_meta( $id, 'sc_group_promoted', '1' );
				update_post_meta( $id, 'sc_group_promo_expires_at', gmdate( 'Y-m-d\TH:i:s', $until ) );
				delete_post_meta( $id, 'sc_group_promo_requested_by' );
				delete_post_meta( $id, 'sc_group_promo_requested_at' );
				update_post_meta( $payment_id, 'note', 'Promoted until ' . wp_date( 'j F Y', $until ) . ( 'publish' === get_post_status( $id ) ? '.' : ' — the group itself is still waiting for your review.' ) );
				return array( 'until' => gmdate( 'Y-m-d', $until ) );
			},
			'undo'    => function ( $id ) {
				update_post_meta( $id, 'sc_group_promoted', '0' );
				return 'The group is no longer promoted.';
			},
		);

		return $products;
	}

	/**
	 * The dashboard's "My business" panel keys off the member's upgrade
	 * record in sc-membership (what Rob's manual approval used to set), so
	 * a paid Featured listing sets the same fields.
	 */
	private static function mark_member_upgraded( $id, $tier, $payment_id ) {
		if ( ! class_exists( 'SC_Membership_DB' ) ) {
			return;
		}
		global $wpdb;
		$user_id = (int) get_post_field( 'post_author', $id );
		SC_Membership_DB::get_or_create_member( $user_id );
		$wpdb->update(
			SC_Membership_DB::members_table(),
			array(
				'directory_upgrade_status'         => 'approved',
				'directory_upgrade_listing_id'     => $id,
				'directory_upgrade_tier'           => $tier,
				'directory_upgrade_amount_paid'    => '£' . get_post_meta( $payment_id, 'amount', true ),
				'directory_upgrade_payment_status' => 'paid',
				'updated_at'                       => current_time( 'mysql' ),
			),
			array( 'user_id' => $user_id ),
			array( '%s', '%d', '%s', '%s', '%s', '%s' ),
			array( '%d' )
		);
	}

	private static function unfeature( $id ) {
		SC_Directory_Campaign::end_ad( $id );
		update_post_meta( $id, 'sc_featured', false );
		update_post_meta( $id, 'sc_plan', get_post_meta( $id, 'sc_standard_subscription_id', true ) ? 'standard' : 'free' );
		delete_post_meta( $id, 'sc_featured_until' );
	}

	/**
	 * Daily: email owners whose Featured period ends within REMIND_DAYS
	 * (once per period), and drop lapsed ones back to standard. Only
	 * listings with sc_featured_until — i.e. paid through the site — are
	 * touched.
	 */
	public static function daily() {
		$featured = get_posts(
			array(
				'post_type'      => SC_Directory_CPT::POST_TYPE,
				'post_status'    => 'any',
				'posts_per_page' => 500,
				'fields'         => 'ids',
				'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery
					array(
						'key'     => 'sc_featured_until',
						'value'   => 0,
						'compare' => '>',
						'type'    => 'NUMERIC',
					),
				),
			)
		);

		foreach ( $featured as $id ) {
			$until = (int) get_post_meta( $id, 'sc_featured_until', true );
			if ( $until < time() ) {
				self::unfeature( $id );
				wp_mail(
					get_option( 'admin_email' ),
					'Featured ended — ' . get_the_title( $id ),
					get_the_title( $id ) . "'s Featured period ended without a renewal, so it's now a standard listing.\n\n" . self::edit_url( $id )
				);
				continue;
			}
			if ( $until - time() < self::REMIND_DAYS * DAY_IN_SECONDS && (int) get_post_meta( $id, 'sc_featured_reminded', true ) !== $until ) {
				$owner = get_userdata( (int) get_post_field( 'post_author', $id ) );
				if ( $owner ) {
					wp_mail(
						$owner->user_email,
						'Your Featured listing ends on ' . wp_date( 'j F', $until ),
						"Hello {$owner->display_name},\n\nYour Featured listing for " . get_the_title( $id ) . ' on Secret Carshalton ends on ' . wp_date( 'j F Y', $until ) .
						".\n\nTo keep it Featured, renew it here:\n" . SC_Ads_Payments::site_url( '/payment/pay?kind=featured&id=' . $id ) .
						"\n\nIf you don't renew, it will simply go back to a standard listing.\n\nThanks for supporting Secret Carshalton."
					);
				}
				update_post_meta( $id, 'sc_featured_reminded', $until );
			}
		}
	}
}
