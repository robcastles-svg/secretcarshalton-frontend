<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A plain, labelled form instead of the generic custom-fields panel —
 * this is the "manage without editing code" requirement, so it needs to
 * read like a form a non-technical admin can fill in, not a raw meta key.
 */
class SC_Ads_Metabox {

	public static function register() {
		add_meta_box(
			'sc_ad_details',
			'Ad Details',
			array( __CLASS__, 'render' ),
			SC_Ads_CPT::POST_TYPE,
			'normal',
			'high'
		);
	}

	public static function render( $post ) {
		wp_nonce_field( 'sc_ad_save_' . $post->ID, 'sc_ad_nonce' );

		$headline  = get_post_meta( $post->ID, 'sc_ad_headline', true );
		$body      = get_post_meta( $post->ID, 'sc_ad_body', true );
		$image     = get_post_meta( $post->ID, 'sc_ad_image_url', true );
		$link      = get_post_meta( $post->ID, 'sc_ad_link_url', true );
		$alt       = get_post_meta( $post->ID, 'sc_ad_alt_text', true );
		$placement = get_post_meta( $post->ID, 'sc_ad_placement', true );
		$active    = get_post_meta( $post->ID, 'sc_ad_active', true );
		$start     = get_post_meta( $post->ID, 'sc_ad_start', true );
		$end       = get_post_meta( $post->ID, 'sc_ad_end', true );
		$weight    = get_post_meta( $post->ID, 'sc_ad_weight', true );
		$clicks    = (int) get_post_meta( $post->ID, 'sc_ad_clicks', true );
		?>
		<table class="form-table">
			<tr>
				<th><label for="sc_ad_headline">Headline</label></th>
				<td>
					<input type="text" id="sc_ad_headline" name="sc_ad_headline" class="large-text"
						value="<?php echo esc_attr( $headline ); ?>" placeholder="e.g. 20% off this month at..." />
					<p class="description">Shown for every placement except Billboard — a plain text/image ad rather than a designed banner, so it's easy for an advertiser to put together themselves.</p>
				</td>
			</tr>
			<tr>
				<th><label for="sc_ad_body">Body text (optional)</label></th>
				<td><input type="text" id="sc_ad_body" name="sc_ad_body" class="large-text"
					value="<?php echo esc_attr( $body ); ?>" placeholder="A short line under the headline" /></td>
			</tr>
			<tr>
				<th><label for="sc_ad_image_url">Image URL <span class="description">(optional except for Billboard)</span></label></th>
				<td>
					<input type="url" id="sc_ad_image_url" name="sc_ad_image_url" class="large-text"
						value="<?php echo esc_attr( $image ); ?>" placeholder="https://…" />
					<?php if ( $image ) : ?>
						<p><img src="<?php echo esc_url( $image ); ?>" style="max-width:320px;height:auto;margin-top:8px;" /></p>
					<?php endif; ?>
				</td>
			</tr>
			<tr>
				<th><label for="sc_ad_link_url">Link URL</label></th>
				<td><input type="url" id="sc_ad_link_url" name="sc_ad_link_url" class="large-text"
					value="<?php echo esc_attr( $link ); ?>" placeholder="https://…" /></td>
			</tr>
			<tr>
				<th><label for="sc_ad_alt_text">Alt text</label></th>
				<td><input type="text" id="sc_ad_alt_text" name="sc_ad_alt_text" class="large-text"
					value="<?php echo esc_attr( $alt ); ?>" placeholder="Describes the ad for screen readers" /></td>
			</tr>
			<tr>
				<th><label for="sc_ad_placement">Placement</label></th>
				<td>
					<select id="sc_ad_placement" name="sc_ad_placement">
						<option value="">— Select —</option>
						<?php foreach ( SC_Ads_CPT::PLACEMENTS as $slug => $label ) : ?>
							<option value="<?php echo esc_attr( $slug ); ?>" <?php selected( $placement, $slug ); ?>>
								<?php echo esc_html( $label ); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</td>
			</tr>
			<tr>
				<th><label for="sc_ad_active">Active</label></th>
				<td><label><input type="checkbox" id="sc_ad_active" name="sc_ad_active" value="1" <?php checked( $active, true ); ?> /> Show this ad</label></td>
			</tr>
			<tr>
				<th><label for="sc_ad_start">Start date (optional)</label></th>
				<td><input type="date" id="sc_ad_start" name="sc_ad_start" value="<?php echo esc_attr( $start ); ?>" /></td>
			</tr>
			<tr>
				<th><label for="sc_ad_end">End date (optional)</label></th>
				<td><input type="date" id="sc_ad_end" name="sc_ad_end" value="<?php echo esc_attr( $end ); ?>" /></td>
			</tr>
			<tr>
				<th><label for="sc_ad_weight">Weight</label></th>
				<td>
					<input type="number" id="sc_ad_weight" name="sc_ad_weight" min="1" step="1" style="width:80px;"
						value="<?php echo esc_attr( $weight ?: 1 ); ?>" />
					<p class="description">Relative odds within this placement's rotation, e.g. a weight of 2 shows twice as often as a weight of 1.</p>
				</td>
			</tr>
			<tr>
				<th>Clicks</th>
				<td><?php echo esc_html( number_format_i18n( $clicks ) ); ?> <span class="description">(tracked automatically, not editable here)</span></td>
			</tr>
		</table>
		<p class="description">
			Multiple Active ads in the same placement rotate at random, weighted by the Weight field above — matching how the site's ad slots have always worked.
		</p>
		<?php
	}

	public static function save( $post_id ) {
		if ( ! isset( $_POST['sc_ad_nonce'] ) || ! wp_verify_nonce( $_POST['sc_ad_nonce'], 'sc_ad_save_' . $post_id ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		update_post_meta( $post_id, 'sc_ad_headline', sanitize_text_field( wp_unslash( $_POST['sc_ad_headline'] ?? '' ) ) );
		update_post_meta( $post_id, 'sc_ad_body', sanitize_text_field( wp_unslash( $_POST['sc_ad_body'] ?? '' ) ) );
		update_post_meta( $post_id, 'sc_ad_image_url', esc_url_raw( wp_unslash( $_POST['sc_ad_image_url'] ?? '' ) ) );
		update_post_meta( $post_id, 'sc_ad_link_url', esc_url_raw( wp_unslash( $_POST['sc_ad_link_url'] ?? '' ) ) );
		update_post_meta( $post_id, 'sc_ad_alt_text', sanitize_text_field( wp_unslash( $_POST['sc_ad_alt_text'] ?? '' ) ) );

		$placement = sanitize_key( wp_unslash( $_POST['sc_ad_placement'] ?? '' ) );
		if ( array_key_exists( $placement, SC_Ads_CPT::PLACEMENTS ) ) {
			update_post_meta( $post_id, 'sc_ad_placement', $placement );
		}

		update_post_meta( $post_id, 'sc_ad_active', ! empty( $_POST['sc_ad_active'] ) );
		update_post_meta( $post_id, 'sc_ad_weight', max( 1, absint( $_POST['sc_ad_weight'] ?? 1 ) ) );
		update_post_meta( $post_id, 'sc_ad_start', sanitize_text_field( wp_unslash( $_POST['sc_ad_start'] ?? '' ) ) );
		update_post_meta( $post_id, 'sc_ad_end', sanitize_text_field( wp_unslash( $_POST['sc_ad_end'] ?? '' ) ) );
	}
}
