<?php
/**
 * Plugin Name: Secret Carshalton — Site Refresh
 * Description: Tells the Next.js frontend to refresh its cached pages the moment content changes here (publish, update, unpublish, delete, approved comments, category/tag edits), instead of waiting out its hourly cache. Configure under Settings → Site refresh.
 * Version: 0.1.0
 * Author: Secret Carshalton
 * Text Domain: sc-revalidate
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Every page on the frontend caches what it fetched from WordPress for up
 * to an hour. This plugin calls the frontend's /api/revalidate route with
 * { all: true } whenever something that could appear on the site changes,
 * so edits show within seconds. One whole-site refresh per request, sent
 * non-blocking at shutdown — saving a post fires several hooks, and a bulk
 * edit fires them for every post, so they're collapsed into a single call.
 *
 * Settings (frontend URL + shared secret) live in wp_options, entered in
 * wp-admin — never in this file, which is version-controlled in git.
 */
class SC_Revalidate {

	const OPTION_URL    = 'sc_revalidate_frontend_url';
	const OPTION_SECRET = 'sc_revalidate_secret';

	/** Content the frontend actually renders. Anything else (revisions, menus, logs…) is ignored. */
	const POST_TYPES = array( 'post', 'page', 'sc_listing', 'sc_event', 'sc_ad', 'job_listing' );

	/** Set once anything relevant changes during this request; the actual call happens at shutdown. */
	private static $pending = false;

	public static function init() {
		add_action( 'transition_post_status', array( __CLASS__, 'on_post_status' ), 10, 3 );
		// Before, not after — once it's gone its status can't be checked.
		add_action( 'before_delete_post', array( __CLASS__, 'on_post_id' ) );
		add_action( 'added_post_meta', array( __CLASS__, 'on_post_meta' ), 10, 3 );
		add_action( 'updated_post_meta', array( __CLASS__, 'on_post_meta' ), 10, 3 );
		add_action( 'deleted_post_meta', array( __CLASS__, 'on_post_meta' ), 10, 3 );

		add_action( 'transition_comment_status', array( __CLASS__, 'on_comment_status' ), 10, 3 );
		add_action( 'comment_post', array( __CLASS__, 'on_comment_post' ), 10, 2 );
		add_action( 'edit_comment', array( __CLASS__, 'on_comment_edit' ) );

		add_action( 'created_term', array( __CLASS__, 'mark' ) );
		add_action( 'edited_term', array( __CLASS__, 'mark' ) );
		add_action( 'delete_term', array( __CLASS__, 'mark' ) );

		add_action( 'shutdown', array( __CLASS__, 'send' ) );

		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_settings' ) );
	}

	public static function mark() {
		self::$pending = true;
	}

	private static function is_watched_post( $post ) {
		$post = get_post( $post );
		return $post && in_array( $post->post_type, self::POST_TYPES, true );
	}

	/** Only changes to or from "publish" matter — saving a draft doesn't change the public site. */
	public static function on_post_status( $new_status, $old_status, $post ) {
		if ( ( 'publish' === $new_status || 'publish' === $old_status ) && self::is_watched_post( $post ) ) {
			self::mark();
		}
	}

	public static function on_post_id( $post_id ) {
		if ( self::is_watched_post( $post_id ) && 'publish' === get_post_status( $post_id ) ) {
			self::mark();
		}
	}

	/**
	 * Meta-only edits (a listing's address, gallery, an ad's dates…) don't
	 * always go through a post save. Skips WordPress's own internal keys
	 * (leading underscore: edit locks, review caches) and counters bumped
	 * on every page view or click — those would otherwise trigger a full
	 * site refresh on nearly every visit.
	 */
	public static function on_post_meta( $meta_id, $post_id, $meta_key ) {
		if ( '_' === substr( $meta_key, 0, 1 ) || preg_match( '/view|click|impression/i', $meta_key ) ) {
			return;
		}
		self::on_post_id( $post_id );
	}

	public static function on_comment_status( $new_status, $old_status, $comment ) {
		if ( 'approved' === $new_status || 'approved' === $old_status ) {
			self::mark();
		}
	}

	public static function on_comment_post( $comment_id, $approved ) {
		if ( 1 === (int) $approved ) {
			self::mark();
		}
	}

	public static function on_comment_edit( $comment_id ) {
		if ( 'approved' === wp_get_comment_status( $comment_id ) ) {
			self::mark();
		}
	}

	/** Fire-and-forget — never slows down or breaks a save in wp-admin, even if the frontend is down. */
	public static function send() {
		if ( ! self::$pending ) {
			return;
		}
		self::$pending = false;

		$url    = trim( (string) get_option( self::OPTION_URL, '' ) );
		$secret = (string) get_option( self::OPTION_SECRET, '' );
		if ( '' === $url ) {
			return;
		}

		wp_remote_post(
			untrailingslashit( $url ) . '/api/revalidate',
			array(
				'blocking' => false,
				'timeout'  => 3,
				'headers'  => array(
					'Content-Type'        => 'application/json',
					'x-revalidate-secret' => $secret,
				),
				'body'     => wp_json_encode( array( 'all' => true ) ),
			)
		);
	}

	public static function register_settings() {
		register_setting(
			'sc_revalidate',
			self::OPTION_URL,
			array(
				'type'              => 'string',
				'sanitize_callback' => 'esc_url_raw',
				'default'           => '',
				'show_in_rest'      => true,
			)
		);
		register_setting(
			'sc_revalidate',
			self::OPTION_SECRET,
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
				'show_in_rest'      => true,
			)
		);
	}

	public static function register_menu() {
		add_options_page( 'Site refresh', 'Site refresh', 'manage_options', 'sc-revalidate', array( __CLASS__, 'render' ) );
	}

	public static function render() {
		?>
		<div class="wrap">
			<h1>Site refresh</h1>
			<p>When you publish or update anything here, the website is told to refresh straight away instead of within the hour. Both fields must match the website's settings.</p>
			<form method="post" action="options.php">
				<?php settings_fields( 'sc_revalidate' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="<?php echo esc_attr( self::OPTION_URL ); ?>">Website address</label></th>
						<td><input type="url" class="regular-text" id="<?php echo esc_attr( self::OPTION_URL ); ?>" name="<?php echo esc_attr( self::OPTION_URL ); ?>" value="<?php echo esc_attr( get_option( self::OPTION_URL, '' ) ); ?>" placeholder="https://www.secretcarshalton.com" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="<?php echo esc_attr( self::OPTION_SECRET ); ?>">Secret key</label></th>
						<td><input type="password" class="regular-text" id="<?php echo esc_attr( self::OPTION_SECRET ); ?>" name="<?php echo esc_attr( self::OPTION_SECRET ); ?>" value="<?php echo esc_attr( get_option( self::OPTION_SECRET, '' ) ); ?>" autocomplete="off" /></td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}
}

SC_Revalidate::init();
