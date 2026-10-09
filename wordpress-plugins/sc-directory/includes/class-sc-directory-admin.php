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

	/**
	 * Tagline and Featured both have exactly one normal way to get set —
	 * the member-submitted /dashboard/upgrade request (see
	 * SC_Directory_REST::request_upgrade and ::on_upgrade_reviewed) — but
	 * most of the 118 listings migrated from the old Sabai Directory never
	 * went through that flow at all, and neither field had a wp-admin UI
	 * of its own (just the generic, easy-to-miss Custom Fields panel the
	 * 'custom-fields' post-type support adds). Rob manually promoting an
	 * imported listing to Featured, or filling in the tagline Sabai's data
	 * never had, had no reliable way to do either. This box is that way.
	 */
	public static function register_meta_box() {
		add_meta_box(
			'sc_directory_details',
			'Directory Listing Details',
			array( __CLASS__, 'render_details_meta_box' ),
			SC_Directory_CPT::POST_TYPE,
			'side',
			'high'
		);
	}

	public static function render_details_meta_box( $post ) {
		wp_nonce_field( 'sc_directory_save_details', 'sc_directory_details_nonce' );
		$tagline  = get_post_meta( $post->ID, 'sc_tagline', true );
		$featured = (bool) get_post_meta( $post->ID, 'sc_featured', true );
		?>
		<p>
			<label for="sc_directory_tagline"><strong>Tagline</strong></label><br />
			<input
				type="text"
				id="sc_directory_tagline"
				name="sc_directory_tagline"
				value="<?php echo esc_attr( $tagline ); ?>"
				maxlength="140"
				style="width:100%"
				placeholder="A one-line summary shown on listing cards"
			/>
		</p>
		<p>
			<label>
				<input type="checkbox" name="sc_directory_featured" value="1" <?php checked( $featured ); ?> />
				Featured — always shown at the top of the Directory
			</label>
		</p>
		<?php
	}

	public static function save_details_meta_box( $post_id ) {
		if ( ! isset( $_POST['sc_directory_details_nonce'] )
			|| ! wp_verify_nonce( $_POST['sc_directory_details_nonce'], 'sc_directory_save_details' )
		) {
			return;
		}
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		update_post_meta( $post_id, 'sc_tagline', sanitize_text_field( (string) ( $_POST['sc_directory_tagline'] ?? '' ) ) );
		update_post_meta( $post_id, 'sc_featured', isset( $_POST['sc_directory_featured'] ) );
	}

	public static function register_menu() {
		add_submenu_page(
			'edit.php?post_type=' . SC_Directory_CPT::POST_TYPE,
			'Claim Requests',
			'Claim Requests',
			'manage_options',
			'sc-directory-claims',
			array( __CLASS__, 'render_claim_queue' )
		);
		add_submenu_page(
			'edit.php?post_type=' . SC_Directory_CPT::POST_TYPE,
			'Group Promotions',
			'Group Promotions',
			'manage_options',
			'sc-directory-promotions',
			array( __CLASS__, 'render_promotion_queue' )
		);
		add_submenu_page(
			'edit.php?post_type=' . SC_Directory_CPT::POST_TYPE,
			'Owner Backfill',
			'Owner Backfill',
			'manage_options',
			'sc-directory-owner-backfill',
			array( __CLASS__, 'render_owner_backfill' )
		);
	}

	/**
	 * One-off pairs of (imported listing post_id, sc-membership user_id)
	 * derived from the old Sabai Directory's approved claim history —
	 * each pair is a listing whose original claim was submitted by the
	 * real business's own account (not the site's own admin2 account,
	 * which submitted many of the original bulk-added listings and was
	 * deliberately excluded — those stay unclaimed rather than being
	 * misattributed to the site owner).
	 */
	private static function owner_backfill_pairs() {
		return array(
			array( 'post_id' => 41308, 'user_id' => 4382 ),
			array( 'post_id' => 41485, 'user_id' => 4374 ),
			array( 'post_id' => 41385, 'user_id' => 4361 ),
			array( 'post_id' => 41387, 'user_id' => 4360 ),
			array( 'post_id' => 41291, 'user_id' => 4344 ),
			array( 'post_id' => 41434, 'user_id' => 1138 ),
			array( 'post_id' => 41440, 'user_id' => 4330 ),
			array( 'post_id' => 41357, 'user_id' => 1298 ),
			array( 'post_id' => 41421, 'user_id' => 4310 ),
			array( 'post_id' => 41295, 'user_id' => 4309 ),
			array( 'post_id' => 41462, 'user_id' => 4251 ),
			array( 'post_id' => 41391, 'user_id' => 4247 ),
			array( 'post_id' => 41499, 'user_id' => 4213 ),
			array( 'post_id' => 41423, 'user_id' => 4213 ),
			array( 'post_id' => 41394, 'user_id' => 3834 ),
			array( 'post_id' => 41389, 'user_id' => 2623 ),
			array( 'post_id' => 41334, 'user_id' => 2537 ),
			array( 'post_id' => 41310, 'user_id' => 1694 ),
			array( 'post_id' => 41495, 'user_id' => 1362 ),
			array( 'post_id' => 41366, 'user_id' => 907 ),
			array( 'post_id' => 41364, 'user_id' => 705 ),
			array( 'post_id' => 41406, 'user_id' => 235 ),
			array( 'post_id' => 41289, 'user_id' => 233 ),
			array( 'post_id' => 41393, 'user_id' => 232 ),
			array( 'post_id' => 41344, 'user_id' => 231 ),
			array( 'post_id' => 41404, 'user_id' => 228 ),
			array( 'post_id' => 41326, 'user_id' => 227 ),
			array( 'post_id' => 41415, 'user_id' => 149 ),
			array( 'post_id' => 41410, 'user_id' => 161 ),
			array( 'post_id' => 41464, 'user_id' => 158 ),
			array( 'post_id' => 41382, 'user_id' => 149 ),
			array( 'post_id' => 41448, 'user_id' => 145 ),
			array( 'post_id' => 41487, 'user_id' => 144 ),
			array( 'post_id' => 41306, 'user_id' => 139 ),
			array( 'post_id' => 41350, 'user_id' => 138 ),
			array( 'post_id' => 41370, 'user_id' => 137 ),
			array( 'post_id' => 41501, 'user_id' => 136 ),
			array( 'post_id' => 41436, 'user_id' => 135 ),
			array( 'post_id' => 41299, 'user_id' => 131 ),
			array( 'post_id' => 41297, 'user_id' => 128 ),
			array( 'post_id' => 41469, 'user_id' => 126 ),
			array( 'post_id' => 41383, 'user_id' => 30 ),
			array( 'post_id' => 41430, 'user_id' => 17 ),
		);
	}

	public static function render_owner_backfill() {
		$pairs   = self::owner_backfill_pairs();
		$already = 0;
		foreach ( $pairs as $pair ) {
			if ( '1' === get_post_meta( $pair['post_id'], 'sc_claimed', true ) ) {
				++$already;
			}
		}
		echo '<div class="wrap"><h1>Directory — Owner Backfill</h1>';
		if ( isset( $_GET['done'] ) ) {
			$result = get_transient( 'sc_directory_backfill_owners_result' );
			if ( $result ) {
				printf(
					'<div class="notice notice-success"><p>Done — assigned %d, skipped %d (already claimed or missing post).</p></div>',
					(int) $result['assigned'],
					(int) $result['skipped']
				);
			}
		}
		printf(
			'<p>%d listing/owner pairs from the old Sabai claim history. %d already marked claimed (skipped on run — idempotent).</p>',
			count( $pairs ),
			$already
		);
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">';
		wp_nonce_field( 'sc_directory_backfill_owners' );
		echo '<input type="hidden" name="action" value="sc_directory_backfill_owners" />';
		submit_button( 'Run backfill' );
		echo '</form></div>';
	}

	public static function handle_backfill_owners() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		check_admin_referer( 'sc_directory_backfill_owners' );

		$assigned = 0;
		$skipped  = 0;
		foreach ( self::owner_backfill_pairs() as $pair ) {
			$post_id = $pair['post_id'];
			$user_id = $pair['user_id'];

			if ( '1' === get_post_meta( $post_id, 'sc_claimed', true ) ) {
				++$skipped;
				continue;
			}
			$post = get_post( $post_id );
			if ( ! $post || SC_Directory_CPT::POST_TYPE !== $post->post_type ) {
				++$skipped;
				continue;
			}

			wp_update_post(
				array(
					'ID'          => $post_id,
					'post_author' => $user_id,
				)
			);
			update_post_meta( $post_id, 'sc_claimed', '1' );
			do_action( 'sc_directory_listing_claimed', $user_id, $post_id );
			++$assigned;
		}

		set_transient( 'sc_directory_backfill_owners_result', array( 'assigned' => $assigned, 'skipped' => $skipped ), 60 );
		wp_safe_redirect( admin_url( 'edit.php?post_type=' . SC_Directory_CPT::POST_TYPE . '&page=sc-directory-owner-backfill&done=1' ) );
		exit;
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
				update_post_meta( $listing_id, 'sc_claim_expires_at', gmdate( 'Y-m-d\TH:i:s', strtotime( '+1 year' ) ) );
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

	/**
	 * Community Group Promotion's own queue — same shape as the Claim
	 * Requests queue above (a meta_query over sc-listings, not a
	 * dedicated table), kept separate from it since it's a different
	 * product with its own reviewer decision, not a claim.
	 */
	public static function render_promotion_queue() {
		$pending = self::pending_promotions();

		echo '<div class="wrap"><h1>Directory — Group Promotion Requests</h1>';
		echo '<p>£10/30 days (see /advertise). Approving sets a 30-day expiry from today.</p>';

		if ( empty( $pending ) ) {
			echo '<p>No pending promotion requests.</p></div>';
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
				self::promotion_review_buttons( $listing->ID )
			);
		}

		echo '</tbody></table></div>';
	}

	private static function pending_promotions() {
		$query = new WP_Query(
			array(
				'post_type'      => SC_Directory_CPT::POST_TYPE,
				'post_status'    => 'any',
				'posts_per_page' => 100,
				'meta_query'     => array(
					'key'     => 'sc_group_promo_requested_by',
					'compare' => 'EXISTS',
				),
			)
		);

		$rows = array();
		foreach ( $query->posts as $listing ) {
			$user_id = (int) get_post_meta( $listing->ID, 'sc_group_promo_requested_by', true );
			$rows[]  = array(
				'listing'      => $listing,
				'user'         => $user_id ? get_userdata( $user_id ) : null,
				'requested_at' => get_post_meta( $listing->ID, 'sc_group_promo_requested_at', true ),
			);
		}
		return $rows;
	}

	private static function promotion_review_buttons( $listing_id ) {
		$approve = self::promotion_review_form( $listing_id, 'approved', 'Approve' );
		$reject  = self::promotion_review_form( $listing_id, 'rejected', 'Reject' );
		return $approve . ' ' . $reject;
	}

	private static function promotion_review_form( $listing_id, $decision, $label ) {
		ob_start();
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
			<?php wp_nonce_field( 'sc_directory_review_promotion_' . $listing_id ); ?>
			<input type="hidden" name="action" value="sc_directory_review_promotion" />
			<input type="hidden" name="listing_id" value="<?php echo esc_attr( $listing_id ); ?>" />
			<input type="hidden" name="decision" value="<?php echo esc_attr( $decision ); ?>" />
			<button type="submit" class="button <?php echo 'approved' === $decision ? 'button-primary' : ''; ?>">
				<?php echo esc_html( $label ); ?>
			</button>
		</form>
		<?php
		return ob_get_clean();
	}

	public static function handle_review_promotion() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}

		$listing_id = isset( $_POST['listing_id'] ) ? (int) $_POST['listing_id'] : 0;
		$decision   = isset( $_POST['decision'] ) ? sanitize_key( $_POST['decision'] ) : '';

		check_admin_referer( 'sc_directory_review_promotion_' . $listing_id );

		$user_id = (int) get_post_meta( $listing_id, 'sc_group_promo_requested_by', true );

		if ( $listing_id && $user_id && in_array( $decision, array( 'approved', 'rejected' ), true ) ) {
			if ( 'approved' === $decision ) {
				update_post_meta( $listing_id, 'sc_group_promoted', '1' );
				update_post_meta( $listing_id, 'sc_group_promo_expires_at', gmdate( 'Y-m-d\TH:i:s', strtotime( '+30 days' ) ) );
			}
			// Rejected, or approved either way: clear the request so a
			// fresh one can be made once this lapses, same as claims.
			delete_post_meta( $listing_id, 'sc_group_promo_requested_by' );
			delete_post_meta( $listing_id, 'sc_group_promo_requested_at' );
		}

		wp_safe_redirect( admin_url( 'edit.php?post_type=' . SC_Directory_CPT::POST_TYPE . '&page=sc-directory-promotions' ) );
		exit;
	}
}
