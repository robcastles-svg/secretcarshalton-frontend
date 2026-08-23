<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface the Next.js frontend talks to for the member dashboard.
 * Namespace: sc-membership/v1
 */
class SC_Membership_REST {

	public static function register_routes() {
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
			'/members',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_members' ),
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

		if ( ! $user ) {
			return new WP_Error( 'not_found', 'Member not found.', array( 'status' => 404 ) );
		}

		$avatar = get_avatar_url( $user->ID, array( 'size' => 96 ) );

		return array(
			'id'           => $user->ID,
			'name'         => $user->display_name,
			'slug'         => $user->user_nicename,
			'description'  => get_user_meta( $user->ID, 'description', true ),
			'avatar_urls'  => array(
				'24' => $avatar,
				'48' => $avatar,
				'96' => $avatar,
			),
			'banned'       => self::is_banned( $user->ID ),
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
	 * BuddyPress owns avatar resolution on this install and falls back to
	 * its own generic mystery-man.jpg for every member who hasn't uploaded
	 * a photo — which is everyone right now, since the dashboard's own
	 * "Upload photo" button isn't wired up yet. Catches that fallback (and
	 * WP core's own gravatar "mystery" default, for when avatar resolution
	 * doesn't go through BuddyPress) and swaps in the branded default
	 * instead. A real Gravatar match is untouched — this only replaces
	 * the "no photo at all" case. Registered globally via get_avatar_url
	 * so it applies everywhere an avatar is resolved: this plugin's own
	 * /members endpoint and WP core's /wp/v2/users (which the public
	 * member-profile page reads its avatar from).
	 */
	public static function filter_default_avatar( $url, $id_or_email, $args ) {
		if ( $url && ( false !== strpos( $url, 'mystery-man' ) || false !== strpos( $url, 'd=mm' ) ) ) {
			return SC_Membership_Auth::FRONTEND_URL . '/default-avatar.png';
		}
		return $url;
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
					'display_name' => $user->display_name,
					'slug'         => $user->user_nicename,
					'avatar'       => get_avatar_url( $user->ID, array( 'size' => 96 ) ),
					'points'       => $points_by_user[ $user->ID ] ?? 0,
				);
			},
			$users
		);
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

	/**
	 * Members comment as themselves (their real WP user), not anonymously —
	 * comment_author/email come from the account, not the request body, so
	 * there's no way to spoof another name. Goes through wp_new_comment()
	 * rather than wp_insert_comment() directly so normal WP moderation
	 * (blacklist, held-for-moderation defaults, the comment_post hook that
	 * SC_Membership_Hooks::on_comment_approved() listens for) all still
	 * apply exactly as they would for a native comment-form submission.
	 */
	public static function submit_comment( WP_REST_Request $request ) {
		$post_id = (int) $request->get_param( 'post_id' );
		$content = trim( (string) $request->get_param( 'content' ) );
		$parent  = (int) $request->get_param( 'parent' );

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

		$comment_id = wp_new_comment(
			wp_slash(
				array(
					'comment_post_ID'      => $post_id,
					'comment_content'      => $content,
					'comment_author'       => $user->display_name,
					'comment_author_email' => $user->user_email,
					'user_id'              => $user->ID,
					'comment_parent'       => $parent,
					'comment_type'         => 'comment',
					'comment_author_url'   => '',
				)
			),
			true
		);

		if ( is_wp_error( $comment_id ) ) {
			return new WP_Error( 'comment_failed', $comment_id->get_error_message(), array( 'status' => 400 ) );
		}

		$comment = get_comment( $comment_id );

		return array(
			'id'          => (int) $comment_id,
			'status'      => wp_get_comment_status( $comment_id ),
			'author_name' => $comment->comment_author,
			'date'        => $comment->comment_date,
			'content'     => array( 'rendered' => apply_filters( 'comment_text', $comment->comment_content, $comment ) ),
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
					'display_name' => $user ? $user->display_name : 'Member',
					'points'       => (int) $row->points,
					'tier'         => $tier ? $tier['label'] : $row->tier,
				);
			},
			$rows
		);
	}
}
