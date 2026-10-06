<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Where PayPal credentials actually live — wp_options, entered by hand in
 * wp-admin, never in this plugin's own PHP files. Those files are version
 * controlled in the same git repo as the Next.js frontend; a secret
 * hardcoded here would be permanent in git history the moment it's
 * committed. Sandbox and live credentials are kept in entirely separate
 * fields (not just a value swapped on mode change) so switching the mode
 * dropdown back to Sandbox for a retest can never accidentally expose a
 * live secret, and vice versa.
 */
class SC_Ads_PayPal_Settings {

	const OPTION_GROUP = 'sc_ads_paypal';

	const FIELDS = array(
		'sc_ads_paypal_mode'              => 'sandbox', // 'sandbox' | 'live' — which credential pair create-order/capture-order actually use.
		'sc_ads_paypal_sandbox_client_id' => '',
		'sc_ads_paypal_sandbox_secret'    => '',
		'sc_ads_paypal_live_client_id'    => '',
		'sc_ads_paypal_live_secret'       => '',
		// Filled in once the webhook subscription exists (see SC_Ads_PayPal::ensure_webhook) — needed to verify incoming webhook payloads are really from PayPal.
		'sc_ads_paypal_webhook_id'        => '',
	);

	public static function register_menu() {
		add_submenu_page(
			'edit.php?post_type=' . SC_Ads_CPT::POST_TYPE,
			'PayPal Settings',
			'PayPal Settings',
			'manage_options',
			'sc-ads-paypal',
			array( __CLASS__, 'render' )
		);
	}

	public static function get( $key ) {
		return get_option( $key, self::FIELDS[ $key ] ?? '' );
	}

	/** The credential pair actually in use right now, per the mode dropdown. */
	public static function active_credentials() {
		$mode = self::get( 'sc_ads_paypal_mode' );
		if ( 'live' === $mode ) {
			return array(
				'mode'      => 'live',
				'client_id' => self::get( 'sc_ads_paypal_live_client_id' ),
				'secret'    => self::get( 'sc_ads_paypal_live_secret' ),
				'api_base'  => 'https://api-m.paypal.com',
			);
		}
		return array(
			'mode'      => 'sandbox',
			'client_id' => self::get( 'sc_ads_paypal_sandbox_client_id' ),
			'secret'    => self::get( 'sc_ads_paypal_sandbox_secret' ),
			'api_base'  => 'https://api-m.sandbox.paypal.com',
		);
	}

	public static function render() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}

		if ( isset( $_POST['sc_ads_paypal_save'] ) ) {
			check_admin_referer( 'sc_ads_paypal_settings' );

			$mode = sanitize_text_field( (string) ( $_POST['sc_ads_paypal_mode'] ?? 'sandbox' ) );
			update_option( 'sc_ads_paypal_mode', in_array( $mode, array( 'sandbox', 'live' ), true ) ? $mode : 'sandbox' );

			foreach ( array( 'sc_ads_paypal_sandbox_client_id', 'sc_ads_paypal_sandbox_secret', 'sc_ads_paypal_live_client_id', 'sc_ads_paypal_live_secret' ) as $key ) {
				if ( isset( $_POST[ $key ] ) ) {
					$value = trim( sanitize_text_field( wp_unslash( $_POST[ $key ] ) ) );
					// A field left as the masked placeholder (see render_secret_field) means "leave unchanged" — don't overwrite a real secret with asterisks.
					if ( '' !== $value && ! preg_match( '/^\*+$/', $value ) ) {
						update_option( $key, $value );
					} elseif ( '' === $value ) {
						update_option( $key, '' );
					}
				}
			}

			echo '<div class="notice notice-success"><p>Saved.</p></div>';
		}

		$mode = self::get( 'sc_ads_paypal_mode' );
		?>
		<div class="wrap">
			<h1>PayPal Settings — Text Ads</h1>
			<p class="description">Credentials from a PayPal Developer app (developer.paypal.com → Apps &amp; Credentials). Sandbox and Live are kept separate — the Mode dropdown below picks which pair create-order/capture-order actually use.</p>
			<form method="post">
				<?php wp_nonce_field( 'sc_ads_paypal_settings' ); ?>
				<table class="form-table">
					<tr>
						<th><label for="sc_ads_paypal_mode">Mode</label></th>
						<td>
							<select name="sc_ads_paypal_mode" id="sc_ads_paypal_mode">
								<option value="sandbox" <?php selected( $mode, 'sandbox' ); ?>>Sandbox (testing, no real money)</option>
								<option value="live" <?php selected( $mode, 'live' ); ?>>Live (real payments)</option>
							</select>
						</td>
					</tr>
					<tr><th colspan="2"><h2>Sandbox credentials</h2></th></tr>
					<tr>
						<th><label for="sc_ads_paypal_sandbox_client_id">Client ID</label></th>
						<td><input type="text" class="regular-text" name="sc_ads_paypal_sandbox_client_id" id="sc_ads_paypal_sandbox_client_id" value="<?php echo esc_attr( self::get( 'sc_ads_paypal_sandbox_client_id' ) ); ?>" autocomplete="off" /></td>
					</tr>
					<tr>
						<th><label for="sc_ads_paypal_sandbox_secret">Secret</label></th>
						<td><?php self::render_secret_field( 'sc_ads_paypal_sandbox_secret' ); ?></td>
					</tr>
					<tr><th colspan="2"><h2>Live credentials</h2></th></tr>
					<tr>
						<th><label for="sc_ads_paypal_live_client_id">Client ID</label></th>
						<td><input type="text" class="regular-text" name="sc_ads_paypal_live_client_id" id="sc_ads_paypal_live_client_id" value="<?php echo esc_attr( self::get( 'sc_ads_paypal_live_client_id' ) ); ?>" autocomplete="off" /></td>
					</tr>
					<tr>
						<th><label for="sc_ads_paypal_live_secret">Secret</label></th>
						<td><?php self::render_secret_field( 'sc_ads_paypal_live_secret' ); ?></td>
					</tr>
					<tr>
						<th>Webhook ID</th>
						<td>
							<code><?php echo esc_html( self::get( 'sc_ads_paypal_webhook_id' ) ?: '(not set up yet)' ); ?></code>
							<p class="description">Set automatically once the webhook subscription is created against the current Mode's app — not something to type in by hand.</p>
						</td>
					</tr>
				</table>
				<?php submit_button( 'Save', 'primary', 'sc_ads_paypal_save' ); ?>
			</form>

			<hr />
			<h2>Webhook</h2>
			<p class="description">
				Save your Client ID/Secret for the current Mode above first, then click this — it registers
				this site's webhook URL with PayPal so a payment still completes even if a member closes the
				tab right after paying. Re-running it after switching Mode registers a fresh webhook for that
				mode's app.
			</p>
			<?php
			$webhook_notice = get_transient( 'sc_ads_paypal_webhook_notice' );
			if ( $webhook_notice ) {
				delete_transient( 'sc_ads_paypal_webhook_notice' );
				echo '<div class="notice notice-info"><p>' . esc_html( $webhook_notice ) . '</p></div>';
			}
			?>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( 'sc_ads_paypal_setup_webhook' ); ?>
				<input type="hidden" name="action" value="sc_ads_paypal_setup_webhook" />
				<button type="submit" class="button">Set up webhook for current Mode</button>
			</form>
		</div>
		<?php
	}

	public static function handle_setup_webhook() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		check_admin_referer( 'sc_ads_paypal_setup_webhook' );

		$callback_url = rest_url( 'sc-ads/v1/paypal/webhook' );
		$result       = SC_Ads_PayPal::ensure_webhook( $callback_url );

		if ( is_wp_error( $result ) ) {
			set_transient( 'sc_ads_paypal_webhook_notice', 'Webhook setup failed: ' . $result->get_error_message(), 60 );
		} else {
			set_transient( 'sc_ads_paypal_webhook_notice', 'Webhook registered against ' . $callback_url, 60 );
		}

		wp_safe_redirect( admin_url( 'edit.php?post_type=' . SC_Ads_CPT::POST_TYPE . '&page=sc-ads-paypal' ) );
		exit;
	}

	/** Shows a masked placeholder instead of the real secret once one's saved — submitting the form unchanged leaves it alone (see the save handler above), rather than ever re-displaying it in page source. */
	private static function render_secret_field( $key ) {
		$has_value = (bool) self::get( $key );
		$display   = $has_value ? str_repeat( '*', 24 ) : '';
		printf(
			'<input type="password" class="regular-text" name="%1$s" id="%1$s" value="%2$s" autocomplete="off" placeholder="%3$s" />',
			esc_attr( $key ),
			esc_attr( $display ),
			$has_value ? 'Leave as-is to keep the current secret' : 'Not set'
		);
	}
}
