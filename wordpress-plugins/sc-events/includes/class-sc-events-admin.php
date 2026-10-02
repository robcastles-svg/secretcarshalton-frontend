<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The approval queue for "is this your event?" claim requests — mirrors
 * SC_Directory_Admin's Claim Requests screen exactly, same plain table +
 * Approve/Reject pattern, adapted for events (no sc_claimed/expiry layer
 * here, since an event owner doesn't need the same annual re-verification
 * an evergreen business listing does — approving just reassigns
 * post_author).
 */
class SC_Events_Admin {

	public static function register_menu() {
		add_submenu_page(
			'edit.php?post_type=' . SC_Events_CPT::POST_TYPE,
			'Claim Requests',
			'Claim Requests',
			'manage_options',
			'sc-events-claims',
			array( __CLASS__, 'render_claim_queue' )
		);
	}

	public static function render_claim_queue() {
		$pending = self::pending_claims();

		echo '<div class="wrap"><h1>Events — Claim Requests</h1>';

		if ( empty( $pending ) ) {
			echo '<p>No pending claim requests.</p></div>';
			return;
		}

		echo '<table class="wp-list-table widefat fixed striped"><thead><tr>'
			. '<th>Event</th><th>Requested by</th><th>Requested</th><th>Action</th>'
			. '</tr></thead><tbody>';

		foreach ( $pending as $row ) {
			$event = $row['event'];
			$user  = $row['user'];
			printf(
				'<tr><td><a href="%1$s">%2$s</a></td><td>%3$s</td><td>%4$s</td><td>%5$s</td></tr>',
				esc_url( get_edit_post_link( $event->ID, '' ) ),
				esc_html( $event->post_title ),
				esc_html( $user ? $user->display_name . ' (' . $user->user_email . ')' : 'Unknown user' ),
				esc_html( $row['requested_at'] ),
				self::review_buttons( $event->ID )
			);
		}

		echo '</tbody></table></div>';
	}

	/** Same approach as SC_Directory_Admin::pending_claims — a claim request is just postmeta, no dedicated table. */
	private static function pending_claims() {
		$query = new WP_Query(
			array(
				'post_type'      => SC_Events_CPT::POST_TYPE,
				'post_status'    => 'any',
				'posts_per_page' => 100,
				'meta_query'     => array(
					array(
						'key'     => 'sc_event_claim_requested_by',
						'compare' => 'EXISTS',
					),
				),
			)
		);

		$rows = array();
		foreach ( $query->posts as $event ) {
			$user_id = (int) get_post_meta( $event->ID, 'sc_event_claim_requested_by', true );
			if ( ! $user_id ) {
				continue;
			}
			$rows[] = array(
				'event'        => $event,
				'user'         => get_userdata( $user_id ),
				'requested_at' => get_post_meta( $event->ID, 'sc_event_claim_requested_at', true ),
			);
		}
		return $rows;
	}

	private static function review_buttons( $event_id ) {
		$approve = self::review_form( $event_id, 'approved', 'Approve' );
		$reject  = self::review_form( $event_id, 'rejected', 'Reject' );
		return $approve . ' ' . $reject;
	}

	private static function review_form( $event_id, $decision, $label ) {
		ob_start();
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
			<?php wp_nonce_field( 'sc_events_review_claim_' . $event_id ); ?>
			<input type="hidden" name="action" value="sc_events_review_claim" />
			<input type="hidden" name="event_id" value="<?php echo esc_attr( $event_id ); ?>" />
			<input type="hidden" name="decision" value="<?php echo esc_attr( $decision ); ?>" />
			<button type="submit" class="button <?php echo 'approved' === $decision ? 'button-primary' : ''; ?>">
				<?php echo esc_html( $label ); ?>
			</button>
		</form>
		<?php
		return ob_get_clean();
	}

	public static function handle_review_claim() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}

		$event_id = isset( $_POST['event_id'] ) ? (int) $_POST['event_id'] : 0;
		$decision = isset( $_POST['decision'] ) ? sanitize_key( $_POST['decision'] ) : '';

		check_admin_referer( 'sc_events_review_claim_' . $event_id );

		$user_id = (int) get_post_meta( $event_id, 'sc_event_claim_requested_by', true );

		if ( $event_id && $user_id && in_array( $decision, array( 'approved', 'rejected' ), true ) ) {
			if ( 'approved' === $decision ) {
				wp_update_post(
					array(
						'ID'          => $event_id,
						'post_author' => $user_id,
					)
				);
				/** sc-membership listens for this and awards claim points — same action the old instant-claim flow fired. */
				do_action( 'sc_events_event_claimed', $user_id, $event_id );
			}
			// Rejected, or approved either way: clear the request so the
			// event is claimable again (by this member or someone else)
			// rather than stuck permanently "awaiting review".
			delete_post_meta( $event_id, 'sc_event_claim_requested_by' );
			delete_post_meta( $event_id, 'sc_event_claim_requested_at' );
		}

		wp_safe_redirect( admin_url( 'edit.php?post_type=' . SC_Events_CPT::POST_TYPE . '&page=sc-events-claims' ) );
		exit;
	}
}
