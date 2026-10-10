<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Start/end/venue as real registered meta, REST-exposed from day one —
 * the whole point of replacing EventON's data layer. sc_start and sc_end
 * are ISO 8601 strings so the frontend can pass them straight to `new
 * Date()` instead of parsing schema.org markup.
 */
class SC_Events_Meta {

	const FIELDS = array(
		'sc_start'         => 'string',
		'sc_end'           => 'string',
		'sc_venue_name'    => 'string',
		'sc_venue_address' => 'string',
		'sc_organizer'     => 'string',
		'sc_event_url'     => 'string',
		/**
		 * The sc-listings post ID of the business/organisation this event
		 * belongs to — distinct from post_author (a WP *user* account).
		 * "Submitted by [member]" was never the right public-facing credit
		 * for an event a business owns; this is what "Hosted by [company]"
		 * on the frontend actually reads from. Only ever set through
		 * SC_Events_REST::set_taxonomies_from_request's sibling validation
		 * (must be a listing the current user owns) — see update_event's
		 * docblock — never accepted at face value from the request.
		 */
		'sc_event_listing_id' => 'integer',
		/**
		 * The "Coming up next" hero slot's paid-upgrade flag — an admin-set
		 * override so a specific event (bought/promoted, not necessarily
		 * the chronologically soonest one) takes that prominent spot
		 * instead. Registered the same way as every other field here, but
		 * deliberately never touched by update_event/submit_event — same
		 * "exposed to REST, but only an admin can actually set it" pattern
		 * SC_Directory_Meta uses for sc_featured. Automating who can buy
		 * this slot (and for how long) is future work; for now it's a
		 * manual wp-admin toggle, one event at a time.
		 */
		'sc_event_featured' => 'boolean',
		/**
		 * The member-facing request side of sc_event_featured — set via
		 * SC_Events_REST::request_featured, never the boolean itself (that
		 * stays the admin-only toggle, same reasoning as above). Payment
		 * automation doesn't exist yet, so sc_event_featured_amount_paid is
		 * a holding field an admin fills in by hand when approving, the
		 * same pattern as sc-membership's directory_upgrade_amount_paid.
		 */
		'sc_event_featured_status'         => 'string', // '' | 'pending' | 'approved' | 'rejected'
		'sc_event_featured_requested_at'   => 'string',
		'sc_event_featured_amount_paid'    => 'string',
		/**
		 * Paid featuring (Stage 5, see SC_Events_Featured): the Y-m-d date
		 * featuring ends (the event's date) and 'paid' once PayPal has
		 * taken the payment. Set only by SC_Events_Featured, never by
		 * submit/update.
		 */
		'sc_event_featured_until'          => 'string',
		'sc_event_featured_payment'        => 'string',
		/**
		 * Mirrors sc-directory's sc_claim_requested_by/at exactly — claiming
		 * an event used to instantly reassign post_author with no review,
		 * the same hole sc-directory had and fixed; this is that same fix
		 * applied here. Who's asking, recorded on the event itself, until
		 * an admin approves it from the Claim Requests screen (see
		 * SC_Events_Admin) and post_author actually changes.
		 */
		'sc_event_claim_requested_by' => 'integer',
		'sc_event_claim_requested_at' => 'string',
		/**
		 * Price — what the event page's booking card and the "Free" filter
		 * read from (events redesign, Stage 1). sc_price_type is one of
		 * PRICE_TYPES; '' on every event from before this existed, which
		 * the frontend treats the same as 'unknown'. Amount is a plain
		 * decimal string ("7", "7.50"), no currency symbol — always £.
		 * sc_price_from = "from £7" (several ticket prices).
		 * sc_price_concession is free text, e.g. "£6 members".
		 */
		'sc_price_type'       => 'string',
		'sc_price_amount'     => 'string',
		'sc_price_from'       => 'boolean',
		'sc_price_concession' => 'string',
		/**
		 * How to book. sc_booking_type is one of BOOKING_TYPES. For 'link',
		 * the link itself stays in sc_event_url (so every existing event's
		 * link keeps working) and sc_booking_link_kind says whether it's a
		 * ticket page or just a website — the button wording depends on
		 * it. Booking email/phone are optional; blank means "use the
		 * organiser's", resolved on the frontend.
		 */
		'sc_booking_type'      => 'string',
		'sc_booking_link_kind' => 'string',
		'sc_booking_email'     => 'string',
		'sc_booking_phone'     => 'string',
		/**
		 * A repeating event is ONE post with many dates, not a post per
		 * date. sc_repeat_dates is the full list of start date-times (same
		 * "YYYY-MM-DDTHH:MM" local-UK format as sc_start), sorted, with
		 * sc_start kept equal to the first one — so everything that only
		 * knows about sc_start still sees a sensible date. A skipped date
		 * is simply absent. sc_repeat_pattern is display text only
		 * ("Monthly, last Sunday"), never parsed. Registered separately
		 * below because array meta needs a REST schema.
		 */
		'sc_repeat_pattern' => 'string',
	);

	const PRICE_TYPES        = array( 'free', 'paid', 'unknown' );
	const BOOKING_TYPES      = array( 'link', 'contact', 'none' );
	const BOOKING_LINK_KINDS = array( 'tickets', 'website' );

	/** Most dates a repeating event may hold — matches the add-event form's "ends after N dates (max 52)". */
	const MAX_REPEAT_DATES = 52;

	public static function register() {
		foreach ( self::FIELDS as $key => $type ) {
			$args = array(
				'type'          => $type,
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function ( $allowed, $meta_key, $post_id ) {
					return current_user_can( 'edit_post', $post_id );
				},
			);

			if ( 'sc_event_url' === $key ) {
				$args['sanitize_callback'] = array( __CLASS__, 'sanitize_web_url' );
			} elseif ( 'sc_price_type' === $key ) {
				$args['sanitize_callback'] = self::enum_sanitizer( self::PRICE_TYPES );
			} elseif ( 'sc_booking_type' === $key ) {
				$args['sanitize_callback'] = self::enum_sanitizer( self::BOOKING_TYPES );
			} elseif ( 'sc_booking_link_kind' === $key ) {
				$args['sanitize_callback'] = self::enum_sanitizer( self::BOOKING_LINK_KINDS );
			} elseif ( 'sc_price_amount' === $key ) {
				$args['sanitize_callback'] = array( __CLASS__, 'sanitize_price_amount' );
			} elseif ( 'sc_booking_email' === $key ) {
				$args['sanitize_callback'] = 'sanitize_email';
			} elseif ( 'string' === $type ) {
				$args['sanitize_callback'] = 'sanitize_text_field';
			} elseif ( 'integer' === $type ) {
				$args['sanitize_callback'] = 'absint';
			}

			register_post_meta( SC_Events_CPT::POST_TYPE, $key, $args );
		}

		register_post_meta(
			SC_Events_CPT::POST_TYPE,
			'sc_repeat_dates',
			array(
				'type'              => 'array',
				'single'            => true,
				'default'           => array(),
				'show_in_rest'      => array(
					'schema' => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
				),
				'sanitize_callback' => array( __CLASS__, 'sanitize_repeat_dates' ),
				'auth_callback'     => function ( $allowed, $meta_key, $post_id ) {
					return current_user_can( 'edit_post', $post_id );
				},
			)
		);
	}

	private static function enum_sanitizer( array $allowed ) {
		return function ( $value ) use ( $allowed ) {
			$value = sanitize_key( (string) $value );
			return in_array( $value, $allowed, true ) ? $value : '';
		};
	}

	/** "7", "7.5", "£7.50" → "7.50"-style plain decimal; anything unparseable → ''. */
	public static function sanitize_price_amount( $value ) {
		$value = preg_replace( '/[^0-9.]/', '', (string) $value );
		if ( '' === $value || ! is_numeric( $value ) ) {
			return '';
		}
		$amount = round( (float) $value, 2 );
		return floor( $amount ) == $amount ? (string) (int) $amount : number_format( $amount, 2, '.', '' );
	}

	/**
	 * True when a value meant to be a web address is really an email
	 * address — "susan@example.com" or "mailto:…". esc_url_raw() happily
	 * turns the former into "http://susan@example.com" (a link to a host
	 * called example.com with a username), which is exactly how emails
	 * ended up saved as organiser websites and event links.
	 */
	public static function looks_like_email( $value ) {
		$value = trim( (string) $value );
		if ( '' === $value ) {
			return false;
		}
		if ( 0 === stripos( $value, 'mailto:' ) ) {
			return true;
		}
		// Strip a scheme someone (or esc_url_raw) put in front, then an
		// '@' before the first '/' means "user@host", not a real web page.
		$rest  = preg_replace( '#^[a-z][a-z0-9+.-]*://#i', '', $value );
		$slash = strpos( $rest, '/' );
		$host  = false === $slash ? $rest : substr( $rest, 0, $slash );
		return false !== strpos( $host, '@' );
	}

	/**
	 * esc_url_raw, but an email address saves as '' instead of becoming a
	 * broken http:// link. The REST routes reject these with a proper
	 * error message before ever getting here (see
	 * SC_Events_REST::validate_web_urls); this is the backstop for every
	 * other path (wp-admin custom fields, core REST meta).
	 */
	public static function sanitize_web_url( $value ) {
		if ( self::looks_like_email( $value ) ) {
			return '';
		}
		return esc_url_raw( (string) $value );
	}

	/**
	 * Keeps only well-formed "YYYY-MM-DDTHH:MM" date-times, normalised to
	 * zero-padded "YYYY-MM-DDTHH:MM:00", de-duplicated, sorted, and capped
	 * at MAX_REPEAT_DATES.
	 */
	public static function sanitize_repeat_dates( $value ) {
		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			$value   = is_array( $decoded ) ? $decoded : array_filter( array_map( 'trim', explode( ',', $value ) ) );
		}
		if ( ! is_array( $value ) ) {
			return array();
		}
		$dates = array();
		foreach ( $value as $raw ) {
			$normalised = self::normalise_datetime( $raw );
			if ( $normalised ) {
				$dates[ $normalised ] = true;
			}
		}
		$dates = array_keys( $dates );
		sort( $dates, SORT_STRING );
		return array_slice( $dates, 0, self::MAX_REPEAT_DATES );
	}

	/** "2026-1-5T9:30" → "2026-01-05T09:30:00"; anything else → ''. */
	public static function normalise_datetime( $raw ) {
		if ( ! preg_match( '/^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{2})/', trim( (string) $raw ), $m ) ) {
			return '';
		}
		list( , $y, $mo, $d, $h, $mi ) = array_map( 'intval', $m );
		if ( ! checkdate( $mo, $d, $y ) || $h > 23 || $mi > 59 ) {
			return '';
		}
		return sprintf( '%04d-%02d-%02dT%02d:%02d:00', $y, $mo, $d, $h, $mi );
	}
}
