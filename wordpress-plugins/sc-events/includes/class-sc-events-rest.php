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
	}

	/**
	 * Members can't edit posts at all (Subscriber has no edit_posts
	 * capability — see the CPT's map_meta_cap docblock), so this can't
	 * rely on WP's own capability checks the way an Editor/Admin route
	 * could. Ownership is the entire security boundary here: logged in,
	 * and the post really is theirs.
	 */
	public static function check_owns_event( WP_REST_Request $request ) {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'not_logged_in', 'You must be logged in.', array( 'status' => 401 ) );
		}
		$event = get_post( (int) $request->get_param( 'id' ) );
		if ( ! $event || SC_Events_CPT::POST_TYPE !== $event->post_type ) {
			return new WP_Error( 'not_found', 'Event not found.', array( 'status' => 404 ) );
		}
		if ( (int) $event->post_author !== get_current_user_id() ) {
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
