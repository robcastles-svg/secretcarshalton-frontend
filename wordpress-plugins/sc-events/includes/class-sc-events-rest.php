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
	}

	/**
	 * Lets a real organiser take ownership of an event that's currently
	 * sitting under the staff/import account — mirrors
	 * SC_Directory_REST::claim_listing exactly (unclaimed only, reassigns
	 * post_author, no verification beyond "you're logged in", same as
	 * directory claims already work). Once claimed, sc_event_author_is_staff
	 * naturally flips to false, so the claim button/submitted-by button hide
	 * and show correctly without any extra state to keep in sync.
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

		$user_id = get_current_user_id();

		wp_update_post(
			array(
				'ID'          => $event_id,
				'post_author' => $user_id,
			)
		);

		/** sc-membership listens for this and awards claim points. */
		do_action( 'sc_events_event_claimed', $user_id, $event_id );

		return array( 'status' => 'claimed' );
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
					'id'     => $post->ID,
					'title'  => get_the_title( $post ),
					'status' => $post->post_status,
					'slug'   => $post->post_name,
					'start'  => get_post_meta( $post->ID, 'sc_start', true ),
				);
			},
			$posts
		);
	}

	/** Same pending-for-review model as sc-directory's submit_listing. */
	public static function submit_event( WP_REST_Request $request ) {
		$title = sanitize_text_field( (string) $request->get_param( 'title' ) );
		if ( ! $title ) {
			return new WP_Error( 'missing_title', 'An event title is required.', array( 'status' => 400 ) );
		}

		$start = sanitize_text_field( (string) $request->get_param( 'start' ) );
		if ( ! $start ) {
			return new WP_Error( 'missing_start', 'A start date/time is required.', array( 'status' => 400 ) );
		}

		$user_id = get_current_user_id();

		$post_id = wp_insert_post(
			array(
				'post_type'      => SC_Events_CPT::POST_TYPE,
				'post_status'    => 'pending',
				'post_title'     => $title,
				'post_content'   => wp_kses_post( (string) $request->get_param( 'description' ) ),
				'post_author'    => $user_id,
				// Explicit, not left to get_default_comment_status(): a
				// pending event's comment box should be open for review
				// discussion the moment it's submitted, regardless of
				// what the site's global default-comment-status option
				// happens to be set to.
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

		return array( 'status' => 'pending', 'id' => $post_id );
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
			'start'         => 'sc_start',
			'end'           => 'sc_end',
			'venue_name'    => 'sc_venue_name',
			'venue_address' => 'sc_venue_address',
			'organizer'     => 'sc_organizer',
			'event_url'     => 'sc_event_url',
		);
		foreach ( $fields as $param => $meta_key ) {
			if ( null === $request->get_param( $param ) ) {
				continue;
			}
			$value = (string) $request->get_param( $param );
			update_post_meta( $post_id, $meta_key, 'event_url' === $param ? esc_url_raw( $value ) : sanitize_text_field( $value ) );
		}

		self::set_listing_from_request( $post_id, $request );
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
