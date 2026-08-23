<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The approval queue for "is this your business?" claim requests — sits
 * as a submenu under the Directory Listings post-type menu WordPress
 * already generates, rather than a new top-level menu, since it's
 * directly about the listings there. Deliberately the same plain
 * table + Approve/Reject pattern as SC_Membership_Admin's upgrade queue.
 */
class SC_Directory_Admin {

	public static function register_menu() {
		add_submenu_page(
			'edit.php?post_type=' . SC_Directory_CPT::POST_TYPE,
			'Claim Requests',
			'Claim Requests',
			'manage_options',
			'sc-directory-claims',
			array( __CLASS__, 'render_claim_queue' )
		);
	}

	public static function render_claim_queue() {
		$pending = self::pending_claims();

		echo '<div class="wrap"><h1>Directory — Claim Requests</h1>';

		if ( empty( $pending ) ) {
			echo '<p>No pending claim requests.</p></div>';
			return;
		}

		echo '<table class="wp-list-table widefat fixed striped"><thead><tr>'
			. '<th>Listing</th><th>Requested by</th><th>Requested</th><th>Action</th>'
			. '</tr></thead><tbody>';

		foreach ( $pending as $row ) {
			$listing = $row['listing'];
			$user    = $row['user'];
			printf(
				'<tr><td><a href="%1$s">%2$s</a></td><td>%3$s</td><td>%4$s</td><td>%5$s</td></tr>',
				esc_url( get_edit_post_link( $listing->ID, '' ) ),
				esc_html( $listing->post_title ),
				esc_html( $user ? $user->display_name . ' (' . $user->user_email . ')' : 'Unknown user' ),
				esc_html( $row['requested_at'] ),
				self::review_buttons( $listing->ID )
			);
		}

		echo '</tbody></table></div>';
	}

	/**
	 * No dedicated table for these (unlike upgrade requests, which live in
	 * sc_members) — a claim request is just two bits of postmeta on the
	 * listing itself, so this is a meta_query rather than a DB read.
	 */
	private static function pending_claims() {
		$query = new WP_Query(
			array(
				'post_type'      => SC_Directory_CPT::POST_TYPE,
				'post_status'    => 'any',
				'posts_per_page' => 100,
				'meta_query'     => array(
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

		$rows = array();
		foreach ( $query->posts as $listing ) {
			$user_id = (int) get_post_meta( $listing->ID, 'sc_claim_requested_by', true );
			$rows[]  = array(
				'listing'      => $listing,
				'user'         => $user_id ? get_userdata( $user_id ) : null,
				'requested_at' => get_post_meta( $listing->ID, 'sc_claim_requested_at', true ),
			);
		}
		return $rows;
	}

	private static function review_buttons( $listing_id ) {
		$approve = self::review_form( $listing_id, 'approved', 'Approve' );
		$reject  = self::review_form( $listing_id, 'rejected', 'Reject' );
		return $approve . ' ' . $reject;
	}

	private static function review_form( $listing_id, $decision, $label ) {
		ob_start();
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
			<?php wp_nonce_field( 'sc_directory_review_claim_' . $listing_id ); ?>
			<input type="hidden" name="action" value="sc_directory_review_claim" />
			<input type="hidden" name="listing_id" value="<?php echo esc_attr( $listing_id ); ?>" />
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

		$listing_id = isset( $_POST['listing_id'] ) ? (int) $_POST['listing_id'] : 0;
		$decision   = isset( $_POST['decision'] ) ? sanitize_key( $_POST['decision'] ) : '';

		check_admin_referer( 'sc_directory_review_claim_' . $listing_id );

		$user_id = (int) get_post_meta( $listing_id, 'sc_claim_requested_by', true );

		if ( $listing_id && $user_id && in_array( $decision, array( 'approved', 'rejected' ), true ) ) {
			if ( 'approved' === $decision ) {
				update_post_meta( $listing_id, 'sc_claimed', '1' );
				wp_update_post(
					array(
						'ID'          => $listing_id,
						'post_author' => $user_id,
					)
				);
				/** sc-membership listens for this and awards claim points — same action the old instant-claim flow fired. */
				do_action( 'sc_directory_listing_claimed', $user_id, $listing_id );
			}
			// Rejected, or approved either way: clear the request so the
			// listing is claimable again (by this member or someone else)
			// rather than stuck permanently "awaiting review".
			delete_post_meta( $listing_id, 'sc_claim_requested_by' );
			delete_post_meta( $listing_id, 'sc_claim_requested_at' );
		}

		wp_safe_redirect( admin_url( 'edit.php?post_type=' . SC_Directory_CPT::POST_TYPE . '&page=sc-directory-claims' ) );
		exit;
	}
}
