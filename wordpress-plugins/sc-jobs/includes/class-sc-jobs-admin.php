<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The Reed API key/location settings, plus a "Sync now" button — same
 * plain form + admin-post.php pattern as SC_Membership_Admin's backfill
 * button. Sits as a submenu under the Jobs post-type menu WordPress
 * already generates, same placement convention as sc-directory's claim
 * queue.
 */
class SC_Jobs_Admin {

	public static function register_menu() {
		add_submenu_page(
			'edit.php?post_type=' . SC_Jobs_CPT::POST_TYPE,
			'Reed API Sync',
			'Reed API Sync',
			'manage_options',
			'sc-jobs-sync',
			array( __CLASS__, 'render' )
		);
	}

	public static function render() {
		echo '<div class="wrap"><h1>Reed API Sync</h1>';
		self::render_sync_notice();

		$api_key        = get_option( SC_Jobs_Sync::OPTION_REED_API_KEY, '' );
		$location_name  = get_option( SC_Jobs_Sync::OPTION_LOCATION_NAME, SC_Jobs_Sync::default_location_name() );
		$distance_miles = get_option( SC_Jobs_Sync::OPTION_DISTANCE_MILES, SC_Jobs_Sync::default_distance_miles() );
		$last_sync      = get_option( SC_Jobs_Sync::OPTION_LAST_SYNC );
		?>
		<p class="description">
			Get a free API key at
			<a href="https://www.reed.co.uk/developers/jobseeker" target="_blank" rel="noopener">reed.co.uk/developers</a>
			— no card required. Paste it below; the daily sync runs automatically once it's set, or use "Sync now" to run it immediately.
		</p>

		<?php if ( $last_sync ) : ?>
			<p><strong>Last sync:</strong>
				<?php echo esc_html( human_time_diff( $last_sync['time'] ) ); ?> ago —
				<?php echo esc_html( $last_sync['message'] ); ?>
			</p>
		<?php else : ?>
			<p><strong>Last sync:</strong> never</p>
		<?php endif; ?>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<?php wp_nonce_field( 'sc_jobs_save_settings' ); ?>
			<input type="hidden" name="action" value="sc_jobs_save_settings" />
			<table class="form-table">
				<tr>
					<th><label for="sc_jobs_reed_api_key">Reed API key</label></th>
					<td><input type="text" id="sc_jobs_reed_api_key" name="reed_api_key" value="<?php echo esc_attr( $api_key ); ?>" class="regular-text" /></td>
				</tr>
				<tr>
					<th><label for="sc_jobs_location_name">Location</label></th>
					<td><input type="text" id="sc_jobs_location_name" name="location_name" value="<?php echo esc_attr( $location_name ); ?>" class="regular-text" /></td>
				</tr>
				<tr>
					<th><label for="sc_jobs_distance_miles">Radius (miles)</label></th>
					<td><input type="number" id="sc_jobs_distance_miles" name="distance_miles" value="<?php echo esc_attr( $distance_miles ); ?>" min="1" max="50" /></td>
				</tr>
			</table>
			<button type="submit" class="button button-primary">Save settings</button>
		</form>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top: 1.5em;">
			<?php wp_nonce_field( 'sc_jobs_sync_now' ); ?>
			<input type="hidden" name="action" value="sc_jobs_sync_now" />
			<button type="submit" class="button">Sync now</button>
		</form>
		<?php
		echo '</div>';
	}

	private static function render_sync_notice() {
		$notice = get_transient( 'sc_jobs_admin_notice_' . get_current_user_id() );
		if ( ! $notice ) {
			return;
		}
		delete_transient( 'sc_jobs_admin_notice_' . get_current_user_id() );
		$class = $notice['ok'] ? 'notice-success' : 'notice-error';
		printf( '<div class="notice %1$s"><p>%2$s</p></div>', esc_attr( $class ), esc_html( $notice['message'] ) );
	}

	public static function handle_save_settings() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		check_admin_referer( 'sc_jobs_save_settings' );

		update_option( SC_Jobs_Sync::OPTION_REED_API_KEY, sanitize_text_field( $_POST['reed_api_key'] ?? '' ) );
		update_option( SC_Jobs_Sync::OPTION_LOCATION_NAME, sanitize_text_field( $_POST['location_name'] ?? SC_Jobs_Sync::default_location_name() ) );
		update_option( SC_Jobs_Sync::OPTION_DISTANCE_MILES, absint( $_POST['distance_miles'] ?? SC_Jobs_Sync::default_distance_miles() ) );

		set_transient(
			'sc_jobs_admin_notice_' . get_current_user_id(),
			array( 'ok' => true, 'message' => 'Settings saved.' ),
			60
		);
		wp_safe_redirect( admin_url( 'edit.php?post_type=' . SC_Jobs_CPT::POST_TYPE . '&page=sc-jobs-sync' ) );
		exit;
	}

	public static function handle_sync_now() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		check_admin_referer( 'sc_jobs_sync_now' );

		$result = SC_Jobs_Sync::sync_reed();
		set_transient(
			'sc_jobs_admin_notice_' . get_current_user_id(),
			array( 'ok' => $result['ok'], 'message' => $result['message'] ),
			60
		);
		wp_safe_redirect( admin_url( 'edit.php?post_type=' . SC_Jobs_CPT::POST_TYPE . '&page=sc-jobs-sync' ) );
		exit;
	}
}
