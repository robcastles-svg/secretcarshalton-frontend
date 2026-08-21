<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The approval queue for directory upgrades — this is the "I would have
 * to approve directory upgrades once they've paid" screen Rob described.
 * Deliberately plain (a table + Approve/Reject buttons), no JS framework,
 * so it stays simple to extend once sc-directory exists and needs its own
 * review step alongside this one.
 */
class SC_Membership_Admin {

	public static function register_menu() {
		add_menu_page(
			'Membership',
			'Membership',
			'manage_options',
			'sc-membership',
			array( __CLASS__, 'render_upgrade_queue' ),
			'dashicons-groups',
			30
		);
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

		echo '<div class="wrap"><h1>Membership — Directory Upgrade Requests</h1>';

		if ( empty( $pending ) ) {
			echo '<p>No pending requests.</p></div>';
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
				self::review_buttons( $row->user_id )
			);
		}

		echo '</tbody></table></div>';
	}

	private static function review_buttons( $user_id ) {
		$approve = self::review_form( $user_id, 'approved', 'Approve' );
		$reject  = self::review_form( $user_id, 'rejected', 'Reject' );
		return $approve . ' ' . $reject;
	}

	private static function review_form( $user_id, $decision, $label ) {
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
}
