<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The member's own activity in the notification bell (stage 2): "Carole
 * replied to your comment", "Your event is now live", "Your text ad ends
 * in 7 days", "You've reached Regular" and so on.
 *
 * Each one is a row in sc_member_activity, written at the moment it
 * happens by the hooks below — the same moments the plugins already send
 * emails or award points at, so nothing is worked out on every page view.
 * The bell reads the latest 20 (SC_Membership_Messages::rest_notifications)
 * and opening it marks them seen. Rows older than 90 days are cleared out
 * daily. Not emailed: the moments that warrant an email already send one.
 */
class SC_Membership_Activity {

	const CRON_HOOK = 'sc_membership_activity_daily';
	const KEEP_DAYS = 90;

	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'sc_member_activity';
	}

	/** Called from SC_Membership_DB::install(). */
	public static function install_sql( $charset_collate ) {
		$table = self::table();
		return "CREATE TABLE {$table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id BIGINT UNSIGNED NOT NULL,
			type VARCHAR(30) NOT NULL,
			text VARCHAR(255) NOT NULL,
			link VARCHAR(255) NOT NULL DEFAULT '',
			created_at DATETIME NOT NULL,
			seen_at DATETIME DEFAULT NULL,
			PRIMARY KEY  (id),
			KEY user_created (user_id, created_at)
		) {$charset_collate};";
	}

	public static function init() {
		// Comments: a reply to yours (SC_Membership_Hooks::maybe_notify_reply
		// adds that one), and a comment or review on something you posted.
		add_action( 'transition_comment_status', array( __CLASS__, 'on_comment_transition' ), 20, 3 );
		add_action( 'comment_post', array( __CLASS__, 'on_comment_posted' ), 20, 2 );

		// Something you sent in goes live.
		add_action( 'transition_post_status', array( __CLASS__, 'on_post_transition' ), 20, 3 );

		add_action( 'sc_directory_listing_claimed', array( __CLASS__, 'on_listing_claimed' ), 20, 2 );
		add_action( 'sc_events_event_claimed', array( __CLASS__, 'on_event_claimed' ), 20, 2 );
		add_action( 'sc_events_organizer_claimed', array( __CLASS__, 'on_organizer_claimed' ), 20, 2 );
		add_action( 'sc_membership_upgrade_reviewed', array( __CLASS__, 'on_upgrade_reviewed' ), 20, 4 );
		add_action( 'sc_events_event_featured', array( __CLASS__, 'on_event_featured' ), 20, 1 );
		add_action( 'sc_membership_tier_changed', array( __CLASS__, 'on_tier_changed' ), 20, 3 );

		add_action( self::CRON_HOOK, array( __CLASS__, 'daily' ) );
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::CRON_HOOK );
		}
	}

	/* ------------------------------------------------------------------
	 * Store
	 * ---------------------------------------------------------------- */

	/**
	 * Records one item for a member. $link is a path on the site
	 * ("/events/autumn-fair") the bell links the item to.
	 */
	public static function add( $user_id, $type, $text, $link = '' ) {
		$user_id = (int) $user_id;
		if ( $user_id <= 0 || SC_Membership_REST::is_banned( $user_id ) ) {
			return;
		}
		global $wpdb;
		$wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			self::table(),
			array(
				'user_id'    => $user_id,
				'type'       => sanitize_key( $type ),
				'text'       => mb_substr( wp_strip_all_tags( $text ), 0, 255 ),
				'link'       => mb_substr( (string) $link, 0, 255 ),
				'created_at' => current_time( 'mysql', true ),
			),
			array( '%d', '%s', '%s', '%s', '%s' )
		);
	}

	public static function for_user( $user_id, $limit = 20 ) {
		global $wpdb;
		$table = self::table();
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT id, type, text, link, created_at, seen_at FROM {$table} WHERE user_id = %d ORDER BY created_at DESC, id DESC LIMIT %d", $user_id, $limit ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return array_map(
			function ( $row ) {
				return array(
					'id'   => (int) $row->id,
					'type' => $row->type,
					'text' => $row->text,
					'link' => $row->link,
					'date' => gmdate( 'c', strtotime( $row->created_at . ' UTC' ) ),
					'seen' => null !== $row->seen_at,
				);
			},
			(array) $rows
		);
	}

	public static function unread_count( $user_id ) {
		global $wpdb;
		$table = self::table();
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE user_id = %d AND seen_at IS NULL", $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	public static function mark_all_seen( $user_id ) {
		global $wpdb;
		$table = self::table();
		$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET seen_at = %s WHERE user_id = %d AND seen_at IS NULL", current_time( 'mysql', true ), $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/* ------------------------------------------------------------------
	 * Helpers
	 * ---------------------------------------------------------------- */

	private static function title( $post ) {
		return wp_specialchars_decode( get_the_title( $post ), ENT_QUOTES );
	}

	/** The page a post lives at on the site, or '' for kinds that don't have one. */
	public static function path_for( $post ) {
		$paths = array(
			'sc_event'    => '/events/',
			'sc_listing'  => '/directory/',
			'job_listing' => '/jobs/',
			'post'        => '/',
		);
		return isset( $paths[ $post->post_type ] ) ? $paths[ $post->post_type ] . $post->post_name : '';
	}

	/** Rob's own posts (and the admin-owned imports) don't notify anyone. */
	private static function is_staff( $user_id ) {
		return user_can( (int) $user_id, 'edit_others_posts' );
	}

	/* ------------------------------------------------------------------
	 * Hooks
	 * ---------------------------------------------------------------- */

	/** Called by SC_Membership_Hooks::maybe_notify_reply alongside its email. */
	public static function on_reply( $recipient_id, $who, $post ) {
		self::add( $recipient_id, 'reply', sprintf( '%s replied to your comment on “%s”', $who, self::title( $post ) ), self::path_for( $post ) . '#comments' );
	}

	public static function on_comment_transition( $new_status, $old_status, $comment ) {
		if ( 'approved' === $new_status && 'approved' !== $old_status ) {
			self::maybe_notify_owner( $comment );
		}
	}

	public static function on_comment_posted( $comment_id, $approved ) {
		if ( 1 === (int) $approved ) {
			self::maybe_notify_owner( get_comment( $comment_id ) );
		}
	}

	/**
	 * A new top-level comment on a member's event, or a review on their
	 * listing. Replies are covered by on_reply; once per comment.
	 */
	private static function maybe_notify_owner( $comment ) {
		if ( ! $comment || (int) $comment->comment_parent || get_comment_meta( $comment->comment_ID, 'sc_owner_notified', true ) ) {
			return;
		}
		$post = get_post( $comment->comment_post_ID );
		if ( ! $post || ! in_array( $post->post_type, array( 'sc_event', 'sc_listing' ), true ) ) {
			return;
		}
		$owner = (int) $post->post_author;
		if ( ! $owner || $owner === (int) $comment->user_id || self::is_staff( $owner ) ) {
			return;
		}
		update_comment_meta( $comment->comment_ID, 'sc_owner_notified', 1 );

		$who = $comment->comment_author ? $comment->comment_author : 'Someone';
		if ( 'sc_listing' === $post->post_type ) {
			$rating = (int) get_comment_meta( $comment->comment_ID, 'sc_rating', true );
			$text   = $rating
				? sprintf( '%s left a %d★ review on %s', $who, $rating, self::title( $post ) )
				: sprintf( '%s left a review on %s', $who, self::title( $post ) );
			self::add( $owner, 'review', $text, self::path_for( $post ) . '#comments' );
		} else {
			self::add( $owner, 'comment', sprintf( '%s commented on your event “%s”', $who, self::title( $post ) ), self::path_for( $post ) . '#comments' );
		}
	}

	public static function on_post_transition( $new_status, $old_status, $post ) {
		if ( 'publish' !== $new_status || in_array( $old_status, array( 'publish', 'future' ), true ) ) {
			return;
		}
		$labels = array(
			'sc_event'    => 'Your event “%s” is now live',
			'sc_listing'  => 'Your listing “%s” is now live in the directory',
			'job_listing' => 'Your job “%s” is now live',
			'sc_ad'       => 'Your ad “%s” is now live',
			'post'        => 'Your community story “%s” has been published',
		);
		if ( ! isset( $labels[ $post->post_type ] ) ) {
			return;
		}
		$author = (int) $post->post_author;
		if ( ! $author || self::is_staff( $author ) ) {
			return;
		}
		// Reed's jobs belong to the admin account, so the staff check above skips them.
		$title = 'sc_ad' === $post->post_type ? ( get_post_meta( $post->ID, 'sc_ad_headline', true ) ?: self::title( $post ) ) : self::title( $post );
		$link  = 'sc_ad' === $post->post_type ? '/dashboard#advertising' : self::path_for( $post );
		$label = $labels[ $post->post_type ];
		if ( 'sc_listing' === $post->post_type && class_exists( 'SC_Directory_Payments' ) && SC_Directory_Payments::is_group( $post->ID ) ) {
			$label = 'Your group “%s” is now live';
			$link  = '/community/groups/' . $post->post_name;
		}
		self::add( $author, 'live', sprintf( $label, $title ), $link );
	}

	public static function on_listing_claimed( $user_id, $listing_id ) {
		$post = get_post( $listing_id );
		if ( $post ) {
			self::add( $user_id, 'approved', sprintf( 'Your claim for %s was approved — you can now manage it from your dashboard', self::title( $post ) ), '/dashboard#business' );
		}
	}

	public static function on_event_claimed( $user_id, $event_id ) {
		$post = get_post( $event_id );
		if ( $post ) {
			self::add( $user_id, 'approved', sprintf( 'Your claim for the event “%s” was approved', self::title( $post ) ), self::path_for( $post ) );
		}
	}

	public static function on_organizer_claimed( $user_id, $term_id ) {
		$term = get_term( $term_id );
		if ( $term && ! is_wp_error( $term ) ) {
			self::add( $user_id, 'approved', sprintf( 'You now manage the organiser %s', wp_specialchars_decode( $term->name, ENT_QUOTES ) ), '/events/submit' );
		}
	}

	public static function on_upgrade_reviewed( $user_id, $decision, $listing_id, $tier ) {
		$name = $listing_id ? self::title( get_post( $listing_id ) ) : 'your listing';
		if ( 'approved' === $decision ) {
			self::add( $user_id, 'approved', sprintf( 'Your upgrade for %s was approved', $name ), '/dashboard#business' );
		} elseif ( 'rejected' === $decision ) {
			self::add( $user_id, 'info', sprintf( 'Your upgrade request for %s wasn\'t approved — get in touch if you have questions', $name ), '/contact' );
		}
	}

	public static function on_event_featured( $event_id ) {
		$post = get_post( $event_id );
		if ( $post && ! self::is_staff( $post->post_author ) ) {
			self::add( (int) $post->post_author, 'featured', sprintf( 'Your event “%s” is now featured', self::title( $post ) ), self::path_for( $post ) );
		}
	}

	public static function on_tier_changed( $user_id, $old_tier, $new_tier ) {
		$old = SC_Membership_Tiers::get( $old_tier );
		$new = SC_Membership_Tiers::get( $new_tier );
		if ( $new && ( ! $old || $new['threshold'] > $old['threshold'] ) ) {
			self::add( $user_id, 'tier', sprintf( 'You\'ve reached %s — thanks for being part of Secret Carshalton', $new['label'] ), '/dashboard' );
		}
	}

	/* ------------------------------------------------------------------
	 * Daily: "ends soon" reminders and clearing out old rows
	 * ---------------------------------------------------------------- */

	public static function daily() {
		self::remind_ending();
		global $wpdb;
		$table = self::table();
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE created_at < %s", gmdate( 'Y-m-d H:i:s', time() - self::KEEP_DAYS * DAY_IN_SECONDS ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/**
	 * A week's notice before a member's text ad or featured listing ends,
	 * and three days before a job they posted closes. Each reminder is
	 * remembered against the end date it was for, so extending something
	 * gets a fresh reminder before the new date, never a duplicate.
	 */
	public static function remind_ending() {
		$today = wp_date( 'Y-m-d' );
		$soon  = wp_date( 'Y-m-d', time() + 7 * DAY_IN_SECONDS );

		// Text ads: sc_ad_end is a Y-m-d date.
		foreach ( self::posts_with_meta( 'sc_ad', 'sc_ad_end' ) as $post ) {
			$end = (string) get_post_meta( $post->ID, 'sc_ad_end', true );
			if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $end ) && $end >= $today && $end <= $soon ) {
				$headline = get_post_meta( $post->ID, 'sc_ad_headline', true ) ?: self::title( $post );
				self::remind_once( $post, $end, sprintf( 'Your ad “%s” ends on %s — extend it to keep it running', $headline, self::day( $end ) ), '/dashboard#advertising' );
			}
		}

		// Featured listings: sc_featured_until is a timestamp.
		foreach ( self::posts_with_meta( 'sc_listing', 'sc_featured_until' ) as $post ) {
			$until = (int) get_post_meta( $post->ID, 'sc_featured_until', true );
			$end   = $until ? wp_date( 'Y-m-d', $until ) : '';
			if ( $end && $end >= $today && $end <= $soon ) {
				self::remind_once( $post, $end, sprintf( 'The featured spot for %s ends on %s — renew it to stay featured', self::title( $post ), self::day( $end ) ), '/dashboard#business' );
			}
		}

		// Member-posted jobs: expiry_date is a Y-m-d date.
		$job_soon = wp_date( 'Y-m-d', time() + 3 * DAY_IN_SECONDS );
		foreach ( self::posts_with_meta( 'job_listing', 'expiry_date' ) as $post ) {
			if ( 'member' !== get_post_meta( $post->ID, 'source', true ) ) {
				continue;
			}
			$end = (string) get_post_meta( $post->ID, 'expiry_date', true );
			if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $end ) && $end >= $today && $end <= $job_soon ) {
				self::remind_once( $post, $end, sprintf( 'Your job “%s” closes on %s', self::title( $post ), self::day( $end ) ), '/jobs/manager' );
			}
		}
	}

	private static function posts_with_meta( $post_type, $meta_key ) {
		return get_posts(
			array(
				'post_type'      => $post_type,
				'post_status'    => 'publish',
				'posts_per_page' => 500,
				'meta_key'       => $meta_key, // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_compare'   => 'EXISTS',
			)
		);
	}

	private static function remind_once( $post, $end, $text, $link ) {
		$author = (int) $post->post_author;
		if ( ! $author || self::is_staff( $author ) || get_post_meta( $post->ID, 'sc_activity_reminded_for', true ) === $end ) {
			return;
		}
		update_post_meta( $post->ID, 'sc_activity_reminded_for', $end );
		self::add( $author, 'ending', $text, $link );
	}

	private static function day( $ymd ) {
		return wp_date( 'j F', strtotime( $ymd . ' 12:00:00' ) );
	}
}
