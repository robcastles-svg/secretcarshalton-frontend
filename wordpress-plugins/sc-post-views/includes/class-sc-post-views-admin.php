<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One-off import of each live post's existing Post Views Counter total,
 * so switching to our own counter doesn't reset every post back to zero.
 * Runs one page of the live site's own posts REST endpoint per click
 * (not all ~650 posts in one request) — SiteGround shared hosting has
 * dropped connections under its own concurrency limits before on long
 * WP-to-WP HTTP loops (see lib/wordpress.ts's fetchWithRetry docblock for
 * the frontend's side of that same lesson), and each post here needs its
 * own outbound request to the live site's Post Views Counter endpoint on
 * top of the page fetch itself.
 */
class SC_Post_Views_Admin {

	const LIVE_ROOT   = 'https://www.secretcarshalton.com/wp-json/wp/v2';
	const PAGE_OPTION = 'sc_post_views_backfill_page';
	const DONE_OPTION = 'sc_post_views_backfill_done';
	const PER_PAGE    = 20;

	public static function register_menu() {
		add_submenu_page(
			'index.php',
			'Post Views Backfill',
			'Post Views Backfill',
			'manage_options',
			'sc-post-views',
			array( __CLASS__, 'render' )
		);
	}

	public static function render() {
		$page = (int) get_option( self::PAGE_OPTION, 1 );
		$done = (bool) get_option( self::DONE_OPTION, false );

		echo '<div class="wrap"><h1>Post Views Backfill</h1>';
		echo '<p class="description">Imports each live post\'s current Post Views Counter total as this plugin\'s starting baseline, one page of ' . (int) self::PER_PAGE . ' posts at a time.</p>';

		$notice = get_transient( 'sc_post_views_backfill_notice' );
		if ( $notice ) {
			delete_transient( 'sc_post_views_backfill_notice' );
			echo '<div class="notice notice-success"><p>' . esc_html( $notice ) . '</p></div>';
		}

		if ( $done ) {
			echo '<p><strong>Backfill complete.</strong> Run the scan again only if new historical posts need importing.</p>';
		} else {
			echo '<p>Next batch: page ' . (int) $page . '.</p>';
		}

		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<?php wp_nonce_field( 'sc_post_views_backfill_batch' ); ?>
			<input type="hidden" name="action" value="sc_post_views_backfill_batch" />
			<button type="submit" class="button button-primary"><?php echo $done ? 'Re-run next batch' : 'Backfill next batch'; ?></button>
		</form>
		<?php
		echo '</div>';
	}

	public static function handle_backfill_batch() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		check_admin_referer( 'sc_post_views_backfill_batch' );

		$page = (int) get_option( self::PAGE_OPTION, 1 );

		$posts_res = wp_remote_get(
			self::LIVE_ROOT . '/posts?per_page=' . self::PER_PAGE . '&page=' . $page . '&_fields=id,slug,title',
			array( 'timeout' => 20 )
		);

		$imported = 0;
		$reached_end = false;

		if ( is_wp_error( $posts_res ) ) {
			set_transient( 'sc_post_views_backfill_notice', 'Fetch failed: ' . $posts_res->get_error_message(), 60 );
		} else {
			$status = wp_remote_retrieve_response_code( $posts_res );
			$posts  = json_decode( wp_remote_retrieve_body( $posts_res ), true );

			// The live site 400s past its last real page rather than
			// returning an empty array — either shape means "nothing left".
			if ( 400 === (int) $status || ! is_array( $posts ) || empty( $posts ) ) {
				$reached_end = true;
			} else {
				foreach ( $posts as $post ) {
					$post_id = isset( $post['id'] ) ? (int) $post['id'] : 0;
					$slug    = isset( $post['slug'] ) ? sanitize_title( $post['slug'] ) : '';
					$title   = isset( $post['title']['rendered'] ) ? wp_specialchars_decode( $post['title']['rendered'], ENT_QUOTES ) : '';
					if ( ! $post_id ) {
						continue;
					}

					$views = self::fetch_live_view_count( $post_id );
					self::upsert_baseline( $post_id, $slug, $title, $views );
					++$imported;
				}
				if ( count( $posts ) < self::PER_PAGE ) {
					$reached_end = true;
				}
			}
		}

		if ( $reached_end ) {
			update_option( self::DONE_OPTION, true );
			set_transient( 'sc_post_views_backfill_notice', "Backfill complete — imported page {$page} ({$imported} posts) and reached the end.", 60 );
		} else {
			update_option( self::PAGE_OPTION, $page + 1 );
			set_transient( 'sc_post_views_backfill_notice', "Imported page {$page} ({$imported} posts). Next: page " . ( $page + 1 ) . '.', 60 );
		}

		wp_safe_redirect( admin_url( 'index.php?page=sc-post-views' ) );
		exit;
	}

	private static function fetch_live_view_count( $post_id ) {
		$res = wp_remote_get(
			'https://www.secretcarshalton.com/wp-json/post-views-counter/get-post-views/' . $post_id,
			array( 'timeout' => 10 )
		);
		if ( is_wp_error( $res ) ) {
			return 0;
		}
		$count = (int) wp_remote_retrieve_body( $res );
		return max( 0, $count );
	}

	private static function upsert_baseline( $post_id, $slug, $title, $views ) {
		global $wpdb;
		$table = SC_Post_Views_DB::table();

		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (post_id, post_slug, post_title, view_date, views) " . // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				'VALUES (%d, %s, %s, %s, %d) ' .
				'ON DUPLICATE KEY UPDATE post_slug = VALUES(post_slug), post_title = VALUES(post_title), views = VALUES(views)',
				$post_id,
				$slug,
				$title,
				SC_Post_Views_DB::BASELINE_DATE,
				$views
			)
		);
	}
}
