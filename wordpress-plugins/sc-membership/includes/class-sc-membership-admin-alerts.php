<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The admin side of the notification bell (Rob, 2026-10): new members,
 * comments, events, groups, jobs, ads and anything waiting for approval
 * show up in the bell of every administrator/editor, so there's one place
 * to keep an eye on the site instead of checking each wp-admin screen.
 *
 * Two parts:
 *  - alerts, written at the moment something happens, as ordinary rows
 *    in the activity table (SC_Membership_Activity) for each staff
 *    account — they get the same seen/unseen and 90-day clean-up;
 *  - a "To approve" summary (pending_summary), counted fresh each time a
 *    staff member's bell loads, so it always matches what's actually
 *    still waiting rather than what arrived.
 *
 * Staff never get alerts about their own actions. Links go to the page on
 * the site where there is one, otherwise to the right wp-admin screen.
 */
class SC_Membership_Admin_Alerts {

	public static function init() {
		add_action( 'user_register', array( __CLASS__, 'on_user_register' ), 30 );
		add_action( 'comment_post', array( __CLASS__, 'on_comment_posted' ), 30, 2 );
		add_action( 'sc_events_event_submitted', array( __CLASS__, 'on_event_submitted' ), 30, 2 );
		add_action( 'sc_directory_listing_submitted', array( __CLASS__, 'on_listing_submitted' ), 30, 2 );
		add_action( 'sc_jobs_job_submitted', array( __CLASS__, 'on_job_submitted' ), 30, 1 );
		add_action( 'transition_post_status', array( __CLASS__, 'on_post_transition' ), 30, 3 );
		add_action( 'sc_directory_listing_claim_requested', array( __CLASS__, 'on_listing_claim_requested' ), 30, 2 );
		add_action( 'sc_events_event_claim_requested', array( __CLASS__, 'on_event_claim_requested' ), 30, 2 );
		add_action( 'sc_events_organizer_claim_requested', array( __CLASS__, 'on_organizer_claim_requested' ), 30, 2 );
		add_action( 'sc_directory_upgrade_requested', array( __CLASS__, 'on_upgrade_requested' ), 30, 3 );
		add_action( 'sc_events_event_featured', array( __CLASS__, 'on_event_featured' ), 30, 1 );
	}

	/* ------------------------------------------------------------------
	 * Helpers
	 * ---------------------------------------------------------------- */

	/** Administrators and editors — the accounts that approve things. */
	public static function staff_ids() {
		static $ids = null;
		if ( null === $ids ) {
			$ids = array_map(
				'intval',
				get_users(
					array(
						'role__in' => array( 'administrator', 'editor' ),
						'fields'   => 'ID',
						'number'   => 20,
					)
				)
			);
		}
		return $ids;
	}

	public static function is_staff( $user_id ) {
		return $user_id > 0 && user_can( (int) $user_id, 'edit_others_posts' );
	}

	/** One alert to every staff account except whoever did it. */
	private static function alert( $type, $text, $link, $actor_id = 0 ) {
		if ( self::is_staff( (int) $actor_id ) ) {
			return;
		}
		foreach ( self::staff_ids() as $staff_id ) {
			if ( $staff_id !== (int) $actor_id ) {
				SC_Membership_Activity::add( $staff_id, $type, $text, $link );
			}
		}
	}

	private static function title( $post ) {
		return wp_specialchars_decode( get_the_title( $post ), ENT_QUOTES );
	}

	private static function name( $user_id ) {
		$user = get_userdata( (int) $user_id );
		return $user ? $user->display_name : 'Someone';
	}

	private static function edit_link( $post_id ) {
		return admin_url( 'post.php?post=' . (int) $post_id . '&action=edit' );
	}

	/* ------------------------------------------------------------------
	 * Alerts
	 * ---------------------------------------------------------------- */

	public static function on_user_register( $user_id ) {
		self::alert( 'signup', sprintf( 'New member: %s', self::name( $user_id ) ), admin_url( 'user-edit.php?user_id=' . (int) $user_id ) );
	}

	public static function on_comment_posted( $comment_id, $approved ) {
		if ( 'spam' === $approved || 'trash' === $approved ) {
			return;
		}
		$comment = get_comment( $comment_id );
		$post    = $comment ? get_post( $comment->comment_post_ID ) : null;
		if ( ! $comment || ! $post ) {
			return;
		}
		$who  = $comment->comment_author ? $comment->comment_author : 'Someone';
		$path = SC_Membership_Activity::path_for( $post );
		if ( 1 === (int) $approved ) {
			$link = $path ? $path . '#comments' : admin_url( 'comment.php?action=editcomment&c=' . (int) $comment_id );
			self::alert( 'comment', sprintf( '%s commented on “%s”', $who, self::title( $post ) ), $link, (int) $comment->user_id );
		} else {
			self::alert( 'todo', sprintf( 'Comment to approve from %s on “%s”', $who, self::title( $post ) ), admin_url( 'edit-comments.php?comment_status=moderated' ), (int) $comment->user_id );
		}
	}

	public static function on_event_submitted( $user_id, $event_id ) {
		$post = get_post( $event_id );
		if ( ! $post ) {
			return;
		}
		if ( 'publish' === $post->post_status ) {
			self::alert( 'new', sprintf( 'New event from %s: “%s”', self::name( $user_id ), self::title( $post ) ), '/events/' . $post->post_name, $user_id );
		} else {
			self::alert( 'todo', sprintf( 'Event to approve from %s: “%s”', self::name( $user_id ), self::title( $post ) ), self::edit_link( $event_id ), $user_id );
		}
	}

	public static function on_listing_submitted( $user_id, $listing_id ) {
		$post = get_post( $listing_id );
		if ( ! $post ) {
			return;
		}
		if ( class_exists( 'SC_Directory_Payments' ) && SC_Directory_Payments::is_group( $listing_id ) ) {
			self::alert( 'new', sprintf( 'New community group from %s: “%s”', self::name( $user_id ), self::title( $post ) ), '/community/groups/' . $post->post_name, $user_id );
			return;
		}
		self::alert( 'todo', sprintf( 'New directory listing from %s: “%s”', self::name( $user_id ), self::title( $post ) ), self::edit_link( $listing_id ), $user_id );
	}

	public static function on_job_submitted( $job_id ) {
		$post = get_post( $job_id );
		if ( ! $post ) {
			return;
		}
		$author = (int) $post->post_author;
		self::alert( 'new', sprintf( 'New job from %s: “%s” (shows once paid)', self::name( $author ), self::title( $post ) ), self::edit_link( $job_id ), $author );
	}

	/** Text ads (live straight away, pay to run) and community stories (wait for approval). */
	public static function on_post_transition( $new_status, $old_status, $post ) {
		if ( ! in_array( $old_status, array( 'new', 'auto-draft' ), true ) ) {
			return;
		}
		$author = (int) $post->post_author;
		if ( 'sc_ad' === $post->post_type && 'publish' === $new_status ) {
			$headline = get_post_meta( $post->ID, 'sc_ad_headline', true );
			self::alert( 'new', sprintf( 'New text ad from %s: “%s”', self::name( $author ), $headline ? $headline : self::title( $post ) ), self::edit_link( $post->ID ), $author );
		} elseif ( 'post' === $post->post_type && 'pending' === $new_status ) {
			self::alert( 'todo', sprintf( 'Community story to approve from %s: “%s”', self::name( $author ), self::title( $post ) ), self::edit_link( $post->ID ), $author );
		}
	}

	public static function on_listing_claim_requested( $user_id, $listing_id ) {
		$post = get_post( $listing_id );
		if ( $post ) {
			self::alert( 'todo', sprintf( '%s wants to claim %s', self::name( $user_id ), self::title( $post ) ), admin_url( 'edit.php?post_type=sc_listing&page=sc-directory-claims' ), $user_id );
		}
	}

	public static function on_event_claim_requested( $user_id, $event_id ) {
		$post = get_post( $event_id );
		if ( $post ) {
			self::alert( 'todo', sprintf( '%s wants to claim the event “%s”', self::name( $user_id ), self::title( $post ) ), admin_url( 'edit.php?post_type=sc_event&page=sc-events-claims' ), $user_id );
		}
	}

	public static function on_organizer_claim_requested( $user_id, $term_id ) {
		$term = get_term( $term_id );
		if ( $term && ! is_wp_error( $term ) ) {
			self::alert( 'todo', sprintf( '%s wants to claim the organiser %s', self::name( $user_id ), $term->name ), admin_url( 'edit.php?post_type=sc_event&page=sc-events-claims' ), $user_id );
		}
	}

	public static function on_upgrade_requested( $user_id, $listing_id = null, $tier = '' ) {
		$what = $listing_id ? get_the_title( $listing_id ) : 'their listing';
		self::alert( 'todo', sprintf( '%s asked to upgrade %s', self::name( $user_id ), wp_specialchars_decode( $what, ENT_QUOTES ) ), admin_url( 'admin.php?page=sc-membership' ), $user_id );
	}

	public static function on_event_featured( $event_id ) {
		$post = get_post( $event_id );
		if ( $post ) {
			self::alert( 'featured', sprintf( 'Paid: “%s” is now a featured event', self::title( $post ) ), '/events/' . $post->post_name, (int) $post->post_author );
		}
	}

	/* ------------------------------------------------------------------
	 * "To approve" summary
	 * ---------------------------------------------------------------- */

	private static function count_meta_posts( $post_type, $key ) {
		$query = new WP_Query(
			array(
				'post_type'      => $post_type,
				'post_status'    => 'any',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery
					array(
						'key'     => $key,
						'compare' => 'EXISTS',
					),
				),
			)
		);
		return (int) $query->found_posts;
	}

	/**
	 * What's waiting on staff right now, as [{label, count, link}], only
	 * the non-zero ones. Counted on each bell load for staff only.
	 */
	public static function pending_summary() {
		$items = array();
		$add   = function ( $count, $one, $many, $link ) use ( &$items ) {
			if ( $count > 0 ) {
				$items[] = array(
					'label' => sprintf( 1 === $count ? $one : $many, $count ),
					'count' => $count,
					'link'  => $link,
				);
			}
		};

		$comments = wp_count_comments();
		$add( (int) $comments->moderated, '%d comment', '%d comments', admin_url( 'edit-comments.php?comment_status=moderated' ) );

		if ( post_type_exists( 'sc_listing' ) ) {
			$add( (int) wp_count_posts( 'sc_listing' )->pending, '%d directory listing', '%d directory listings', admin_url( 'edit.php?post_type=sc_listing&post_status=pending' ) );
			$claims = new WP_Query(
				array(
					'post_type'      => 'sc_listing',
					'post_status'    => 'any',
					'posts_per_page' => 1,
					'fields'         => 'ids',
					'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery
						'relation' => 'AND',
						array(
							'key'     => 'sc_claim_requested_by',
							'compare' => 'EXISTS',
						),
						array(
							'key'     => 'sc_claimed',
							'value'   => '1',
							'compare' => '!=',
						),
					),
				)
			);
			$add( (int) $claims->found_posts, '%d listing claim', '%d listing claims', admin_url( 'edit.php?post_type=sc_listing&page=sc-directory-claims' ) );
			$add( self::count_meta_posts( 'sc_listing', 'sc_group_promo_requested_by' ), '%d group promotion', '%d group promotions', admin_url( 'edit.php?post_type=sc_listing&page=sc-directory-promotions' ) );
		}

		if ( post_type_exists( 'sc_event' ) ) {
			$add( (int) wp_count_posts( 'sc_event' )->pending, '%d event', '%d events', admin_url( 'edit.php?post_type=sc_event&post_status=pending' ) );
			$event_claims = self::count_meta_posts( 'sc_event', 'sc_event_claim_requested_by' );
			$org_claims   = get_terms(
				array(
					'taxonomy'     => 'sc_event_organizer',
					'hide_empty'   => false,
					'fields'       => 'count',
					'meta_key'     => 'sc_organizer_claim_requested_by', // phpcs:ignore WordPress.DB.SlowDBQuery
					'meta_compare' => 'EXISTS',
				)
			);
			$add( $event_claims + ( is_wp_error( $org_claims ) ? 0 : (int) $org_claims ), '%d event/organiser claim', '%d event/organiser claims', admin_url( 'edit.php?post_type=sc_event&page=sc-events-claims' ) );
		}

		$add( (int) wp_count_posts( 'post' )->pending, '%d community story', '%d community stories', admin_url( 'edit.php?post_status=pending' ) );

		$upgrades = count(
			get_users(
				array(
					'meta_key'   => 'directory_upgrade_status', // phpcs:ignore WordPress.DB.SlowDBQuery
					'meta_value' => 'pending', // phpcs:ignore WordPress.DB.SlowDBQuery
					'fields'     => 'ID',
					'number'     => 100,
				)
			)
		);
		$add( $upgrades, '%d upgrade request', '%d upgrade requests', admin_url( 'admin.php?page=sc-membership' ) );

		$flagged = count(
			get_users(
				array(
					'meta_key'   => 'sc_member_pending_review', // phpcs:ignore WordPress.DB.SlowDBQuery
					'meta_value' => '1', // phpcs:ignore WordPress.DB.SlowDBQuery
					'fields'     => 'ID',
					'number'     => 200,
				)
			)
		);
		$add( $flagged, '%d member to review', '%d members to review', admin_url( 'admin.php?page=sc-membership' ) );

		return $items;
	}
}
