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
