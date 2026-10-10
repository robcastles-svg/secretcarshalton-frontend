<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The one action beyond plain post editing: RSVP. Fires sc_events_rsvp,
 * which sc-membership already listens for (5 points per RSVP) — see
 * SC_Membership_Hooks::on_event_rsvp, wired up before this plugin existed.
 */
class SC_Events_REST {

	public static function register_routes() {
		register_rest_route(
			'sc-events/v1',
			'/(?P<id>\d+)/rsvp',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'get_rsvp_status' ),
					'permission_callback' => function () {
						return is_user_logged_in();
					},
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( __CLASS__, 'rsvp' ),
					'permission_callback' => function () {
						return is_user_logged_in();
					},
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( __CLASS__, 'un_rsvp' ),
					'permission_callback' => function () {
						return is_user_logged_in();
					},
				),
			)
		);

		register_rest_route(
			'sc-events/v1',
			'/submit',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'submit_event' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-events/v1',
			'/venues',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_venues' ),
				'permission_callback' => '__return_true',
			)
		);

		/**
		 * Organiser *terms* already have their own core REST route for free
		 * (wp/v2/sc_event_organizer, since the taxonomy is show_in_rest) —
		 * no custom /organizers route needed the way /venues was, because
		 * venue is free text with no taxonomy behind it.
		 */

		register_rest_route(
			'sc-events/v1',
			'/(?P<id>\d+)',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'update_event' ),
				'permission_callback' => array( __CLASS__, 'check_owns_event' ),
			)
		);

		register_rest_route(
			'sc-events/v1',
			'/mine',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_my_events' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-events/v1',
			'/mine/rsvps',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_my_rsvps' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-events/v1',
			'/(?P<id>\d+)/request-featured',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'request_featured' ),
				'permission_callback' => array( __CLASS__, 'check_owns_event' ),
			)
		);

		register_rest_route(
			'sc-events/v1',
			'/(?P<id>\d+)/claim',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'claim_event' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_field(
			SC_Events_CPT::POST_TYPE,
			'sc_event_rsvp_count',
			array(
				'get_callback' => function ( $post ) {
					return count( self::get_going_ids( (int) $post['id'] ) );
				},
				'schema'       => array( 'type' => 'integer' ),
			)
		);

		/**
		 * Every one of the ~257 events migrated from EventON was inserted
		 * under the site's own admin account (see migrate_tags.py's import
		 * counterpart) — post_author there was never the real-world
		 * organiser, it was whichever account ran the import. "Submitted by
		 * [admin]" on those is misleading, not informative, so the frontend
		 * needs a clean way to tell "a staff/import account" from "a real
		 * member" without hardcoding a user ID it might not always know.
		 * user_can() works on any user ID regardless of who's asking — no
		 * REST auth context needed.
		 */
		register_rest_field(
			SC_Events_CPT::POST_TYPE,
			'sc_event_author_is_staff',
			array(
				'get_callback' => function ( $post ) {
					return (bool) user_can( (int) $post['author'], 'manage_options' );
				},
				'schema'       => array( 'type' => 'boolean' ),
			)
		);

		/** Mirrors sc-directory's sc_claim_pending field exactly — see claim_event's docblock. */
		register_rest_field(
			SC_Events_CPT::POST_TYPE,
			'sc_event_claim_pending',
			array(
				'get_callback' => function ( $post ) {
					return (bool) get_post_meta( $post['id'], 'sc_event_claim_requested_by', true );
				},
				'schema'       => array( 'type' => 'boolean' ),
			)
		);

		/**
		 * Resolves sc_event_listing_id (just a post ID in meta) into what
		 * the frontend actually needs to render "Hosted by [company]" and
		 * link to it — one field instead of a second round-trip fetch per
		 * event. Null whenever no listing is attached, already-trashed, or
		 * not published (an unpublished listing has no public page to link
		 * to yet).
		 */
		register_rest_field(
			SC_Events_CPT::POST_TYPE,
			'sc_event_company',
			array(
				'get_callback' => function ( $post ) {
					$listing_id = (int) get_post_meta( $post['id'], 'sc_event_listing_id', true );
					if ( ! $listing_id ) {
						return null;
					}
					$listing = get_post( $listing_id );
					if ( ! $listing || 'sc_listing' !== $listing->post_type || 'publish' !== $listing->post_status ) {
						return null;
					}
					return array(
						'id'   => $listing->ID,
						'name' => get_the_title( $listing ),
						'slug' => $listing->post_name,
					);
				},
				'schema'       => array( 'type' => 'object' ),
			)
		);

		/**
		 * Resolves the attached sc_event_organizer term (if any) plus its
		 * term meta into what the frontend needs to render a structured
		 * "Organised By" block and link to "other events by this
		 * organiser" — one field instead of a second fetch per event. Null
		 * whenever no organiser term is attached, which is still the case
		 * for every event that only ever had the legacy free-text
		 * sc_organizer/sc_event_url pair; the frontend falls back to those.
		 */
		register_rest_field(
			SC_Events_CPT::POST_TYPE,
			'sc_event_organizer_profile',
			array(
				'get_callback' => function ( $post ) {
					$terms = wp_get_post_terms( $post['id'], SC_Events_CPT::ORGANIZER_TAXONOMY );
					if ( empty( $terms ) || is_wp_error( $terms ) ) {
						return null;
					}
					return self::organizer_profile( $terms[0] );
				},
				'schema'       => array( 'type' => 'object' ),
			)
		);
	}

	/**
	 * Everything public about an organiser, in one shape — used by the
	 * sc_event_organizer_profile field. 'socials' is the legacy
	 * comma-separated list (kept for migration); the per-network fields
	 * replace it.
	 */
	public static function organizer_profile( WP_Term $term ) {
		$id = $term->term_id;
		return array(
			'id'        => $id,
			'name'      => $term->name,
			'slug'      => $term->slug,
			'about'     => $term->description,
			'email'     => get_term_meta( $id, 'sc_organizer_email', true ),
			'address'   => get_term_meta( $id, 'sc_organizer_address', true ),
			'phone'     => get_term_meta( $id, 'sc_organizer_phone', true ),
			'url'       => get_term_meta( $id, 'sc_organizer_url', true ),
			'logo'      => (int) get_term_meta( $id, 'sc_organizer_logo', true ),
			'logo_url'  => SC_Events_Organizer_Meta::logo_url( $id ),
			'facebook'  => get_term_meta( $id, 'sc_organizer_facebook', true ),
			'instagram' => get_term_meta( $id, 'sc_organizer_instagram', true ),
			'x'         => get_term_meta( $id, 'sc_organizer_x', true ),
			'tiktok'    => get_term_meta( $id, 'sc_organizer_tiktok', true ),
			'socials'   => get_term_meta( $id, 'sc_organizer_socials', true ),
		);
	}

	/**
	 * Rejects the whole request, with a message a member can act on,
	 * when a website/link field holds an email address or an email field
	 * holds something that isn't one. Run before anything is written, so
	 * a bad submit doesn't leave a half-saved event behind. Only checks
	 * params actually present, same as the rest of the update path.
	 */
	private static function validate_request( WP_REST_Request $request ) {
		$url_params = array(
			'event_url'           => 'The event link',
			'organizer_url'       => "The organiser's website",
			'organizer_facebook'  => 'The Facebook link',
			'organizer_instagram' => 'The Instagram link',
			'organizer_x'         => 'The X link',
			'organizer_tiktok'    => 'The TikTok link',
		);
		foreach ( $url_params as $param => $label ) {
			if ( SC_Events_Meta::looks_like_email( $request->get_param( $param ) ) ) {
				return new WP_Error(
					'email_in_url',
					$label . ' looks like an email address or @handle rather than a web address. Please put the full web address (starting https://) there, and any email address in the email box instead.',
					array( 'status' => 400, 'param' => $param )
				);
			}
		}

		$email_params = array(
			'booking_email'   => 'The booking email',
			'organizer_email' => "The organiser's email",
		);
		foreach ( $email_params as $param => $label ) {
			$value = trim( (string) $request->get_param( $param ) );
			if ( '' !== $value && ! is_email( $value ) ) {
				return new WP_Error( 'invalid_email', $label . " doesn't look like a valid email address.", array( 'status' => 400, 'param' => $param ) );
			}
		}

		$repeat = $request->get_param( 'repeat_dates' );
		if ( is_array( $repeat ) && count( $repeat ) > SC_Events_Meta::MAX_REPEAT_DATES ) {
			return new WP_Error( 'too_many_dates', 'A repeating event can have at most ' . SC_Events_Meta::MAX_REPEAT_DATES . ' dates.', array( 'status' => 400, 'param' => 'repeat_dates' ) );
		}

		return true;
	}

	/**
	 * Lets a real organiser *request* ownership of an event that's
	 * currently sitting under the staff/import account. Used to reassign
	 * post_author instantly, no verification beyond "you're logged in" —
	 * mirroring what SC_Directory_REST::claim_listing's own docblock
	 * explains was a real hole (anyone could take over any unclaimed
	 * listing/event just by being logged in). This is that same fix,
	 * applied here: it only records who's asking and leaves post_author
	 * exactly as it was until an admin approves it from the "Claim
	 * Requests" screen (SC_Events_Admin), which is also where
	 * sc_events_event_claimed actually fires — see
	 * SC_Events_Admin::handle_review_claim().
	 */
	public static function claim_event( WP_REST_Request $request ) {
		$event_id = (int) $request->get_param( 'id' );
		$event    = self::require_event( $event_id );
		if ( is_wp_error( $event ) ) {
			return $event;
		}

		if ( ! user_can( (int) $event->post_author, 'manage_options' ) ) {
			return new WP_Error( 'already_claimed', 'This event has already been claimed.', array( 'status' => 409 ) );
		}

		if ( get_post_meta( $event_id, 'sc_event_claim_requested_by', true ) ) {
			return new WP_Error( 'already_requested', 'A claim request for this event is already awaiting review.', array( 'status' => 409 ) );
		}

		$user_id = get_current_user_id();

		update_post_meta( $event_id, 'sc_event_claim_requested_by', $user_id );
		update_post_meta( $event_id, 'sc_event_claim_requested_at', current_time( 'mysql' ) );

		/** sc-events' own hooks class picks this up and emails Rob about it. */
		do_action( 'sc_events_event_claim_requested', $user_id, $event_id );

		return array( 'status' => 'pending' );
	}

	/**
	 * Members can't edit posts at all (Subscriber has no edit_posts
	 * capability — see the CPT's map_meta_cap docblock), so this can't
	 * rely on WP's own capability checks the way an Editor/Admin route
	 * could. Ownership is the security boundary for a member — but an
	 * Editor/Administrator (user_can(..., 'manage_options')) can fix up
	 * any event regardless of who submitted it, the same override
	 * sc_event_author_is_staff already uses to tell a staff account from
	 * a real member.
	 */
	public static function check_owns_event( WP_REST_Request $request ) {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'not_logged_in', 'You must be logged in.', array( 'status' => 401 ) );
		}
		$event = get_post( (int) $request->get_param( 'id' ) );
		if ( ! $event || SC_Events_CPT::POST_TYPE !== $event->post_type ) {
			return new WP_Error( 'not_found', 'Event not found.', array( 'status' => 404 ) );
		}
		$current_user_id = get_current_user_id();
		if ( (int) $event->post_author !== $current_user_id && ! user_can( $current_user_id, 'manage_options' ) ) {
			return new WP_Error( 'forbidden', 'You can only edit your own events.', array( 'status' => 403 ) );
		}
		return true;
	}

	/** Same reasoning as SC_Directory_REST::get_my_listings(). */
	public static function get_my_events( WP_REST_Request $request ) {
		$posts = get_posts(
			array(
				'post_type'      => SC_Events_CPT::POST_TYPE,
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
					'start'         => get_post_meta( $post->ID, 'sc_start', true ),
					'featured'      => (bool) get_post_meta( $post->ID, 'sc_event_featured', true ),
					'featuredStatus' => get_post_meta( $post->ID, 'sc_event_featured_status', true ),
				);
			},
			$posts
		);
	}

	/**
	 * Events this member has RSVP'd "going" to, soonest first — distinct
	 * from get_my_events (which is authorship, not attendance). RSVPs are
	 * stored as a serialized array of user ids in each event's own
	 * sc_event_rsvp_going meta (see get_going_ids), not indexed by user,
	 * so finding "my" RSVPs means searching the other direction: a direct
	 * LIKE against the serialized fragment PHP produces for that id
	 * (`i:{$user_id};`) — the leading `i:` and trailing `;` make it exact,
	 * so id 5 can't false-match inside id 15 or 25.
	 */
	public static function get_my_rsvps( WP_REST_Request $request ) {
		global $wpdb;
		$user_id = get_current_user_id();

		$event_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = 'sc_event_rsvp_going' AND meta_value LIKE %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				'%' . $wpdb->esc_like( 'i:' . $user_id . ';' ) . '%'
			)
		);

		if ( empty( $event_ids ) ) {
			return array();
		}

		$posts = get_posts(
			array(
				'post_type'      => SC_Events_CPT::POST_TYPE,
				'post__in'       => array_map( 'intval', $event_ids ),
				'post_status'    => 'publish',
				'posts_per_page' => 50,
				'orderby'        => 'meta_value',
				'meta_key'       => 'sc_start',
				'order'          => 'ASC',
			)
		);

		return array_map(
			function ( $post ) {
				return array(
					'id'    => $post->ID,
					'title' => get_the_title( $post ),
					'slug'  => $post->post_name,
					'start' => get_post_meta( $post->ID, 'sc_start', true ),
				);
			},
			$posts
		);
	}

	/**
	 * Owner requests their own submitted event be featured — sets the
	 * request status only, never sc_event_featured itself (see that
	 * field's docblock: it stays a manual wp-admin toggle, same reasoning
	 * as sc-membership's directory upgrade). No payment automation yet;
	 * an admin records what was actually paid when approving.
	 */
	public static function request_featured( WP_REST_Request $request ) {
		$event_id = (int) $request->get_param( 'id' );
		$event    = self::require_event( $event_id );
		if ( is_wp_error( $event ) ) {
			return $event;
		}

		$status = get_post_meta( $event_id, 'sc_event_featured_status', true );
		if ( 'pending' === $status ) {
			return new WP_Error( 'already_pending', 'A featured request is already pending review.', array( 'status' => 409 ) );
		}

		update_post_meta( $event_id, 'sc_event_featured_status', 'pending' );
		update_post_meta( $event_id, 'sc_event_featured_requested_at', current_time( 'mysql' ) );

		return array( 'status' => 'pending' );
	}

	/**
	 * Events go live the moment they're submitted (Rob's decision,
	 * 2026-10 — events redesign). Rob gets an email for every one (see
	 * SC_Events_Hooks::on_event_submitted) and removes anything unsuitable
	 * after the fact, rather than events sitting in a review queue.
	 */
	public static function submit_event( WP_REST_Request $request ) {
		$title = sanitize_text_field( (string) $request->get_param( 'title' ) );
		if ( ! $title ) {
			return new WP_Error( 'missing_title', 'An event title is required.', array( 'status' => 400 ) );
		}

		$start = sanitize_text_field( (string) $request->get_param( 'start' ) );
		if ( ! $start ) {
			return new WP_Error( 'missing_start', 'A start date/time is required.', array( 'status' => 400 ) );
		}

		$valid = self::validate_request( $request );
		if ( is_wp_error( $valid ) ) {
			return $valid;
		}

		$user_id = get_current_user_id();

		$post_id = wp_insert_post(
			array(
				'post_type'      => SC_Events_CPT::POST_TYPE,
				'post_status'    => 'publish',
				'post_title'     => $title,
				'post_content'   => wp_kses_post( (string) $request->get_param( 'description' ) ),
				'post_author'    => $user_id,
				// Explicit, not left to get_default_comment_status(): the
				// event's comment box should be open the moment it's
				// live, regardless of what the site's global
				// default-comment-status option happens to be set to.
				'comment_status' => 'open',
			),
			true
		);

		if ( is_wp_error( $post_id ) ) {
			return new WP_Error( 'submit_failed', $post_id->get_error_message(), array( 'status' => 400 ) );
		}

		self::set_taxonomies_from_request( $post_id, $request );
		self::update_meta_from_request( $post_id, $request );

		do_action( 'sc_events_event_submitted', $user_id, $post_id );

		return array( 'status' => get_post_status( $post_id ), 'id' => $post_id, 'slug' => get_post_field( 'post_name', $post_id ) );
	}

	/**
	 * Members submit/edit as plain post data via this custom route (not
	 * WP's own wp/v2/sc-events/{id}) because Subscriber has no edit_posts
	 * capability at all — see check_owns_event()'s docblock. Every field
	 * is optional here (unlike submit_event's required title/start) so a
	 * partial edit — e.g. just fixing a typo in the venue address —
	 * doesn't force resending the whole form.
	 */
	public static function update_event( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'id' );
		$update  = array( 'ID' => $post_id );

		$valid = self::validate_request( $request );
		if ( is_wp_error( $valid ) ) {
			return $valid;
		}

		if ( null !== $request->get_param( 'title' ) ) {
			$title = sanitize_text_field( (string) $request->get_param( 'title' ) );
			if ( ! $title ) {
				return new WP_Error( 'missing_title', 'An event title is required.', array( 'status' => 400 ) );
			}
			$update['post_title'] = $title;
		}
		if ( null !== $request->get_param( 'description' ) ) {
			$update['post_content'] = wp_kses_post( (string) $request->get_param( 'description' ) );
		}

		if ( count( $update ) > 1 ) {
			$result = wp_update_post( $update, true );
			if ( is_wp_error( $result ) ) {
				return new WP_Error( 'update_failed', $result->get_error_message(), array( 'status' => 400 ) );
			}
		}

		self::set_taxonomies_from_request( $post_id, $request );
		self::update_meta_from_request( $post_id, $request );

		return array( 'status' => get_post_status( $post_id ), 'id' => $post_id );
	}

	/** Shared by submit_event and update_event — only touches params actually present in the request. */
	private static function set_taxonomies_from_request( $post_id, WP_REST_Request $request ) {
		if ( null !== $request->get_param( 'category' ) ) {
			$category = sanitize_key( (string) $request->get_param( 'category' ) );
			if ( $category && term_exists( $category, SC_Events_CPT::TAXONOMY ) ) {
				wp_set_object_terms( $post_id, $category, SC_Events_CPT::TAXONOMY );
			}
		}

		if ( null !== $request->get_param( 'tags' ) ) {
			$raw  = $request->get_param( 'tags' );
			$slugs = is_array( $raw ) ? $raw : array_filter( array_map( 'trim', explode( ',', (string) $raw ) ) );
			$valid = array();
			foreach ( $slugs as $slug ) {
				$slug = sanitize_key( (string) $slug );
				if ( $slug && term_exists( $slug, SC_Events_CPT::TAG_TAXONOMY ) ) {
					$valid[] = $slug;
				}
			}
			wp_set_object_terms( $post_id, $valid, SC_Events_CPT::TAG_TAXONOMY );
		}
	}

	/** Shared by submit_event and update_event — only touches params actually present in the request. */
	private static function update_meta_from_request( $post_id, WP_REST_Request $request ) {
		$fields = array(
			'start'             => 'sc_start',
			'end'               => 'sc_end',
			'venue_name'        => 'sc_venue_name',
			'venue_address'     => 'sc_venue_address',
			'organizer'         => 'sc_organizer',
			'event_url'         => 'sc_event_url',
			'price_type'        => 'sc_price_type',
			'price_amount'      => 'sc_price_amount',
			'price_concession'  => 'sc_price_concession',
			'booking_type'      => 'sc_booking_type',
			'booking_link_kind' => 'sc_booking_link_kind',
			'booking_email'     => 'sc_booking_email',
			'booking_phone'     => 'sc_booking_phone',
			'repeat_pattern'    => 'sc_repeat_pattern',
		);
		foreach ( $fields as $param => $meta_key ) {
			if ( null === $request->get_param( $param ) ) {
				continue;
			}
			// update_post_meta runs the sanitize_callback each field was
			// registered with (see SC_Events_Meta::register) — enums,
			// price amount, email-not-a-URL — so no per-field cleaning here.
			update_post_meta( $post_id, $meta_key, (string) $request->get_param( $param ) );
		}

		if ( null !== $request->get_param( 'price_from' ) ) {
			update_post_meta( $post_id, 'sc_price_from', rest_sanitize_boolean( $request->get_param( 'price_from' ) ) );
		}

		self::set_repeat_dates_from_request( $post_id, $request );

		self::set_listing_from_request( $post_id, $request );
		self::set_organizer_from_request( $post_id, $request );
	}

	/**
	 * A repeating event is one post with many dates (see SC_Events_Meta).
	 * Whenever a non-empty list is saved, sc_start is moved to its first
	 * date so the two can never disagree. An empty list turns repeating
	 * off and leaves sc_start alone.
	 */
	private static function set_repeat_dates_from_request( $post_id, WP_REST_Request $request ) {
		if ( null === $request->get_param( 'repeat_dates' ) ) {
			return;
		}
		$dates = SC_Events_Meta::sanitize_repeat_dates( $request->get_param( 'repeat_dates' ) );
		update_post_meta( $post_id, 'sc_repeat_dates', $dates );
		if ( ! empty( $dates ) ) {
			update_post_meta( $post_id, 'sc_start', $dates[0] );
		} else {
			update_post_meta( $post_id, 'sc_repeat_pattern', '' );
		}
	}

	/**
	 * Attaches a reusable sc_event_organizer term to this event — either an
	 * existing one (organizer_id, picked from the form's list) or a brand
	 * new one (organizer_name + optional address/phone/url/socials, typed
	 * in by the submitter). Members have no manage_categories capability
	 * so they can't create or edit a term through WordPress's own REST
	 * auth — same capability gap check_owns_event's docblock covers for
	 * post editing — so this does the term creation/attachment itself in
	 * PHP, the same "the REST layer trusts its own validation" pattern
	 * set_listing_from_request already uses for listing_id.
	 *
	 * Leaves the legacy sc_organizer/sc_event_url meta fields completely
	 * alone — both mechanisms can coexist on the same event, and the
	 * frontend prefers this structured profile when one is attached.
	 *
	 * organizer_id = 0 (or any falsy value) clears the association, same
	 * as listing_id's own convention. organizer_id takes priority over
	 * organizer_name when both are somehow present (picking an existing
	 * organiser and also typing a name shouldn't create a duplicate).
	 */
	private static function set_organizer_from_request( $post_id, WP_REST_Request $request ) {
		// organizer_id, whenever the key is present at all (even "" or "0"),
		// is the authoritative signal: it either attaches a known term or
		// explicitly clears the association. Only when the key is entirely
		// absent does the form mean "I'm adding a brand new one" — see
		// organizer_name below. This mirrors set_listing_from_request's own
		// "falsy clears, explicit presence required" convention.
		$organizer_id = $request->get_param( 'organizer_id' );
		if ( null !== $organizer_id ) {
			$organizer_id = (int) $organizer_id;
			if ( ! $organizer_id ) {
				wp_set_object_terms( $post_id, array(), SC_Events_CPT::ORGANIZER_TAXONOMY );
				return;
			}
			$term = get_term( $organizer_id, SC_Events_CPT::ORGANIZER_TAXONOMY );
			if ( $term && ! is_wp_error( $term ) ) {
				wp_set_object_terms( $post_id, array( $organizer_id ), SC_Events_CPT::ORGANIZER_TAXONOMY );
			}
			return;
		}

		$name = $request->get_param( 'organizer_name' );
		if ( null === $name || '' === trim( (string) $name ) ) {
			return;
		}
		$name = sanitize_text_field( (string) $name );

		// Reusing an existing organiser's name attaches that same term
		// rather than creating a near-duplicate — but never overwrites
		// their already-stored contact details just because a second
		// submitter typed the same name in the "add new" field.
		$existing = get_term_by( 'name', $name, SC_Events_CPT::ORGANIZER_TAXONOMY );
		if ( $existing ) {
			wp_set_object_terms( $post_id, array( $existing->term_id ), SC_Events_CPT::ORGANIZER_TAXONOMY );
			return;
		}

		$about    = $request->get_param( 'organizer_about' );
		$inserted = wp_insert_term(
			$name,
			SC_Events_CPT::ORGANIZER_TAXONOMY,
			array( 'description' => null === $about ? '' : sanitize_textarea_field( (string) $about ) )
		);
		if ( is_wp_error( $inserted ) ) {
			return;
		}
		$term_id = is_array( $inserted ) ? $inserted['term_id'] : $inserted;

		$fields = array(
			'organizer_address'   => 'sc_organizer_address',
			'organizer_phone'     => 'sc_organizer_phone',
			'organizer_url'       => 'sc_organizer_url',
			'organizer_socials'   => 'sc_organizer_socials',
			'organizer_email'     => 'sc_organizer_email',
			'organizer_facebook'  => 'sc_organizer_facebook',
			'organizer_instagram' => 'sc_organizer_instagram',
			'organizer_x'         => 'sc_organizer_x',
			'organizer_tiktok'    => 'sc_organizer_tiktok',
		);
		foreach ( $fields as $param => $meta_key ) {
			$value = $request->get_param( $param );
			if ( null === $value || '' === trim( (string) $value ) ) {
				continue;
			}
			$value = call_user_func( SC_Events_Organizer_Meta::sanitizer_for( $meta_key ), (string) $value );
			update_term_meta( $term_id, $meta_key, $value );
		}

		// Only an image the submitter uploaded themselves — otherwise any
		// attachment ID on the site could be borrowed as someone's logo.
		$logo_id = (int) $request->get_param( 'organizer_logo' );
		if ( $logo_id ) {
			$logo = get_post( $logo_id );
			if ( $logo && 'attachment' === $logo->post_type && wp_attachment_is_image( $logo_id )
				&& ( (int) $logo->post_author === get_current_user_id() || current_user_can( 'manage_options' ) ) ) {
				update_term_meta( $term_id, 'sc_organizer_logo', $logo_id );
			}
		}

		wp_set_object_terms( $post_id, array( $term_id ), SC_Events_CPT::ORGANIZER_TAXONOMY );
	}

	/**
	 * "Hosted by [company]" on the frontend, not "Submitted by [member]" —
	 * a business's event should credit the business, not whichever person's
	 * account happened to submit it. listing_id=0 (or any falsy value)
	 * clears the association back to "no company", same as tags clearing
	 * on an empty array. A listing that doesn't exist, isn't an sc_listing,
	 * or isn't owned by the current user is silently ignored rather than
	 * erroring — same "skip invalid, don't fail the whole update" pattern
	 * category/tags already use, and it closes the obvious attempt to
	 * attach someone else's business to your event.
	 */
	private static function set_listing_from_request( $post_id, WP_REST_Request $request ) {
		if ( null === $request->get_param( 'listing_id' ) ) {
			return;
		}

		$listing_id = (int) $request->get_param( 'listing_id' );
		if ( ! $listing_id ) {
			update_post_meta( $post_id, 'sc_event_listing_id', 0 );
			return;
		}

		$listing = get_post( $listing_id );
		if ( $listing && 'sc_listing' === $listing->post_type && (int) $listing->post_author === get_current_user_id() ) {
			update_post_meta( $post_id, 'sc_event_listing_id', $listing_id );
		}
	}

	/**
	 * Every distinct venue name already in use, each with its most
	 * recently-used address — powers the add/edit event form's venue
	 * picker (existing locations + "add a new one"), so submitters aren't
	 * retyping "Honeywood Museum" slightly differently every time and
	 * splintering /events/venue/{slug} across near-duplicate slugs.
	 */
	public static function get_venues( WP_REST_Request $request ) {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT pm.meta_value AS name, addr.meta_value AS address
				FROM {$wpdb->postmeta} pm
				INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				LEFT JOIN {$wpdb->postmeta} addr ON addr.post_id = pm.post_id AND addr.meta_key = 'sc_venue_address'
				WHERE pm.meta_key = 'sc_venue_name' AND pm.meta_value != '' AND p.post_type = %s AND p.post_status = 'publish'
				ORDER BY pm.meta_value ASC, p.post_date DESC",
				SC_Events_CPT::POST_TYPE
			)
		);

		$seen   = array();
		$venues = array();
		foreach ( $rows as $row ) {
			$name = trim( $row->name );
			if ( '' === $name || isset( $seen[ $name ] ) ) {
				continue;
			}
			$seen[ $name ] = true;
			$venues[]      = array(
				'name'    => $name,
				'address' => $row->address ? $row->address : '',
			);
		}

		return $venues;
	}

	private static function get_going_ids( $event_id ) {
		$ids = get_post_meta( $event_id, 'sc_event_rsvp_going', true );
		return is_array( $ids ) ? array_map( 'intval', $ids ) : array();
	}

	private static function require_event( $event_id ) {
		$event = get_post( $event_id );
		if ( ! $event || SC_Events_CPT::POST_TYPE !== $event->post_type ) {
			return new WP_Error( 'not_found', 'Event not found.', array( 'status' => 404 ) );
		}
		return $event;
	}

	public static function get_rsvp_status( WP_REST_Request $request ) {
		$event_id = (int) $request->get_param( 'id' );
		$event    = self::require_event( $event_id );
		if ( is_wp_error( $event ) ) {
			return $event;
		}
		$going = self::get_going_ids( $event_id );
		return array(
			'going'       => in_array( get_current_user_id(), $going, true ),
			'going_count' => count( $going ),
		);
	}

	/**
	 * Idempotent on purpose: repeat POSTs from a user who's already going
	 * (double-click, refresh-and-resubmit) must not re-fire the points
	 * hook every time. sc_event_rsvp_awarded tracks "has this user ever
	 * been awarded points for this event" separately from
	 * sc_event_rsvp_going ("is this user currently marked as going"), so
	 * going -> not going -> going again doesn't farm points on the second
	 * RSVP either.
	 */
	public static function rsvp( WP_REST_Request $request ) {
		$event_id = (int) $request->get_param( 'id' );
		$event    = self::require_event( $event_id );
		if ( is_wp_error( $event ) ) {
			return $event;
		}

		$user_id = get_current_user_id();
		$going   = self::get_going_ids( $event_id );

		if ( ! in_array( $user_id, $going, true ) ) {
			$going[] = $user_id;
			update_post_meta( $event_id, 'sc_event_rsvp_going', $going );

			$awarded = get_post_meta( $event_id, 'sc_event_rsvp_awarded', true );
			$awarded = is_array( $awarded ) ? array_map( 'intval', $awarded ) : array();
			if ( ! in_array( $user_id, $awarded, true ) ) {
				$awarded[] = $user_id;
				update_post_meta( $event_id, 'sc_event_rsvp_awarded', $awarded );
				do_action( 'sc_events_rsvp', $user_id, $event_id );
			}
		}

		return array( 'status' => 'going', 'going_count' => count( $going ) );
	}

	/** Removes the user from the "going" list. Points already awarded are never clawed back. */
	public static function un_rsvp( WP_REST_Request $request ) {
		$event_id = (int) $request->get_param( 'id' );
		$event    = self::require_event( $event_id );
		if ( is_wp_error( $event ) ) {
			return $event;
		}

		$user_id = get_current_user_id();
		$going   = array_values( array_diff( self::get_going_ids( $event_id ), array( $user_id ) ) );
		update_post_meta( $event_id, 'sc_event_rsvp_going', $going );

		return array( 'status' => 'not_going', 'going_count' => count( $going ) );
	}
}
