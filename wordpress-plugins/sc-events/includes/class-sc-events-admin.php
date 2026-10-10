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

		self::render_organizer_claims();

		echo '<h2>Event claims</h2>';
		if ( empty( $pending ) ) {
			echo '<p>No pending event claim requests.</p></div>';
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

	/**
	 * "Is this your group?" requests from organiser pages (see
	 * SC_Events_REST::claim_organizer). Approving makes the member the
	 * organiser's manager: they can edit its details and logo from the
	 * add-event form, and any of its events still under the site's own
	 * (staff/import) account move to them so they can manage those too.
	 */
	private static function render_organizer_claims() {
		$terms = get_terms(
			array(
				'taxonomy'   => SC_Events_CPT::ORGANIZER_TAXONOMY,
				'hide_empty' => false,
				'meta_key'   => 'sc_organizer_claim_requested_by', // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_compare' => 'EXISTS',
			)
		);
		echo '<h2>Organiser claims</h2>';
		if ( is_wp_error( $terms ) || empty( $terms ) ) {
			echo '<p>No pending organiser claim requests.</p>';
			return;
		}
		echo '<table class="wp-list-table widefat fixed striped"><thead><tr>'
			. '<th>Organiser</th><th>Requested by</th><th>What they said</th><th>Requested</th><th>Action</th>'
			. '</tr></thead><tbody>';
		foreach ( $terms as $term ) {
			$user = get_userdata( (int) get_term_meta( $term->term_id, 'sc_organizer_claim_requested_by', true ) );
			$current = (int) get_term_meta( $term->term_id, 'sc_organizer_owner', true );
			$owner   = $current ? get_userdata( $current ) : null;
			printf(
				'<tr><td><a href="%1$s">%2$s</a>%3$s</td><td>%4$s</td><td>%5$s</td><td>%6$s</td><td>%7$s %8$s</td></tr>',
				esc_url( get_edit_term_link( $term->term_id, SC_Events_CPT::ORGANIZER_TAXONOMY ) ),
				esc_html( $term->name ),
				$owner ? '<br><small>Currently managed by ' . esc_html( $owner->display_name ) . '</small>' : '',
				esc_html( $user ? $user->display_name . ' (' . $user->user_email . ')' : 'Unknown user' ),
				esc_html( (string) get_term_meta( $term->term_id, 'sc_organizer_claim_message', true ) ),
				esc_html( (string) get_term_meta( $term->term_id, 'sc_organizer_claim_requested_at', true ) ),
				self::organizer_review_form( $term->term_id, 'approved', 'Approve' ),
				self::organizer_review_form( $term->term_id, 'rejected', 'Reject' )
			);
		}
		echo '</tbody></table>';
	}

	private static function organizer_review_form( $term_id, $decision, $label ) {
		ob_start();
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
			<?php wp_nonce_field( 'sc_events_review_org_claim_' . $term_id ); ?>
			<input type="hidden" name="action" value="sc_events_review_org_claim" />
			<input type="hidden" name="term_id" value="<?php echo esc_attr( $term_id ); ?>" />
			<input type="hidden" name="decision" value="<?php echo esc_attr( $decision ); ?>" />
			<button type="submit" class="button <?php echo 'approved' === $decision ? 'button-primary' : ''; ?>">
				<?php echo esc_html( $label ); ?>
			</button>
		</form>
		<?php
		return ob_get_clean();
	}

	public static function handle_review_org_claim() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		$term_id  = isset( $_POST['term_id'] ) ? (int) $_POST['term_id'] : 0;
		$decision = isset( $_POST['decision'] ) ? sanitize_key( $_POST['decision'] ) : '';
		check_admin_referer( 'sc_events_review_org_claim_' . $term_id );

		$user_id = (int) get_term_meta( $term_id, 'sc_organizer_claim_requested_by', true );
		$term    = get_term( $term_id, SC_Events_CPT::ORGANIZER_TAXONOMY );
		$user    = $user_id ? get_userdata( $user_id ) : null;

		if ( $term && ! is_wp_error( $term ) && $user && in_array( $decision, array( 'approved', 'rejected' ), true ) ) {
			if ( 'approved' === $decision ) {
				update_term_meta( $term_id, 'sc_organizer_owner', $user_id );

				// Its events still under a staff/import account move to the new manager.
				$events = get_posts(
					array(
						'post_type'      => SC_Events_CPT::POST_TYPE,
						'post_status'    => array( 'publish', 'pending', 'draft' ),
						'posts_per_page' => -1,
						'fields'         => 'ids',
						'tax_query'      => array( // phpcs:ignore WordPress.DB.SlowDBQuery
							array(
								'taxonomy' => SC_Events_CPT::ORGANIZER_TAXONOMY,
								'terms'    => array( $term_id ),
							),
						),
					)
				);
				foreach ( $events as $event_id ) {
					if ( user_can( (int) get_post_field( 'post_author', $event_id ), 'manage_options' ) ) {
						wp_update_post( array( 'ID' => $event_id, 'post_author' => $user_id ) );
					}
				}

				wp_mail(
					$user->user_email,
					'You now manage ' . $term->name . ' on Secret Carshalton',
					"Hi {$user->display_name},\n\nYour request to manage \"{$term->name}\" has been approved. You can now update its details and logo, and manage its events, from the Add your event page while signed in.\n\nThanks,\nSecret Carshalton"
				);
				do_action( 'sc_events_organizer_claimed', $user_id, $term_id );
			}
			delete_term_meta( $term_id, 'sc_organizer_claim_requested_by' );
			delete_term_meta( $term_id, 'sc_organizer_claim_requested_at' );
			delete_term_meta( $term_id, 'sc_organizer_claim_message' );
		}

		wp_safe_redirect( admin_url( 'edit.php?post_type=' . SC_Events_CPT::POST_TYPE . '&page=sc-events-claims' ) );
		exit;
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
