<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A plain Featured checkbox for sc_event_featured — the "Coming up next"
 * hero slot's admin-only override (see SC_Events_Meta's docblock). Until
 * now the only way to set it was WordPress's raw Custom Fields box, clunky
 * and easy to get wrong for a boolean; same reasoning as SC_Ads_Metabox/
 * SC_Jobs_Metabox. Also surfaces a member's "make my event featured"
 * request (sc_event_featured_status et al), if one exists, right next to
 * the toggle that actually acts on it.
 */
class SC_Events_Metabox {

	public static function register() {
		add_meta_box(
			'sc_event_featured_box',
			'Featured',
			array( __CLASS__, 'render' ),
			SC_Events_CPT::POST_TYPE,
			'side',
			'high'
		);
	}

	public static function render( $post ) {
		wp_nonce_field( 'sc_event_featured_save_' . $post->ID, 'sc_event_featured_nonce' );

		$featured      = get_post_meta( $post->ID, 'sc_event_featured', true );
		$req_status    = get_post_meta( $post->ID, 'sc_event_featured_status', true );
		$req_at        = get_post_meta( $post->ID, 'sc_event_featured_requested_at', true );
		$amount        = get_post_meta( $post->ID, 'sc_event_featured_amount_paid', true );
		?>
		<p>
			<label>
				<input type="checkbox" name="sc_event_featured" value="1" <?php checked( $featured, true ); ?> />
				Feature this event
			</label>
		</p>
		<p class="description">
			Puts the event in the featured slider on the events pages and the
			homepage, with a Featured badge, until the event's date. Members who
			pay £5 through PayPal are featured automatically; tick this to feature
			one by hand.
		</p>
		<?php
		$until   = get_post_meta( $post->ID, 'sc_event_featured_until', true );
		$payment = get_post_meta( $post->ID, 'sc_event_featured_payment', true );
		if ( 'paid' === $payment ) :
			?>
			<p><strong>Paid</strong><?php echo $amount ? ' ' . esc_html( $amount ) : ''; ?><?php echo $until ? ' · featured until ' . esc_html( $until ) : ''; ?></p>
		<?php endif; ?>
		<?php if ( $req_status ) : ?>
			<hr />
			<p>
				<strong>Member request:</strong>
				<?php echo esc_html( ucfirst( $req_status ) ); ?>
				<?php if ( $req_at ) : ?>
					<span class="description">(<?php echo esc_html( $req_at ); ?>)</span>
				<?php endif; ?>
			</p>
			<p>
				<label for="sc_event_featured_status">Update request status</label>
				<select id="sc_event_featured_status" name="sc_event_featured_status" style="width:100%">
					<option value="pending" <?php selected( $req_status, 'pending' ); ?>>Pending</option>
					<option value="approved" <?php selected( $req_status, 'approved' ); ?>>Approved</option>
					<option value="rejected" <?php selected( $req_status, 'rejected' ); ?>>Rejected</option>
				</select>
			</p>
			<p>
				<label for="sc_event_featured_amount_paid">Amount paid</label>
				<input type="text" id="sc_event_featured_amount_paid" name="sc_event_featured_amount_paid"
					style="width:100%" value="<?php echo esc_attr( $amount ); ?>" placeholder="e.g. £5" />
			</p>
			<p class="description">Approving here doesn't tick Featured above by itself — do both when you're ready to actually switch the hero slot over.</p>
		<?php endif; ?>
		<?php
	}

	public static function save( $post_id ) {
		if ( ! isset( $_POST['sc_event_featured_nonce'] ) || ! wp_verify_nonce( $_POST['sc_event_featured_nonce'], 'sc_event_featured_save_' . $post_id ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		update_post_meta( $post_id, 'sc_event_featured', ! empty( $_POST['sc_event_featured'] ) );

		if ( isset( $_POST['sc_event_featured_status'] ) ) {
			$status = sanitize_key( wp_unslash( $_POST['sc_event_featured_status'] ) );
			if ( in_array( $status, array( 'pending', 'approved', 'rejected' ), true ) ) {
				update_post_meta( $post_id, 'sc_event_featured_status', $status );
			}
		}
		if ( isset( $_POST['sc_event_featured_amount_paid'] ) ) {
			update_post_meta( $post_id, 'sc_event_featured_amount_paid', sanitize_text_field( wp_unslash( $_POST['sc_event_featured_amount_paid'] ) ) );
		}
	}
}
