<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface the Next.js frontend talks to for the member dashboard.
 * Namespace: sc-membership/v1
 */
class SC_Membership_REST {

	/**
	 * A run of member accounts (business/organisation names, mostly —
	 * "Curated by Dapper & Suave" and friends) have display_name stored
	 * in wp_users with the "&" already HTML-entity-encoded as "&amp;" —
	 * confirmed via $user->data (the raw, unfiltered DB row: WP_User's
	 * own magic ->display_name getter applies its own 'display' escaping
	 * on top, which would double it further) still coming back escaped.
	 * Baked in at account creation/import, not something the read path
	 * introduces — decode defensively here so the JSON API always
	 * carries the true text either way; a name with no entities in it
	 * passes through unchanged.
	 */
	private static function clean_display_name( $raw_display_name ) {
		return wp_specialchars_decode( (string) $raw_display_name, ENT_QUOTES );
	}

	public static function register_routes() {
		/**
		 * Star rating for a review — stored as comment meta (sc_rating,
		 * 1-5), not a custom REST route: the frontend already reads
		 * comments straight from WP core's own /wp/v2/comments?post=
		 * endpoint (see getCommentsForPost), so surfacing this as a REST
		 * field on core's comment object type is the one place it needs to
		 * be added, rather than a second parallel comments endpoint. Only
		 * meaningful on directory-listing reviews in practice, but exposed
		 * on every comment — harmless null for the ones without one.
		 */
		register_rest_field(
			'comment',
			'rating',
			array(
				'get_callback' => function ( $comment ) {
					$rating = get_comment_meta( $comment['id'], 'sc_rating', true );
					return '' === $rating ? null : (int) $rating;
				},
				'schema'       => array(
					'type' => array( 'integer', 'null' ),
				),
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/me',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_me' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/directory-upgrade-request',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'request_directory_upgrade' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/leaderboard',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_leaderboard' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/comments',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'submit_comment' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/comments/(?P<id>\d+)/edit',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'update_comment' ),
				/**
				 * Wide open like /comments above — update_comment() itself
				 * does the real check (own comment, still within the edit
				 * window) and 403s otherwise, same division of labour as
				 * every other ownership-gated route in this codebase (see
				 * check_owns_listing for the directory equivalent).
				 */
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/my-comments',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_my_comments' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/comments-by-user',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_comments_by_user' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/bookmarks/state',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_bookmark_state' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/bookmarks/toggle',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'toggle_bookmark' ),
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/members',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_members' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/members-by-id',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_members_by_id' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/members/(?P<slug>[^/]+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_member_by_slug' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			'sc-membership/v1',
			'/members/(?P<id>\d+)/moderate',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'moderate_member' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);
	}

	/**
	 * The public member-profile page (/members/{slug}) was 404ing for
	 * almost everyone in the /members list — get_members() above lists
	 * every registered user, but this used to go through WP core's own
	 * wp/v2/users?slug= route, which silently hides any account that
	 * hasn't authored public content (a WP core privacy default). That's
	 * most of this site's members, since most haven't posted an event or
	 * listing. Same fix as get_members(): a plain get_user_by() lookup,
	 * no such restriction.
	 */
	public static function get_member_by_slug( WP_REST_Request $request ) {
		$slug = sanitize_title( (string) $request->get_param( 'slug' ) );
		$user = get_user_by( 'slug', $slug );

		if ( ! $user || SC_Membership_DB::is_pending_review( $user->ID ) ) {
			return new WP_Error( 'not_found', 'Member not found.', array( 'status' => 404 ) );
		}

		$avatar = get_avatar_url( $user->ID, array( 'size' => 96 ) );
		$member = SC_Membership_DB::get_or_create_member( $user->ID );
		$tier   = SC_Membership_Tiers::get( $member->tier );

		return array(
			'id'              => $user->ID,
			'name'            => self::clean_display_name( $user->data->display_name ),
			'slug'            => $user->user_nicename,
			'description'     => get_user_meta( $user->ID, 'description', true ),
			'avatar_urls'     => array(
				'24' => $avatar,
				'48' => $avatar,
				'96' => $avatar,
			),
			'banned'          => self::is_banned( $user->ID ),
			'points'          => (int) $member->points,
			'tier'            => array(
				'slug'  => $tier['slug'],
				'label' => $tier['label'],
			),
			/**
			 * Not every point source has its own section below — RSVPing
			 * to an event awards points but leaves no "submitted"
			 * anything to list, which otherwise makes a real, active
			 * member's profile look entirely blank. This is the same
			 * points-log data get_me() already shows the member privately
			 * on their own dashboard.
			 */
			'recent_activity' => array_map(
				function ( $entry ) {
					return array(
						'points' => (int) $entry->points_delta,
						'reason' => $entry->reason,
						'date'   => $entry->created_at,
					);
				},
				SC_Membership_Points::recent_activity( $user->ID, 10 )
			),
		);
	}

	/**
	 * "Ban/spam" a member — BuddyPress (confirmed active on this install,
	 * see the avatar filter's mystery-man.jpg path) already has a real,
	 * standalone-site-safe version of this via
	 * bp_core_process_spammer_status(): it hides the member's BuddyPress
	 * content sitewide and blocks them logging in. Falls back to a plain
	 * user-meta flag + the wp_authenticate_user login block below if
	 * BuddyPress isn't active for some reason, so this never silently
	 * no-ops.
	 */
	public static function is_banned( $user_id ) {
		if ( function_exists( 'bp_is_user_spammer' ) ) {
			return (bool) bp_is_user_spammer( $user_id );
		}
		return '1' === get_user_meta( $user_id, 'sc_member_banned', true );
	}

	public static function moderate_member( WP_REST_Request $request ) {
		$user_id = (int) $request->get_param( 'id' );
		$action  = sanitize_key( (string) $request->get_param( 'action' ) );

		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return new WP_Error( 'not_found', 'Member not found.', array( 'status' => 404 ) );
		}
		if ( user_can( $user_id, 'manage_options' ) ) {
			return new WP_Error( 'not_allowed', 'Admin accounts can\'t be banned.', array( 'status' => 403 ) );
		}
		if ( ! in_array( $action, array( 'ban', 'unban' ), true ) ) {
			return new WP_Error( 'invalid_action', 'Unknown action.', array( 'status' => 400 ) );
		}

		if ( function_exists( 'bp_core_process_spammer_status' ) ) {
			bp_core_process_spammer_status( $user_id, 'ban' === $action ? 'spam' : 'ham' );
		} else {
			update_user_meta( $user_id, 'sc_member_banned', 'ban' === $action ? '1' : '0' );
		}

		return array( 'status' => 'ban' === $action ? 'banned' : 'unbanned' );
	}

	/**
	 * Every member shows the same branded badge, full stop — no Gravatar,
	 * no BuddyPress-uploaded photo. Originally this only replaced the
	 * generic mystery-man.jpg fallback, but Rob wants profile photos off
	 * the table entirely (see the dashboard's removed "Upload photo"
	 * button): the directory is meant to be the place people put effort
	 * into representing their business, not a personal-profile feature.
	 * Registered globally via get_avatar_url so it applies everywhere an
	 * avatar is resolved: this plugin's own /members endpoint and WP
	 * core's /wp/v2/users (which the public member-profile page reads
	 * its avatar from).
	 */
	public static function filter_default_avatar( $url, $id_or_email, $args ) {
		return SC_Membership_Auth::FRONTEND_URL . '/default-avatar.png';
	}

	/**
	 * Every registered member, for the public "browse members" list —
	 * deliberately not wp/v2/users: WP core's REST users list only
	 * surfaces accounts that have authored public content, which would
	 * silently hide any member who's registered but hasn't posted an
	 * event/listing yet. Administrators are excluded — this is a member
	 * directory, not a staff list.
	 */
	/**
	 * Points are included so the frontend can offer a "most active" sort
	 * alongside alphabetical — a plain array_map over $users can't do that
	 * lookup itself, since a member only gets a row in sc_members the
	 * first time they earn points (see SC_Membership_DB::get_or_create_member),
	 * so most users here have no row at all and default to 0.
	 */
	public static function get_members( WP_REST_Request $request ) {
		$users = get_users(
			array(
				'role__not_in' => array( 'administrator' ),
				'orderby'      => 'display_name',
				'order'        => 'ASC',
				'number'       => 500,
			)
		);

		// Accounts flagged pending review (e.g. a URL-as-username spam
		// signup — see SC_Membership_DB::username_looks_like_url) stay
		// out of the public list until an admin republishes or removes
		// them from the pending-members queue.
		$users = array_values(
			array_filter(
				$users,
				function ( $user ) {
					return ! SC_Membership_DB::is_pending_review( $user->ID );
				}
			)
		);

		global $wpdb;
		$table          = SC_Membership_DB::members_table();
		$points_by_user = array();
		foreach ( $wpdb->get_results( "SELECT user_id, points FROM {$table}" ) as $row ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$points_by_user[ (int) $row->user_id ] = (int) $row->points;
		}

		return array_map(
			function ( $user ) use ( $points_by_user ) {
				return array(
					'id'           => $user->ID,
					'display_name' => self::clean_display_name( $user->data->display_name ),
					'slug'         => $user->user_nicename,
					'avatar'       => get_avatar_url( $user->ID, array( 'size' => 96 ) ),
					'points'       => $points_by_user[ $user->ID ] ?? 0,
				);
			},
			$users
		);
	}

	/**
	 * Batch id -> {slug, avatar} lookup so a comment thread can link each
	 * commenter's name/icon to their public profile without either
	 * fetching all ~500 members per page view or hitting WP core's
	 * /wp/v2/users (blocked for anonymous requests — "rest_user_cannot_view").
	 * Same exclusions as get_members(): staff and pending-review accounts
	 * don't get a public profile link, so their comments render as plain
	 * text same as an unregistered/guest commenter (author id 0).
	 */
	public static function get_members_by_id( WP_REST_Request $request ) {
		$ids = array_filter( array_map( 'intval', explode( ',', (string) $request->get_param( 'ids' ) ) ) );
		if ( empty( $ids ) ) {
			return array();
		}

		$users = get_users(
			array(
				'include'       => $ids,
				'role__not_in'  => array( 'administrator' ),
			)
		);

		$result = array();
		foreach ( $users as $user ) {
			if ( SC_Membership_DB::is_pending_review( $user->ID ) ) {
				continue;
			}
			// Same "member since" the private dashboard already shows via
			// get_me() — SC_Membership_DB::get_or_create_member()'s
			// joined_at, not core's user_registered (see that method's own
			// docblock for why: it's set the first time a member earns
			// points, same field, same meaning, just reused publicly here).
			$member   = SC_Membership_DB::get_or_create_member( $user->ID );
			$result[] = array(
				'id'        => $user->ID,
				'slug'      => $user->user_nicename,
				'name'      => self::clean_display_name( $user->data->display_name ),
				'avatar'    => get_avatar_url( $user->ID, array( 'size' => 48 ) ),
				'joined_at' => $member->joined_at,
			);
		}
		return $result;
	}

	/**
	 * Powers the "their comments" section on a member's *public* profile
	 * page — unlike get_my_comments() (own account, any status), this is
	 * reachable by anyone with the user's ID, so it's deliberately
	 * narrower: approved comments only, no held/spam/trash leakage.
	 */
	public static function get_comments_by_user( WP_REST_Request $request ) {
		$user_id = (int) $request->get_param( 'user_id' );
		if ( ! $user_id ) {
			return new WP_Error( 'missing_user_id', 'A user_id is required.', array( 'status' => 400 ) );
		}

		$comments = get_comments(
			array(
				'user_id' => $user_id,
				'status'  => 'approve',
				'number'  => 20,
				'orderby' => 'comment_date',
				'order'   => 'DESC',
			)
		);

		return array_map(
			function ( $comment ) {
				$post = get_post( $comment->comment_post_ID );
				return array(
					'id'         => (int) $comment->comment_ID,
					'content'    => array( 'rendered' => apply_filters( 'comment_text', $comment->comment_content, $comment ) ),
					'date'       => $comment->comment_date,
					'post_type'  => $post ? $post->post_type : null,
					'post_slug'  => $post ? $post->post_name : null,
					'post_title' => $post ? get_the_title( $post ) : null,
				);
			},
			$comments
		);
	}

	/** The dashboard's "Your comments" section — across any status, own account only. */
	public static function get_my_comments( WP_REST_Request $request ) {
		// No 'status' key: get_comments() only filters by comment_approved
		// when one is explicitly passed, so this already returns the
		// member's comments across every status (approved, held, spam,
		// trash) without needing 'all' as a literal value.
		$comments = get_comments(
			array(
				'user_id' => get_current_user_id(),
				'number'  => 50,
				'orderby' => 'comment_date',
				'order'   => 'DESC',
			)
		);

		return array_map(
			function ( $comment ) {
				$post = get_post( $comment->comment_post_ID );
				return array(
					'id'        => (int) $comment->comment_ID,
					'content'   => array( 'rendered' => apply_filters( 'comment_text', $comment->comment_content, $comment ) ),
					'date'      => $comment->comment_date,
					'status'    => wp_get_comment_status( $comment->comment_ID ),
					'post_type' => $post ? $post->post_type : null,
					'post_slug' => $post ? $post->post_name : null,
					'post_title' => $post ? get_the_title( $post ) : null,
				);
			},
			$comments
		);
	}

	public static function get_me( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		$member  = SC_Membership_DB::get_or_create_member( $user_id );
		$tier    = SC_Membership_Tiers::get( $member->tier );
		$next    = SC_Membership_Tiers::points_to_next_tier( (int) $member->points );

		return array(
			'id'                       => $user_id,
			'display_name'             => self::clean_display_name( get_userdata( $user_id )->data->display_name ),
			// Set by SC_Membership_Auth::record_visit on every login/register
			// that issued this member's current session — false only for
			// the very first one, so the dashboard can say "Hello" once and
			// "Welcome back" from then on.
			'is_returning'             => (int) get_user_meta( $user_id, 'sc_member_login_count', true ) > 1,
			// 'edit_others_posts' is Editor/Administrator only — Author and
			// below can't. Used by the frontend to gate the AI editorial
			// draft tool (brief section 11's admin/editor role split), not
			// as a security boundary itself: the real boundary is that
			// publishing still goes through WordPress's own wp/v2/posts
			// REST controller, which enforces this same capability
			// server-side regardless of what the frontend shows.
			'is_editor'                => user_can( $user_id, 'edit_others_posts' ),
			'email_verified'           => SC_Membership_Auth::is_verified( $user_id ),
			'points'                   => (int) $member->points,
			'tier'                     => array(
				'slug'  => $tier['slug'],
				'label' => $tier['label'],
			),
			'points_to_next_tier'      => $next ? $next['points'] : null,
			'next_tier'                => $next ? array(
				'slug'  => $next['tier']['slug'],
				'label' => $next['tier']['label'],
			) : null,
			'directory_upgrade_status' => $member->directory_upgrade_status,
			'directory_upgrade_listing_id' => $member->directory_upgrade_listing_id ? (int) $member->directory_upgrade_listing_id : null,
			'joined_at'                => $member->joined_at,
			'recent_activity'          => array_map(
				function ( $entry ) {
					return array(
						'points' => (int) $entry->points_delta,
						'reason' => $entry->reason,
						'source' => $entry->source,
						'date'   => $entry->created_at,
					);
				},
				SC_Membership_Points::recent_activity( $user_id, 10 )
			),
		);
	}

	public static function request_directory_upgrade( WP_REST_Request $request ) {
		$user_id    = get_current_user_id();
		$member     = SC_Membership_DB::get_or_create_member( $user_id );
		$listing_id = $request->get_param( 'listing_id' ) ? (int) $request->get_param( 'listing_id' ) : null;

		if ( 'pending' === $member->directory_upgrade_status ) {
			return new WP_Error( 'already_pending', 'An upgrade request is already pending review.', array( 'status' => 409 ) );
		}

		do_action( 'sc_directory_upgrade_requested', $user_id, $listing_id );

		return array( 'status' => 'pending' );
	}

	/** A week to edit your own comment/review after posting — see update_comment(). */
	const COMMENT_EDIT_WINDOW = WEEK_IN_SECONDS;

	/** 1-5 or null — anything else (0, out of range, non-numeric) is treated as "no rating given". */
	private static function sanitize_rating( $raw ) {
		$rating = (int) $raw;
		return ( $rating >= 1 && $rating <= 5 ) ? $rating : null;
	}

	/**
	 * Forces every comment straight to the moderation queue, regardless of
	 * the site's own Discussion settings (comment_previously_approved would
	 * otherwise auto-approve a returning commenter's second-and-later
	 * comments) — Rob wants every comment/review reviewed before it's
	 * public, no exceptions. wp_new_comment() always overwrites whatever
	 * comment_approved a caller passes in with wp_allow_comment()'s own
	 * decision, so the only way to force this is a pre_comment_approved
	 * filter around the call — removed again immediately after so it
	 * doesn't leak into some other plugin's unrelated wp_new_comment() call
	 * later in the same request.
	 */
	private static function force_pending( $approved ) {
		return 0;
	}

	/**
	 * Members comment as themselves (their real WP user), not anonymously —
	 * comment_author/email come from the account, not the request body, so
	 * there's no way to spoof another name. Goes through wp_new_comment()
	 * rather than wp_insert_comment() directly so normal WP moderation
	 * (blacklist, the comment_post hook that
	 * SC_Membership_Hooks::on_comment_approved() listens for) all still
	 * apply exactly as they would for a native comment-form submission —
	 * held for moderation is forced on top via force_pending() above,
	 * rather than left to site settings.
	 */
	public static function submit_comment( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'post_id' );
		$content = trim( (string) $request->get_param( 'content' ) );
		$parent  = (int) $request->get_param( 'parent' );
		$rating  = self::sanitize_rating( $request->get_param( 'rating' ) );

		if ( ! $post_id || ! get_post( $post_id ) ) {
			return new WP_Error( 'invalid_post', 'That post does not exist.', array( 'status' => 404 ) );
		}

		if ( '' === $content ) {
			return new WP_Error( 'empty_comment', 'Comment cannot be empty.', array( 'status' => 400 ) );
		}

		if ( $parent && ! get_comment( $parent ) ) {
			return new WP_Error( 'invalid_parent', 'That comment no longer exists.', array( 'status' => 400 ) );
		}

		$user = wp_get_current_user();

		/*
		 * WP Armour (Honeypot Anti Spam, active site-wide) hooks
		 * preprocess_comment and calls wp_die() directly whenever its
		 * dynamically-named hidden form field isn't present in $_POST —
		 * found by testing this route directly (it 500s with "Spamming or
		 * your Javascript is disabled"), not by reading WP Armour's source.
		 * A real browser's comment form gets that field injected and
		 * submitted empty; this REST route never renders that form at all,
		 * so every submission here — including the ones members already
		 * send from the live comment box — hits the same wp_die() before
		 * wp_new_comment() ever returns. Pre-setting the guessed field name
		 * in $_POST didn't satisfy it (its check may be more than
		 * presence/absence), so the only way to reach wp_new_comment() at
		 * all is removing preprocess_comment's filters for this one call.
		 * Safe here specifically because permission_callback already
		 * requires a real logged-in member — this route was never reachable
		 * by anonymous spam in the first place, unlike the honeypot's actual
		 * target (the public wp-comments-post.php form). No other plugin in
		 * the active list is a spam filter that would be lost by this (no
		 * Akismet et al. installed).
		 */
		remove_all_filters( 'preprocess_comment' );

		add_filter( 'pre_comment_approved', array( __CLASS__, 'force_pending' ) );
		$comment_id = wp_new_comment(
			wp_slash(
				array(
					'comment_post_ID'      => $post_id,
					'comment_content'      => $content,
					// clean_display_name(), not the raw (possibly
					// entity-encoded, see its docblock) value — this gets
					// stored verbatim in wp_comments.comment_author, so an
					// un-decoded "&amp;" would corrupt the DB row itself,
					// not just one page's rendering of it.
					'comment_author'       => self::clean_display_name( $user->data->display_name ),
					'comment_author_email' => $user->user_email,
					'user_id'              => $user->ID,
					'comment_parent'       => $parent,
					'comment_type'         => 'comment',
					'comment_author_url'   => '',
				)
			),
			true
		);
		remove_filter( 'pre_comment_approved', array( __CLASS__, 'force_pending' ) );

		if ( is_wp_error( $comment_id ) ) {
			return new WP_Error( 'comment_failed', $comment_id->get_error_message(), array( 'status' => 400 ) );
		}

		if ( null !== $rating ) {
			update_comment_meta( $comment_id, 'sc_rating', $rating );
		}

		$comment = get_comment( $comment_id );

		return array(
			'id'          => (int) $comment_id,
			'status'      => wp_get_comment_status( $comment_id ),
			'author_name' => $comment->comment_author,
			'date'        => $comment->comment_date,
			'content'     => array( 'rendered' => apply_filters( 'comment_text', $comment->comment_content, $comment ) ),
			'rating'      => $rating,
		);
	}

	/**
	 * Lets a member edit their own comment/review within a week of posting
	 * — after that the edit window's closed and this just 403s. Editing
	 * puts it back into the moderation queue (same as a brand new comment:
	 * force_pending applies here too) since the content someone's about to
	 * see has changed, and re-notifies the moderator the same way a fresh
	 * comment would (wp_new_comment() does that automatically; a plain
	 * wp_update_comment() does not, so it's called explicitly below).
	 */
	public static function update_comment( WP_REST_Request $request ) {
		$comment_id = (int) $request->get_param( 'id' );
		$content    = trim( (string) $request->get_param( 'content' ) );
		$rating     = self::sanitize_rating( $request->get_param( 'rating' ) );

		$comment = get_comment( $comment_id );
		if ( ! $comment ) {
			return new WP_Error( 'not_found', 'That comment no longer exists.', array( 'status' => 404 ) );
		}

		if ( (int) $comment->user_id !== get_current_user_id() ) {
			return new WP_Error( 'not_owner', 'You can only edit your own comments.', array( 'status' => 403 ) );
		}

		$posted_at = strtotime( $comment->comment_date_gmt . ' UTC' );
		if ( ! $posted_at || ( time() - $posted_at ) > self::COMMENT_EDIT_WINDOW ) {
			return new WP_Error( 'edit_window_closed', 'Comments can only be edited within a week of posting.', array( 'status' => 403 ) );
		}

		if ( '' === $content ) {
			return new WP_Error( 'empty_comment', 'Comment cannot be empty.', array( 'status' => 400 ) );
		}

		wp_update_comment(
			array(
				'comment_ID'       => $comment_id,
				'comment_content'  => wp_slash( $content ),
				'comment_approved' => 0,
			)
		);

		if ( null !== $rating ) {
			update_comment_meta( $comment_id, 'sc_rating', $rating );
		} else {
			delete_comment_meta( $comment_id, 'sc_rating' );
		}

		wp_notify_moderator( $comment_id );

		$comment = get_comment( $comment_id );

		return array(
			'id'      => (int) $comment_id,
			'status'  => wp_get_comment_status( $comment_id ),
			'date'    => $comment->comment_date,
			'content' => array( 'rendered' => apply_filters( 'comment_text', $comment->comment_content, $comment ) ),
			'rating'  => $rating,
		);
	}

	/** post/listing only — the two content types cards render bookmark buttons on. */
	const BOOKMARKABLE_TYPES = array( 'post', 'listing' );

	private static function sanitize_bookmark_params( WP_REST_Request $request ) {
		$content_type = sanitize_key( (string) $request->get_param( 'content_type' ) );
		$content_id   = (int) $request->get_param( 'content_id' );

		if ( ! in_array( $content_type, self::BOOKMARKABLE_TYPES, true ) || $content_id <= 0 ) {
			return null;
		}

		return array( $content_type, $content_id );
	}

	public static function get_bookmark_state( WP_REST_Request $request ) {
		$params = self::sanitize_bookmark_params( $request );
		if ( ! $params ) {
			return new WP_Error( 'invalid_bookmark_target', 'A valid content_type and content_id are required.', array( 'status' => 400 ) );
		}
		list( $content_type, $content_id ) = $params;

		$user_id = get_current_user_id();

		return array(
			'count'      => SC_Membership_DB::bookmark_count( $content_type, $content_id ),
			'bookmarked' => $user_id ? SC_Membership_DB::is_bookmarked( $user_id, $content_type, $content_id ) : false,
			'logged_in'  => (bool) $user_id,
		);
	}

	public static function toggle_bookmark( WP_REST_Request $request ) {
		$params = self::sanitize_bookmark_params( $request );
		if ( ! $params ) {
			return new WP_Error( 'invalid_bookmark_target', 'A valid content_type and content_id are required.', array( 'status' => 400 ) );
		}
		list( $content_type, $content_id ) = $params;

		$bookmarked = SC_Membership_DB::toggle_bookmark( get_current_user_id(), $content_type, $content_id );

		return array(
			'bookmarked' => $bookmarked,
			'count'      => SC_Membership_DB::bookmark_count( $content_type, $content_id ),
		);
	}

	public static function get_leaderboard( WP_REST_Request $request ) {
		global $wpdb;
		$table = SC_Membership_DB::members_table();

		$rows = $wpdb->get_results(
			"SELECT user_id, points, tier FROM {$table} ORDER BY points DESC LIMIT 10" // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		);

		return array_map(
			function ( $row ) {
				$user = get_userdata( $row->user_id );
				$tier = SC_Membership_Tiers::get( $row->tier );
				return array(
					'display_name' => $user ? self::clean_display_name( $user->data->display_name ) : 'Member',
					'points'       => (int) $row->points,
					'tier'         => $tier ? $tier['label'] : $row->tier,
				);
			},
			$rows
		);
	}
}
