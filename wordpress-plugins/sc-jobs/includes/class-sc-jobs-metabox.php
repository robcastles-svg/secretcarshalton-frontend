<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A plain labelled form for the fields SC_Jobs_Meta registers, same
 * reasoning as SC_Ads_Metabox: without this, setting them means using
 * WordPress's raw Custom Fields box, which is clunky for a boolean like
 * Featured and easy to get wrong by hand.
 */
class SC_Jobs_Metabox {

	public static function register() {
		add_meta_box(
			'sc_job_details',
			'Job Details',
			array( __CLASS__, 'render' ),
			SC_Jobs_CPT::POST_TYPE,
			'normal',
			'high'
		);
	}

	public static function render( $post ) {
		wp_nonce_field( 'sc_job_save_' . $post->ID, 'sc_job_nonce' );

		$source        = get_post_meta( $post->ID, 'source', true );
		$featured      = get_post_meta( $post->ID, 'featured', true );
		$company       = get_post_meta( $post->ID, 'job_company', true );
		$salary        = get_post_meta( $post->ID, 'job_salary_text', true );
		$external_url  = get_post_meta( $post->ID, 'external_url', true );
		$rate_bracket  = get_post_meta( $post->ID, 'job_rate_bracket', true );
		$amount        = get_post_meta( $post->ID, 'amount_paid', true );
		$payment       = get_post_meta( $post->ID, 'payment_status', true );
		?>
		<table class="form-table">
			<tr>
				<th><label for="job_company">Company</label></th>
				<td><input type="text" id="job_company" name="job_company" class="large-text" value="<?php echo esc_attr( $company ); ?>" /></td>
			</tr>
			<tr>
				<th><label for="job_salary_text">Salary</label></th>
				<td><input type="text" id="job_salary_text" name="job_salary_text" class="large-text" value="<?php echo esc_attr( $salary ); ?>" placeholder="e.g. £25,000–£30,000" /></td>
			</tr>
			<tr>
				<th><label for="external_url">How to apply</label></th>
				<td>
					<input type="text" id="external_url" name="external_url" class="large-text" value="<?php echo esc_attr( $external_url ); ?>" placeholder="A link, or an email address" />
					<p class="description">A plain email address is turned into a mailto: link automatically.</p>
				</td>
			</tr>
			<tr>
				<th><label for="featured">Featured</label></th>
				<td>
					<label><input type="checkbox" id="featured" name="featured" value="1" <?php checked( $featured, true ); ?> /> Pin this job into "From around the area" on the Jobs page, with a pink border and Featured badge</label>
					<p class="description">Only meaningful for a member-submitted (local) job — pulls it out of the plain "Posted locally" list and promotes it alongside the external listings, regardless of how old it is.</p>
				</td>
			</tr>
		</table>
		<?php if ( 'member' === $source ) : ?>
			<h4>Payment (self-serve submission)</h4>
			<table class="form-table">
				<tr>
					<th>Rate bracket</th>
					<td><?php echo esc_html( $rate_bracket ? $rate_bracket : '—' ); ?></td>
				</tr>
				<tr>
					<th><label for="amount_paid">Amount paid</label></th>
					<td><input type="text" id="amount_paid" name="amount_paid" style="width:140px" value="<?php echo esc_attr( $amount ); ?>" placeholder="e.g. £15" /></td>
				</tr>
				<tr>
					<th><label for="payment_status">Payment status</label></th>
					<td>
						<select id="payment_status" name="payment_status">
							<option value="pending" <?php selected( $payment, 'pending' ); ?>>Pending</option>
							<option value="paid" <?php selected( $payment, 'paid' ); ?>>Paid</option>
						</select>
					</td>
				</tr>
			</table>
		<?php endif; ?>
		<?php
	}

	public static function save( $post_id ) {
		if ( ! isset( $_POST['sc_job_nonce'] ) || ! wp_verify_nonce( $_POST['sc_job_nonce'], 'sc_job_save_' . $post_id ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		update_post_meta( $post_id, 'job_company', sanitize_text_field( wp_unslash( $_POST['job_company'] ?? '' ) ) );
		update_post_meta( $post_id, 'job_salary_text', sanitize_text_field( wp_unslash( $_POST['job_salary_text'] ?? '' ) ) );

		$external_url = trim( (string) wp_unslash( $_POST['external_url'] ?? '' ) );
		if ( $external_url && is_email( $external_url ) ) {
			$external_url = 'mailto:' . $external_url;
		}
		update_post_meta( $post_id, 'external_url', esc_url_raw( $external_url ) );

		update_post_meta( $post_id, 'featured', ! empty( $_POST['featured'] ) );

		if ( isset( $_POST['amount_paid'] ) ) {
			update_post_meta( $post_id, 'amount_paid', sanitize_text_field( wp_unslash( $_POST['amount_paid'] ) ) );
		}
		if ( isset( $_POST['payment_status'] ) ) {
			$payment_status = sanitize_key( wp_unslash( $_POST['payment_status'] ) );
			if ( in_array( $payment_status, array( 'pending', 'paid' ), true ) ) {
				update_post_meta( $post_id, 'payment_status', $payment_status );
			}
		}
	}
}
