<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The "Campaign progress" checklist for Featured Plus and Featured Gold
 * (Rob, 2026-10). Featured and Featured 6 months have no steps — they're
 * simply live once paid. Plus and Gold show the owner, on their
 * dashboard, how each part of the package is coming along:
 *
 *  - Listing live      — ticked once the listing is published and Featured.
 *  - Premium text ad   — created automatically when the package is paid
 *                        for (headline from the listing name, text from its
 *                        tagline, linking to the listing), running until
 *                        the Featured period ends. The owner can reword it
 *                        from their dashboard like any other ad.
 *  - Banner designed   — Rob ticks this in the listing's wp-admin box once
 *                        he's designed it and it's up.
 *  - Spotlight article — Gold only; ticked automatically as soon as a
 *                        spotlight article is connected to the listing.
 *
 * Social promotion isn't tracked — owners can see that for themselves.
 */
class SC_Directory_Campaign {

	const TIERS = array( 'featured_plus', 'featured_gold' );

	public static function init() {
		add_action( 'add_meta_boxes', array( __CLASS__, 'register_meta_box' ) );
		add_action( 'save_post_' . SC_Directory_CPT::POST_TYPE, array( __CLASS__, 'save_meta_box' ) );
	}

	public static function has_campaign( $listing_id ) {
		return in_array( (string) get_post_meta( $listing_id, 'sc_featured_tier', true ), self::TIERS, true )
			&& (bool) get_post_meta( $listing_id, 'sc_featured', true );
	}

	/* ------------------------------------------------------------------
	 * The text ad
	 * ---------------------------------------------------------------- */

	private static function ad_id( $listing_id ) {
		$ad_id = (int) get_post_meta( $listing_id, 'sc_campaign_ad_id', true );
		return $ad_id && class_exists( 'SC_Ads_CPT' ) && SC_Ads_CPT::POST_TYPE === get_post_type( $ad_id ) ? $ad_id : 0;
	}

	/** Cuts to $max characters at a word boundary. */
	private static function fit( $text, $max ) {
		$text = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( (string) $text ) ) );
		if ( mb_strlen( $text ) <= $max ) {
			return $text;
		}
		$cut   = mb_substr( $text, 0, $max - 1 );
		$space = mb_strrpos( $cut, ' ' );
		return rtrim( false !== $space && $space > $max / 2 ? mb_substr( $cut, 0, $space ) : $cut, ' ,.;:-' ) . '…';
	}

	/**
	 * Creates the package's Premium text ad, or extends it on renewal.
	 * $until is the Featured period's end (a timestamp).
	 */
	public static function sync_ad( $listing_id, $until ) {
		if ( ! class_exists( 'SC_Ads_CPT' ) || ! class_exists( 'SC_Ads_REST' ) ) {
			return;
		}
		$end   = wp_date( 'Y-m-d', (int) $until );
		$ad_id = self::ad_id( $listing_id );

		if ( $ad_id ) {
			update_post_meta( $ad_id, 'sc_ad_end', $end );
			update_post_meta( $ad_id, 'sc_ad_active', true );
			return;
		}

		$listing = get_post( $listing_id );
		if ( ! $listing ) {
			return;
		}
		$title    = wp_specialchars_decode( get_the_title( $listing ), ENT_QUOTES );
		$tagline  = (string) get_post_meta( $listing_id, 'sc_tagline', true );
		$headline = self::fit( $title, SC_Ads_REST::HEADLINE_MAX );
		$body     = self::fit( $tagline ? $tagline : $listing->post_content, SC_Ads_REST::BODY_MAX );
		$link     = class_exists( 'SC_Ads_Payments' ) ? SC_Ads_Payments::site_url( '/directory/' . $listing->post_name ) : home_url( '/directory/' . $listing->post_name );

		$ad_id = wp_insert_post(
			array(
				'post_type'   => SC_Ads_CPT::POST_TYPE,
				'post_status' => 'publish',
				'post_title'  => $headline,
				'post_author' => (int) $listing->post_author,
			),
			true
		);
		if ( is_wp_error( $ad_id ) || ! $ad_id ) {
			return;
		}
		$meta = array(
			'sc_ad_headline'        => $headline,
			'sc_ad_body'            => $body,
			'sc_ad_link_url'        => $link,
			'sc_ad_alt_text'        => $headline,
			'sc_ad_placement'       => 'in_article',
			'sc_ad_active'          => true,
			'sc_ad_start'           => current_time( 'Y-m-d' ),
			'sc_ad_end'             => $end,
			'sc_ad_weight'          => 1,
			'sc_ad_payment_status'  => 'paid',
			'sc_ad_campaign_listing' => $listing_id,
		);
		foreach ( $meta as $key => $value ) {
			update_post_meta( $ad_id, $key, $value );
		}
		update_post_meta( $listing_id, 'sc_campaign_ad_id', $ad_id );
	}

	/** Featured ended or was undone: the package's ad stops too. */
	public static function end_ad( $listing_id ) {
		$ad_id = self::ad_id( $listing_id );
		if ( $ad_id ) {
			update_post_meta( $ad_id, 'sc_ad_active', false );
		}
	}

	/* ------------------------------------------------------------------
	 * Status, for the owner's dashboard (SC_Directory_REST::get_my_listings)
	 * ---------------------------------------------------------------- */

	/** [{key, label, done}] for a Plus/Gold listing, null for anything else. */
	public static function status( $listing_id ) {
		if ( ! self::has_campaign( $listing_id ) ) {
			return null;
		}
		$ad_id = self::ad_id( $listing_id );
		$steps = array(
			array(
				'key'   => 'listing',
				'label' => 'Listing live',
				'done'  => 'publish' === get_post_status( $listing_id ),
			),
			array(
				'key'   => 'ad',
				'label' => 'Premium text ad live',
				'done'  => $ad_id && 'publish' === get_post_status( $ad_id ) && (bool) get_post_meta( $ad_id, 'sc_ad_active', true ),
			),
			array(
				'key'   => 'banner',
				'label' => 'Banner designed and live',
				'done'  => (bool) get_post_meta( $listing_id, 'sc_campaign_banner_done', true ),
			),
		);
		if ( 'featured_gold' === get_post_meta( $listing_id, 'sc_featured_tier', true ) ) {
			$steps[] = array(
				'key'   => 'spotlight',
				'label' => 'Spotlight article published',
				'done'  => '' !== trim( (string) get_post_meta( $listing_id, 'sc_spotlight_slugs', true ) ),
			);
		}
		return $steps;
	}

	/* ------------------------------------------------------------------
	 * wp-admin box
	 * ---------------------------------------------------------------- */

	public static function register_meta_box( $post_type ) {
		if ( SC_Directory_CPT::POST_TYPE !== $post_type ) {
			return;
		}
		global $post;
		if ( ! $post || ! self::has_campaign( $post->ID ) ) {
			return;
		}
		add_meta_box( 'sc_directory_campaign', 'Campaign progress', array( __CLASS__, 'render_meta_box' ), SC_Directory_CPT::POST_TYPE, 'side', 'high' );
	}

	public static function render_meta_box( $post ) {
		wp_nonce_field( 'sc_directory_campaign', 'sc_directory_campaign_nonce' );
		$banner = get_post_meta( $post->ID, 'sc_campaign_banner_done', true );
		echo '<p style="color:#666;margin-top:0">What the owner sees on their dashboard.</p><ul style="margin:0">';
		foreach ( (array) self::status( $post->ID ) as $step ) {
			if ( 'banner' === $step['key'] ) {
				printf(
					'<li><label><input type="checkbox" name="sc_campaign_banner_done" value="1" %s /> %s</label>%s</li>',
					checked( (bool) $banner, true, false ),
					esc_html( $step['label'] ),
					$banner ? ' <span style="color:#666">(' . esc_html( wp_date( 'j M', (int) $banner ) ) . ')</span>' : ''
				);
				continue;
			}
			$extra = '';
			if ( 'ad' === $step['key'] && self::ad_id( $post->ID ) ) {
				$extra = ' — <a href="' . esc_url( get_edit_post_link( self::ad_id( $post->ID ) ) ) . '">edit ad</a>';
			}
			if ( 'spotlight' === $step['key'] && ! $step['done'] ) {
				$extra = ' — connect one in Spotlight articles below';
			}
			printf( '<li>%s %s%s</li>', $step['done'] ? '✅' : '⬜️', esc_html( $step['label'] ), $extra ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
		echo '</ul>';
	}

	public static function save_meta_box( $post_id ) {
		if ( ! isset( $_POST['sc_directory_campaign_nonce'] ) || ! wp_verify_nonce( $_POST['sc_directory_campaign_nonce'], 'sc_directory_campaign' ) ) {
			return;
		}
		if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		if ( isset( $_POST['sc_campaign_banner_done'] ) ) {
			if ( ! get_post_meta( $post_id, 'sc_campaign_banner_done', true ) ) {
				update_post_meta( $post_id, 'sc_campaign_banner_done', time() );
			}
		} else {
			delete_post_meta( $post_id, 'sc_campaign_banner_done' );
		}
	}
}
