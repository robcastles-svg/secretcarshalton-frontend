<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The approval queue for directory upgrades — this is the "I would have
 * to approve directory upgrades once they've paid" screen Rob described.
 * Deliberately plain (a table + Approve/Reject buttons), no JS framework,
 * so it stays simple to extend once sc-directory exists and needs its own
 * review step alongside this one. Also now the pending-members queue —
 * accounts flagged as looking like spam (a URL for a username), which
 * stay hidden from the public /members list until reviewed here.
 */
class SC_Membership_Admin {

	public static function register_menu() {
		add_menu_page(
			'Membership',
			'Membership',
			'manage_options',
			'sc-membership',
			array( __CLASS__, 'render_queues' ),
			'dashicons-groups',
			30
		);
	}

	public static function render_queues() {
		echo '<div class="wrap"><h1>Membership</h1>';
		self::render_backfill_notice();
		self::render_points_backfill();
		self::render_pending_members_queue();
		self::render_upgrade_queue();
		echo '</div>';
	}

	/**
	 * A dynamic hook-name bug (comment_approved_ never matched the
	 * comment_type WordPress core actually inserts, see the docblock in
	 * class-sc-membership-hooks.php) meant comments never awarded points,
	 * and submitting an event/listing never awarded points at all (only
	 * claiming and RSVPing did) until sc_events_event_submitted /
	 * sc_directory_listing_submitted were added. Both are fixed for
	 * anything that happens from now on; this button is the one-off catch-up
	 * for members who already commented/submitted before the fix — same
	 * shape as handle_scan_pending_members's backfill for spam detection.
	 * Idempotent via a meta marker on each comment/post, so it's safe to
	 * run again (e.g. after new activity) without double-awarding.
	 */
	public static function render_points_backfill() {
		echo '<h2>Points Backfill</h2>';
		echo '<p class="description">Catches up points for comments, event submissions, and directory listing submissions that happened before those hooks were fixed/added. Safe to run more than once — anything already credited is skipped.</p>';
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin: 0.75em 0;">
			<?php wp_nonce_field( 'sc_membership_backfill_points' ); ?>
			<input type="hidden" name="action" value="sc_membership_backfill_points" />
			<button type="submit" class="button">Backfill missing points now</button>
		</form>
		<?php
	}

	private static function render_backfill_notice() {
		$result = get_transient( 'sc_membership_backfill_result_' . get_current_user_id() );
		if ( ! $result ) {
			return;
		}
		delete_transient( 'sc_membership_backfill_result_' . get_current_user_id() );
		printf(
			'<div class="notice notice-success"><p>Backfill complete: %1$d comment(s), %2$d event submission(s), %3$d directory listing submission(s) awarded points.</p></div>',
			(int) $result['comments'],
			(int) $result['events'],
			(int) $result['listings']
		);
	}

	public static function handle_backfill_points() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}

		check_admin_referer( 'sc_membership_backfill_points' );

		$counts = array( 'comments' => 0, 'events' => 0, 'listings' => 0 );

		$comments = get_comments(
			array(
				'status' => 'approve',
				'type'   => 'comment',
				'number' => 0,
			)
		);
		foreach ( $comments as $comment ) {
			$user_id = (int) $comment->user_id;
			if ( ! $user_id || '1' === get_comment_meta( $comment->comment_ID, 'sc_points_awarded', true ) ) {
				continue;
			}
			sc_membership_award_points( $user_id, 2, 'Left a comment', 'comment' );
			update_comment_meta( $comment->comment_ID, 'sc_points_awarded', '1' );
			$counts['comments']++;
		}

		/**
		 * Publish + pending: a pending submission already represents the
		 * member having done the submitting, which is what's being
		 * rewarded (the same event a fresh submit_event()/submit_listing()
		 * call awards points for immediately, before any admin review).
		 * Staff/admin authors are skipped — those are unclaimed imported
		 * posts, not member submissions.
		 */
		/**
		 * Raw post-type slugs ('sc_event', 'sc_listing'), not
		 * SC_Events_CPT::POST_TYPE / SC_Directory_CPT::POST_TYPE — this
		 * plugin doesn't otherwise depend on sc-events/sc-directory's
		 * classes (it only listens for their generic action hooks), and
		 * get_posts() with an unregistered post type just returns an
		 * empty array, so this degrades harmlessly if either plugin is
		 * ever deactivated rather than fataling on a missing class.
		 */
		$events = get_posts(
			array(
				'post_type'      => 'sc_event',
				'post_status'    => array( 'publish', 'pending' ),
				'numberposts'    => -1,
			)
		);
		foreach ( $events as $event ) {
			$user_id = (int) $event->post_author;
			if ( ! $user_id || user_can( $user_id, 'manage_options' ) ) {
				continue;
			}
			if ( '1' === get_post_meta( $event->ID, 'sc_submit_points_awarded', true ) ) {
				continue;
			}
			sc_membership_award_points( $user_id, 5, 'Submitted an event', 'event_submit' );
			update_post_meta( $event->ID, 'sc_submit_points_awarded', '1' );
			$counts['events']++;
		}

		$listings = get_posts(
			array(
				'post_type'      => 'sc_listing',
				'post_status'    => array( 'publish', 'pending' ),
				'numberposts'    => -1,
			)
		);
		foreach ( $listings as $listing ) {
			$user_id = (int) $listing->post_author;
			if ( ! $user_id || user_can( $user_id, 'manage_options' ) ) {
				continue;
			}
			if ( '1' === get_post_meta( $listing->ID, 'sc_submit_points_awarded', true ) ) {
				continue;
			}
			sc_membership_award_points( $user_id, 5, 'Submitted a directory listing', 'directory_submit' );
			update_post_meta( $listing->ID, 'sc_submit_points_awarded', '1' );
			$counts['listings']++;
		}

		set_transient( 'sc_membership_backfill_result_' . get_current_user_id(), $counts, 60 );

		wp_safe_redirect( admin_url( 'admin.php?page=sc-membership' ) );
		exit;
	}

	public static function render_upgrade_queue() {
		global $wpdb;
		$table = SC_Membership_DB::members_table();

		$pending = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE directory_upgrade_status = %s ORDER BY directory_upgrade_requested_at ASC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				'pending'
			)
		);

		echo '<h2>Directory Upgrade Requests</h2>';

		if ( empty( $pending ) ) {
			echo '<p>No pending requests.</p>';
			return;
		}

		echo '<table class="wp-list-table widefat fixed striped"><thead><tr>'
			. '<th>Member</th><th>Listing</th><th>Tier</th><th>Points</th><th>Requested</th><th>Action</th>'
			. '</tr></thead><tbody>';

		foreach ( $pending as $row ) {
			$user    = get_userdata( $row->user_id );
			$tier    = SC_Membership_Tiers::get( $row->tier );
			$listing = $row->directory_upgrade_listing_id ? get_post( $row->directory_upgrade_listing_id ) : null;
			printf(
				'<tr><td>%1$s</td><td>%2$s</td><td>%3$s</td><td>%4$d</td><td>%5$s</td><td>%6$s</td></tr>',
				esc_html( $user ? $user->display_name . ' (' . $user->user_email . ')' : 'Unknown user' ),
				$listing ? '<a href="' . esc_url( get_edit_post_link( $listing->ID, '' ) ) . '">' . esc_html( $listing->post_title ) . '</a>' : '<em>General request</em>',
				esc_html( $tier ? $tier['label'] : $row->tier ),
				(int) $row->points,
				esc_html( $row->directory_upgrade_requested_at ),
				self::upgrade_review_buttons( $row->user_id )
			);
		}

		echo '</tbody></table>';
	}

	private static function upgrade_review_buttons( $user_id ) {
		$approve = self::upgrade_review_form( $user_id, 'approved', 'Approve' );
		$reject  = self::upgrade_review_form( $user_id, 'rejected', 'Reject' );
		return $approve . ' ' . $reject;
	}

	private static function upgrade_review_form( $user_id, $decision, $label ) {
		ob_start();
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
			<?php wp_nonce_field( 'sc_membership_review_upgrade_' . $user_id ); ?>
			<input type="hidden" name="action" value="sc_membership_review_upgrade" />
			<input type="hidden" name="user_id" value="<?php echo esc_attr( $user_id ); ?>" />
			<input type="hidden" name="decision" value="<?php echo esc_attr( $decision ); ?>" />
			<button type="submit" class="button <?php echo 'approved' === $decision ? 'button-primary' : ''; ?>">
				<?php echo esc_html( $label ); ?>
			</button>
		</form>
		<?php
		return ob_get_clean();
	}

	public static function handle_review_upgrade() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}

		$user_id  = isset( $_POST['user_id'] ) ? (int) $_POST['user_id'] : 0;
		$decision = isset( $_POST['decision'] ) ? sanitize_key( $_POST['decision'] ) : '';

		check_admin_referer( 'sc_membership_review_upgrade_' . $user_id );

		if ( $user_id && in_array( $decision, array( 'approved', 'rejected' ), true ) ) {
			global $wpdb;
			$table   = SC_Membership_DB::members_table();
			$member  = $wpdb->get_row( $wpdb->prepare( "SELECT directory_upgrade_listing_id FROM {$table} WHERE user_id = %d", $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

			$wpdb->update(
				$table,
				array(
					'directory_upgrade_status'      => $decision,
					'directory_upgrade_reviewed_by' => get_current_user_id(),
					'updated_at'                     => current_time( 'mysql' ),
				),
				array( 'user_id' => $user_id ),
				array( '%s', '%d', '%s' ),
				array( '%d' )
			);

			/**
			 * sc-directory hooks in here to actually unlock paid/featured
			 * listing features once approval happens. $listing_id is null
			 * for a general membership-level request (no specific listing).
			 */
			$listing_id = $member && $member->directory_upgrade_listing_id ? (int) $member->directory_upgrade_listing_id : null;
			do_action( 'sc_membership_upgrade_reviewed', $user_id, $decision, $listing_id );
		}

		wp_safe_redirect( admin_url( 'admin.php?page=sc-membership' ) );
		exit;
	}

	/**
	 * Accounts SC_Membership_Auth::register() (new signups) or the
	 * "Scan now" button below (existing accounts) flagged as looking
	 * like a spam registration — hidden from the public /members list
	 * (SC_Membership_REST::get_members) until republished or removed here.
	 */
	public static function render_pending_members_queue() {
		$pending = get_users(
			array(
				'meta_key'   => 'sc_member_pending_review', // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_value' => '1', // phpcs:ignore WordPress.DB.SlowDBQuery
				'number'     => 200,
				'orderby'    => 'registered',
				'order'      => 'DESC',
			)
		);

		echo '<h2>Pending Members</h2>';
		echo '<p class="description">Registrations that look like spam (a URL for a username) don\'t show up on the public members list until you review them here.</p>';

		self::scan_button();

		if ( empty( $pending ) ) {
			echo '<p>No pending members.</p>';
			return;
		}

		echo '<table class="wp-list-table widefat fixed striped"><thead><tr>'
			. '<th>Username</th><th>Display name</th><th>Email</th><th>Registered</th><th>Reason</th><th>Action</th>'
			. '</tr></thead><tbody>';

		foreach ( $pending as $user ) {
			$reason = get_user_meta( $user->ID, 'sc_member_pending_reason', true );
			printf(
				'<tr><td>%1$s</td><td>%2$s</td><td>%3$s</td><td>%4$s</td><td>%5$s</td><td>%6$s</td></tr>',
				esc_html( $user->user_login ),
				esc_html( $user->display_name ),
				esc_html( $user->user_email ),
				esc_html( $user->user_registered ),
				esc_html( 'url_username' === $reason ? 'Username looks like a URL' : $reason ),
				self::pending_member_form( $user )
			);
		}

		echo '</tbody></table>';
	}

	private static function scan_button() {
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin: 0.75em 0;">
			<?php wp_nonce_field( 'sc_membership_scan_pending_members' ); ?>
			<input type="hidden" name="action" value="sc_membership_scan_pending_members" />
			<button type="submit" class="button">Scan existing members for spam-looking usernames</button>
		</form>
		<?php
	}

	/**
	 * A display-name field so Rob can fix an unlucky-but-real name (not
	 * user_login — WordPress doesn't support renaming that) before
	 * republishing, plus the Remove option, in one row/form.
	 */
	private static function pending_member_form( $user ) {
		ob_start();
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<?php wp_nonce_field( 'sc_membership_review_pending_member_' . $user->ID ); ?>
			<input type="hidden" name="action" value="sc_membership_review_pending_member" />
			<input type="hidden" name="user_id" value="<?php echo esc_attr( $user->ID ); ?>" />
			<input type="text" name="display_name" value="<?php echo esc_attr( $user->display_name ); ?>" style="width: 160px;" />
			<button type="submit" name="decision" value="republish" class="button button-primary">Save &amp; republish</button>
			<button type="submit" name="decision" value="remove" class="button" onclick="return confirm('Permanently delete this account?');">Remove</button>
		</form>
		<?php
		return ob_get_clean();
	}

	public static function handle_review_pending_member() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}

		$user_id  = isset( $_POST['user_id'] ) ? (int) $_POST['user_id'] : 0;
		$decision = isset( $_POST['decision'] ) ? sanitize_key( $_POST['decision'] ) : '';

		check_admin_referer( 'sc_membership_review_pending_member_' . $user_id );

		if ( $user_id && 'republish' === $decision ) {
			$display_name = sanitize_text_field( (string) ( $_POST['display_name'] ?? '' ) );
			$update       = array( 'ID' => $user_id );
			if ( $display_name ) {
				$update['display_name'] = $display_name;
				$update['nickname']     = $display_name;
			}
			wp_update_user( $update );

			delete_user_meta( $user_id, 'sc_member_pending_review' );
			delete_user_meta( $user_id, 'sc_member_pending_reason' );
			update_user_meta( $user_id, 'sc_member_reviewed', '1' );
		} elseif ( $user_id && 'remove' === $decision ) {
			if ( ! function_exists( 'wp_delete_user' ) ) {
				require_once ABSPATH . 'wp-admin/includes/user.php';
			}
			wp_delete_user( $user_id );
		}

		wp_safe_redirect( admin_url( 'admin.php?page=sc-membership' ) );
		exit;
	}

	/**
	 * Catches accounts that registered before this feature existed —
	 * new signups are flagged automatically (SC_Membership_Auth::register),
	 * this is the one-off backfill for everyone already in the database.
	 * Skips anyone already reviewed (SC_Membership_DB::is_reviewed) so a
	 * legit member Rob already restored doesn't get re-flagged just for
	 * having ".com" in a business name.
	 */
	public static function handle_scan_pending_members() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}

		check_admin_referer( 'sc_membership_scan_pending_members' );

		/**
		 * Self-correcting: an earlier, looser version of
		 * username_looks_like_url() flagged plain email-address usernames
		 * (chrisperr54@hotmail.com matched a bare "\.com" check just like
		 * a real spam URL would) — every account this button auto-flagged
		 * (reason 'url_username', never manually reviewed) gets
		 * re-checked against the *current* logic, and un-flagged if it no
		 * longer matches, so tightening the detection here fixes past
		 * over-flagging on the next scan rather than needing a one-off cleanup.
		 */
		$auto_flagged = get_users(
			array(
				'meta_query' => array( // phpcs:ignore WordPress.DB.SlowDBQuery
					array(
						'key'   => 'sc_member_pending_review',
						'value' => '1',
					),
					array(
						'key'   => 'sc_member_pending_reason',
						'value' => 'url_username',
					),
				),
				'number' => -1,
			)
		);
		foreach ( $auto_flagged as $user ) {
			if ( ! SC_Membership_DB::username_looks_like_url( $user->user_login, $user->display_name ) ) {
				delete_user_meta( $user->ID, 'sc_member_pending_review' );
				delete_user_meta( $user->ID, 'sc_member_pending_reason' );
			}
		}

		$users = get_users(
			array(
				'role__not_in' => array( 'administrator' ),
				'number'       => -1,
			)
		);

		foreach ( $users as $user ) {
			if ( SC_Membership_DB::is_pending_review( $user->ID ) || SC_Membership_DB::is_reviewed( $user->ID ) ) {
				continue;
			}
			if ( SC_Membership_DB::username_looks_like_url( $user->user_login, $user->display_name ) ) {
				SC_Membership_DB::flag_pending_review( $user->ID, 'url_username' );
			}
		}

		wp_safe_redirect( admin_url( 'admin.php?page=sc-membership' ) );
		exit;
	}
}
