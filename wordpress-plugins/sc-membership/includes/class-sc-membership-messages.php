<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Member messages: short notices Rob writes for the notification bell
 * ("You now have new features when adding an event…"), aimed at groups of
 * members worked out from what they've already done on the site — event
 * organisers, listing owners, advertisers and so on — rather than lists
 * anyone has to keep. Optionally emailed too.
 *
 * Written and edited from Rob's own dashboard on the Next.js site (the
 * /admin/messages screens), through the admin routes below; WordPress
 * only stores them. Each message is a private sc_member_message post:
 * title = headline, content = plain-text message, settings in post meta.
 * Who has seen / dismissed / clicked one is the sc_message_reads table.
 *
 * Email: individual emails, sent a batch at a time by WP-Cron so a big
 * send trickles out under SiteGround's hourly sending limit instead of
 * landing in spam folders. Every email carries a one-click unsubscribe
 * (link in the footer plus the List-Unsubscribe headers Gmail and
 * Outlook look for), says why the member is getting it, and ends with
 * the postal address from the messages settings. Unsubscribing only
 * stops these member emails — account emails (receipts, approvals)
 * carry on, and the messages still show in the bell.
 */
class SC_Membership_Messages {

	const POST_TYPE  = 'sc_member_message';
	const CRON_HOOK  = 'sc_membership_messages_tick';
	const BATCH_SIZE = 40;
	/** Minutes between batches: 40 every 4 minutes is 600 an hour at most. */
	const BATCH_GAP = 4;

	const OPTION_POSTAL = 'sc_membership_postal_address';

	/** Audience key => label shown on the edit screen, in display order. */
	const AUDIENCES = array(
		'all'              => 'All members',
		'event_organisers' => 'Event organisers',
		'listing_owners'   => 'Listing owners',
		'premium_listings' => 'Premium listings',
		'advertisers'      => 'Advertisers',
		'job_posters'      => 'Job posters',
		'community_groups' => 'Community groups',
	);

	/** Why a member got the email — the most specific audience they're in wins (order matters). */
	const REASONS = array(
		'premium_listings' => 'you have a premium listing in the Secret Carshalton directory',
		'advertisers'      => 'you advertise on Secret Carshalton',
		'event_organisers' => 'you\'ve added an event on Secret Carshalton',
		'listing_owners'   => 'you have a listing in the Secret Carshalton directory',
		'community_groups' => 'you\'ve listed a community group on Secret Carshalton',
		'job_posters'      => 'you\'ve posted a job on Secret Carshalton',
		'all'              => 'you\'re a Secret Carshalton member',
	);

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_post_type' ) );
		add_action( self::CRON_HOOK, array( __CLASS__, 'tick' ) );
		add_action( self::CRON_HOOK . '_batch', array( __CLASS__, 'send_batch' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time() + 300, 'hourly', self::CRON_HOOK );
		}
	}

	public static function register_post_type() {
		register_post_type(
			self::POST_TYPE,
			array(
				'labels'       => array(
					'name'          => 'Member messages',
					'singular_name' => 'Member message',
				),
				'public'       => false,
				// Listed under Membership in wp-admin as a read-only
				// fallback; the real editing screen is on the site.
				'show_ui'      => true,
				'show_in_menu' => 'sc-membership',
				'show_in_rest' => false,
				'supports'     => array( 'title', 'editor' ),
			)
		);
	}

	public static function reads_table() {
		global $wpdb;
		return $wpdb->prefix . 'sc_message_reads';
	}

	/** Called from SC_Membership_DB::install(). */
	public static function install_sql( $charset_collate ) {
		$table = self::reads_table();
		return "CREATE TABLE {$table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			message_id BIGINT UNSIGNED NOT NULL,
			user_id BIGINT UNSIGNED NOT NULL,
			seen_at DATETIME DEFAULT NULL,
			dismissed_at DATETIME DEFAULT NULL,
			clicked_at DATETIME DEFAULT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY message_user (message_id, user_id),
			KEY user_id (user_id)
		) {$charset_collate};";
	}

	/* ------------------------------------------------------------------
	 * Audiences
	 * ---------------------------------------------------------------- */

	/**
	 * Member ids in one audience. Ownership is post_author everywhere in
	 * these plugins (see each one's /mine route), so an audience is the
	 * distinct authors of the right kind of post. Cached for ten minutes:
	 * the bell asks on every page view, and a new organiser appearing a
	 * few minutes late doesn't matter.
	 */
	public static function audience_members( $key ) {
		static $memo = array();
		if ( isset( $memo[ $key ] ) ) {
			return $memo[ $key ];
		}
		// Versioned, so a plugin update never serves a count from the old code.
		$cache_key = 'sc_msg_aud_' . SC_MEMBERSHIP_VERSION . '_' . $key;
		$ids       = get_transient( $cache_key );
		if ( ! is_array( $ids ) ) {
			$ids = self::query_audience( $key );
			set_transient( $cache_key, $ids, 10 * MINUTE_IN_SECONDS );
		}
		$memo[ $key ] = $ids;
		return $ids;
	}

	private static function query_audience( $key ) {
		global $wpdb;
		$live = "p.post_status IN ('publish','pending','draft','future')";
		$groups_join = "INNER JOIN {$wpdb->term_relationships} tr ON tr.object_id = p.ID
			INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'sc_listing_category'
			INNER JOIN {$wpdb->terms} t ON t.term_id = tt.term_id AND t.slug = 'groups-to-join'";

		switch ( $key ) {
			case 'all':
				// Accounts with a role on this site (about 600) — wp_users
				// also holds ~3,500 role-less leftovers from the old site.
				$ids = get_users(
					array(
						'fields'   => 'ID',
						'role__in' => array_keys( wp_roles()->roles ),
					)
				);
				break;
			case 'event_organisers':
				$ids = $wpdb->get_col( "SELECT DISTINCT p.post_author FROM {$wpdb->posts} p WHERE p.post_type = 'sc_event' AND {$live}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				break;
			case 'listing_owners':
				$ids = $wpdb->get_col(
					"SELECT DISTINCT p.post_author FROM {$wpdb->posts} p WHERE p.post_type = 'sc_listing' AND {$live}
					AND p.ID NOT IN (SELECT p2.ID FROM {$wpdb->posts} p2 " . str_replace( 'p.ID', 'p2.ID', $groups_join ) . ')' // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				);
				break;
			case 'community_groups':
				$ids = $wpdb->get_col( "SELECT DISTINCT p.post_author FROM {$wpdb->posts} p {$groups_join} WHERE p.post_type = 'sc_listing' AND {$live}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				break;
			case 'premium_listings':
				$ids = $wpdb->get_col(
					"SELECT DISTINCT p.post_author FROM {$wpdb->posts} p
					INNER JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = 'sc_featured' AND m.meta_value NOT IN ('', '0')
					WHERE p.post_type = 'sc_listing' AND p.post_status = 'publish'" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				);
				break;
			case 'advertisers':
				$ids = $wpdb->get_col( "SELECT DISTINCT p.post_author FROM {$wpdb->posts} p WHERE p.post_type = 'sc_ad' AND {$live}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				break;
			case 'job_posters':
				// Member-posted jobs only — the Reed feed's jobs belong to the admin account.
				$ids = $wpdb->get_col(
					"SELECT DISTINCT p.post_author FROM {$wpdb->posts} p
					INNER JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = 'source' AND m.meta_value = 'member'
					WHERE p.post_type = 'job_listing' AND {$live}" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				);
				break;
			default:
				$ids = array();
		}

		$ids = array_values( array_unique( array_filter( array_map( 'intval', (array) $ids ) ) ) );
		return array_values(
			array_filter(
				$ids,
				function ( $id ) {
					return ! SC_Membership_REST::is_banned( $id ) && ! SC_Membership_DB::is_pending_review( $id );
				}
			)
		);
	}

	/** Every member in any of these audiences. */
	public static function members_for( array $audiences ) {
		$ids = array();
		foreach ( $audiences as $key ) {
			if ( isset( self::AUDIENCES[ $key ] ) ) {
				$ids = array_merge( $ids, self::audience_members( $key ) );
			}
		}
		return array_values( array_unique( $ids ) );
	}

	public static function user_in( $user_id, array $audiences ) {
		foreach ( $audiences as $key ) {
			if ( 'all' === $key || in_array( (int) $user_id, self::audience_members( $key ), true ) ) {
				return true;
			}
		}
		return false;
	}

	/* ------------------------------------------------------------------
	 * Messages
	 * ---------------------------------------------------------------- */

	private static function today() {
		return wp_date( 'Y-m-d' );
	}

	public static function get_audiences( $message_id ) {
		$raw = get_post_meta( $message_id, 'sc_msg_audiences', true );
		return array_values( array_intersect( (array) $raw, array_keys( self::AUDIENCES ) ) );
	}

	/** Live today: published, started, not yet ended. */
	public static function is_showing( $post ) {
		if ( 'publish' !== $post->post_status ) {
			return false;
		}
		$today = self::today();
		$start = (string) get_post_meta( $post->ID, 'sc_msg_start', true );
		$end   = (string) get_post_meta( $post->ID, 'sc_msg_end', true );
		return ( '' === $start || $start <= $today ) && ( '' === $end || $end >= $today );
	}

	/** A relative "/events/submit" goes to the site, a full https:// link as is. */
	public static function button_href( $url ) {
		$url = trim( (string) $url );
		if ( '' === $url ) {
			return '';
		}
		if ( '/' === $url[0] ) {
			return SC_Membership_Auth::FRONTEND_URL . $url;
		}
		return $url;
	}

	public static function shape( $post, $with_admin = false ) {
		$data = array(
			'id'          => $post->ID,
			'title'       => wp_specialchars_decode( get_the_title( $post ), ENT_QUOTES ),
			'body'        => (string) $post->post_content,
			'button_text' => (string) get_post_meta( $post->ID, 'sc_msg_button_text', true ),
			'button_url'  => (string) get_post_meta( $post->ID, 'sc_msg_button_url', true ),
			'pinned'      => '1' === get_post_meta( $post->ID, 'sc_msg_pinned', true ),
			'dismissible' => '0' !== get_post_meta( $post->ID, 'sc_msg_dismissible', true ),
			'start'       => (string) get_post_meta( $post->ID, 'sc_msg_start', true ),
			'end'         => (string) get_post_meta( $post->ID, 'sc_msg_end', true ),
			'date'        => get_post_time( 'c', true, $post ),
		);
		if ( $with_admin ) {
			$data += self::admin_fields( $post );
		}
		return $data;
	}

	private static function admin_fields( $post ) {
		global $wpdb;
		$table     = self::reads_table();
		$counts    = $wpdb->get_row( $wpdb->prepare( "SELECT SUM(seen_at IS NOT NULL) seen, SUM(dismissed_at IS NOT NULL) dismissed, SUM(clicked_at IS NOT NULL) clicked FROM {$table} WHERE message_id = %d", $post->ID ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$audiences = self::get_audiences( $post->ID );
		$today     = self::today();
		$start     = (string) get_post_meta( $post->ID, 'sc_msg_start', true );
		$end       = (string) get_post_meta( $post->ID, 'sc_msg_end', true );
		if ( 'publish' !== $post->post_status ) {
			$state = 'draft';
		} elseif ( '' !== $end && $end < $today ) {
			$state = 'ended';
		} elseif ( '' !== $start && $start > $today ) {
			$state = 'scheduled';
		} else {
			$state = 'live';
		}
		return array(
			'status'        => $post->post_status,
			'state'         => $state,
			'audiences'     => $audiences,
			'reach'         => count( self::members_for( $audiences ) ),
			'seen'          => (int) ( $counts->seen ?? 0 ),
			'dismissed'     => (int) ( $counts->dismissed ?? 0 ),
			'clicked'       => (int) ( $counts->clicked ?? 0 ),
			'email'         => '1' === get_post_meta( $post->ID, 'sc_msg_email', true ),
			'email_subject' => (string) get_post_meta( $post->ID, 'sc_msg_email_subject', true ),
			'email_status'  => (string) get_post_meta( $post->ID, 'sc_msg_email_status', true ),
			'email_total'   => (int) get_post_meta( $post->ID, 'sc_msg_email_total', true ),
			'email_sent'    => (int) get_post_meta( $post->ID, 'sc_msg_email_sent', true ),
			'email_failed'  => (int) get_post_meta( $post->ID, 'sc_msg_email_failed', true ),
			'modified'      => get_post_modified_time( 'c', true, $post ),
		);
	}

	/** The showing messages this member should see, newest first, without the ones they dismissed. */
	public static function for_user( $user_id ) {
		$posts = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => 'publish',
				'posts_per_page' => 50,
				'orderby'        => 'date',
				'order'          => 'DESC',
			)
		);
		if ( empty( $posts ) ) {
			return array();
		}

		global $wpdb;
		$table = self::reads_table();
		$reads = array();
		foreach ( $wpdb->get_results( $wpdb->prepare( "SELECT message_id, seen_at, dismissed_at FROM {$table} WHERE user_id = %d", $user_id ) ) as $row ) { // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$reads[ (int) $row->message_id ] = $row;
		}

		$out = array();
		foreach ( $posts as $post ) {
			if ( ! self::is_showing( $post ) || ! self::user_in( $user_id, self::get_audiences( $post->ID ) ) ) {
				continue;
			}
			$read = $reads[ $post->ID ] ?? null;
			if ( $read && $read->dismissed_at ) {
				continue;
			}
			$item         = self::shape( $post );
			$item['seen'] = (bool) ( $read && $read->seen_at );
			$out[]        = $item;
		}
		return $out;
	}

	private static function mark( $user_id, $message_id, $column ) {
		global $wpdb;
		$table = self::reads_table();
		$now   = current_time( 'mysql' );
		// One row per member per message; only the first time counts.
		$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"INSERT INTO {$table} (message_id, user_id, {$column}) VALUES (%d, %d, %s)
				ON DUPLICATE KEY UPDATE {$column} = COALESCE({$column}, VALUES({$column}))", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$message_id,
				$user_id,
				$now
			)
		);
	}

	/* ------------------------------------------------------------------
	 * Email
	 * ---------------------------------------------------------------- */

	public static function emails_off( $user_id ) {
		return '1' === get_user_meta( $user_id, 'sc_member_emails_off', true );
	}

	/** Records the change with its time — the "when did they unsubscribe" record GDPR asks for. */
	public static function set_emails( $user_id, $on, $how ) {
		$now = current_time( 'mysql' );
		if ( $on ) {
			delete_user_meta( $user_id, 'sc_member_emails_off' );
		} else {
			update_user_meta( $user_id, 'sc_member_emails_off', '1' );
		}
		$log   = (array) get_user_meta( $user_id, 'sc_member_emails_log', true );
		$log[] = array(
			'at'  => $now,
			'on'  => (bool) $on,
			'how' => $how,
		);
		update_user_meta( $user_id, 'sc_member_emails_log', array_slice( array_filter( $log ), -20 ) );
	}

	public static function unsubscribe_token( $user_id ) {
		return substr( hash_hmac( 'sha256', 'sc-unsub|' . (int) $user_id, wp_salt( 'auth' ) ), 0, 32 );
	}

	private static function valid_token( $user_id, $token ) {
		return $user_id > 0 && is_string( $token ) && hash_equals( self::unsubscribe_token( $user_id ), $token );
	}

	public static function settings_url( $user_id ) {
		return SC_Membership_Auth::FRONTEND_URL . '/email-settings?u=' . (int) $user_id . '&t=' . self::unsubscribe_token( $user_id );
	}

	private static function reason_for( $user_id, array $audiences ) {
		foreach ( self::REASONS as $key => $reason ) {
			if ( in_array( $key, $audiences, true ) && self::user_in( $user_id, array( $key ) ) ) {
				return $reason;
			}
		}
		return self::REASONS['all'];
	}

	private static function first_reason( array $audiences ) {
		foreach ( self::REASONS as $key => $reason ) {
			if ( in_array( $key, $audiences, true ) ) {
				return $reason;
			}
		}
		return self::REASONS['all'];
	}

	/** A saved message as the plain array render_email()/send_to() work from. */
	public static function email_fields( $post ) {
		return array(
			'title'         => wp_specialchars_decode( get_the_title( $post ), ENT_QUOTES ),
			'body'          => (string) $post->post_content,
			'button_text'   => (string) get_post_meta( $post->ID, 'sc_msg_button_text', true ),
			'button_url'    => (string) get_post_meta( $post->ID, 'sc_msg_button_url', true ),
			'audiences'     => self::get_audiences( $post->ID ),
			'email_subject' => (string) get_post_meta( $post->ID, 'sc_msg_email_subject', true ),
		);
	}

	/** The email's HTML and plain-text bodies for one member. */
	public static function render_email( array $msg, $user, $as_preview = false ) {
		$title    = (string) $msg['title'];
		$body     = (string) $msg['body'];
		$btn_text = (string) $msg['button_text'];
		$btn_href = self::button_href( $msg['button_url'] );
		$name     = wp_specialchars_decode( (string) $user->display_name, ENT_QUOTES );
		// A test send shows the line the first ticked group would see, as the edit screen's preview does.
		$reason   = $as_preview ? self::first_reason( (array) $msg['audiences'] ) : self::reason_for( $user->ID, (array) $msg['audiences'] );
		$settings = self::settings_url( $user->ID );
		$postal   = trim( (string) get_option( self::OPTION_POSTAL, '' ) );
		$site     = SC_Membership_Auth::FRONTEND_URL;

		$pink = '#cc99a2';
		$red  = '#d6293e';
		$para = 'margin:0 0 14px;font-size:15px;line-height:1.55;color:#3b414c;';

		$body_html = wpautop( make_clickable( esc_html( $body ) ) );
		$body_html = str_replace( '<p>', '<p style="' . $para . '">', $body_html );

		$button = '';
		if ( $btn_text && $btn_href ) {
			$button = '<p style="margin:6px 0 18px;"><a href="' . esc_url( $btn_href ) . '" style="display:inline-block;background:' . $red . ';color:#ffffff;text-decoration:none;border-radius:999px;padding:11px 24px;font-weight:600;font-size:15px;">' . esc_html( $btn_text ) . ' &rarr;</a></p>';
		}

		$footer_address = $postal ? '<br>' . esc_html( 'Secret Carshalton · ' . $postal ) : '<br>Secret Carshalton';

		$html = '<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;">'
			. '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 12px;"><tr><td align="center">'
			. '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Roboto,Helvetica,Arial,sans-serif;color:#14171c;">'
			. '<tr><td style="background:' . $pink . ';padding:16px 24px;"><a href="' . esc_url( $site ) . '" style="color:#ffffff;text-decoration:none;font-weight:700;font-size:19px;">Secret Carshalton</a></td></tr>'
			. '<tr><td style="padding:24px 24px 8px;">'
			. '<p style="' . $para . '">Hi ' . esc_html( $name ) . ',</p>'
			. '<h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#14171c;">' . esc_html( $title ) . '</h1>'
			. $body_html
			. $button
			. '<p style="' . $para . '">Rob, Secret Carshalton</p>'
			. '</td></tr>'
			. '<tr><td style="background:#f6f7f9;padding:16px 24px;font-size:12px;line-height:1.6;color:#3b414c;">'
			. 'You\'re getting this because ' . esc_html( $reason ) . '.<br>'
			. '<a href="' . esc_url( $settings ) . '" style="color:#8a4f5b;">Unsubscribe from member emails</a> · <a href="' . esc_url( $settings ) . '" style="color:#8a4f5b;">Email settings</a>'
			. $footer_address
			. '</td></tr></table></td></tr></table></body></html>';

		$text = "Hi {$name},\n\n{$title}\n\n{$body}\n\n"
			. ( $btn_text && $btn_href ? "{$btn_text}: {$btn_href}\n\n" : '' )
			. "Rob, Secret Carshalton\n\n--\nYou're getting this because {$reason}.\nUnsubscribe or change email settings: {$settings}\n"
			. ( $postal ? "Secret Carshalton · {$postal}\n" : '' );

		return array(
			'html' => $html,
			'text' => $text,
		);
	}

	/** Sends one member their copy. True if wp_mail accepted it. */
	public static function send_to( array $msg, $user, $subject_prefix = '' ) {
		if ( ! $user || ! is_email( $user->user_email ) ) {
			return false;
		}
		$rendered = self::render_email( $msg, $user, '' !== $subject_prefix );
		$subject  = '' !== (string) $msg['email_subject'] ? (string) $msg['email_subject'] : (string) $msg['title'];
		$one_click = add_query_arg(
			array(
				'u' => $user->ID,
				't' => self::unsubscribe_token( $user->ID ),
			),
			rest_url( 'sc-membership/v1/email-unsubscribe' )
		);
		$headers = array(
			'Content-Type: text/html; charset=UTF-8',
			'List-Unsubscribe: <' . $one_click . '>',
			'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
		);

		$alt = function ( $phpmailer ) use ( $rendered ) {
			$phpmailer->AltBody = $rendered['text']; // phpcs:ignore WordPress.NamingConventions.ValidVariableName
		};
		$from_name = function () {
			return 'Secret Carshalton';
		};
		add_action( 'phpmailer_init', $alt );
		add_filter( 'wp_mail_from_name', $from_name );
		$ok = wp_mail( $user->user_email, $subject_prefix . $subject, $rendered['html'], $headers );
		remove_action( 'phpmailer_init', $alt );
		remove_filter( 'wp_mail_from_name', $from_name );
		return (bool) $ok;
	}

	/** Starts the email send for a message, once, when it's published, showing and email is ticked. */
	public static function maybe_queue( $post ) {
		if ( '1' !== get_post_meta( $post->ID, 'sc_msg_email', true ) || '' !== (string) get_post_meta( $post->ID, 'sc_msg_email_status', true ) ) {
			return;
		}
		if ( ! self::is_showing( $post ) ) {
			return;
		}
		$recipients = array_values(
			array_filter(
				self::members_for( self::get_audiences( $post->ID ) ),
				function ( $id ) {
					return ! self::emails_off( $id );
				}
			)
		);
		update_post_meta( $post->ID, 'sc_msg_email_queue', $recipients );
		update_post_meta( $post->ID, 'sc_msg_email_total', count( $recipients ) );
		update_post_meta( $post->ID, 'sc_msg_email_sent', 0 );
		update_post_meta( $post->ID, 'sc_msg_email_failed', 0 );
		update_post_meta( $post->ID, 'sc_msg_email_status', $recipients ? 'sending' : 'done' );
		if ( $recipients && ! wp_next_scheduled( self::CRON_HOOK . '_batch' ) ) {
			wp_schedule_single_event( time() + 30, self::CRON_HOOK . '_batch' );
		}
	}

	/** Hourly: start any scheduled message whose day has come, and keep sends moving. */
	public static function tick() {
		$posts = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => 'publish',
				'posts_per_page' => 50,
				'meta_key'       => 'sc_msg_email', // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_value'     => '1', // phpcs:ignore WordPress.DB.SlowDBQuery
			)
		);
		foreach ( $posts as $post ) {
			self::maybe_queue( $post );
		}
		self::send_batch();
	}

	/** Sends the next batch of whichever message is mid-send, then books the next batch. */
	public static function send_batch() {
		$posts = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => 'publish',
				'posts_per_page' => 1,
				'orderby'        => 'date',
				'order'          => 'ASC',
				'meta_key'       => 'sc_msg_email_status', // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_value'     => 'sending', // phpcs:ignore WordPress.DB.SlowDBQuery
			)
		);
		if ( empty( $posts ) ) {
			return;
		}
		$post  = $posts[0];
		$queue = array_values( (array) get_post_meta( $post->ID, 'sc_msg_email_queue', true ) );
		$batch = array_splice( $queue, 0, self::BATCH_SIZE );
		// Save the shorter queue first, so a crash mid-batch can't send twice.
		update_post_meta( $post->ID, 'sc_msg_email_queue', $queue );

		$msg    = self::email_fields( $post );
		$sent   = (int) get_post_meta( $post->ID, 'sc_msg_email_sent', true );
		$failed = (int) get_post_meta( $post->ID, 'sc_msg_email_failed', true );
		foreach ( $batch as $user_id ) {
			// Unsubscribed since the send started: skip quietly.
			if ( self::emails_off( (int) $user_id ) ) {
				continue;
			}
			if ( self::send_to( $msg, get_userdata( (int) $user_id ) ) ) {
				++$sent;
			} else {
				++$failed;
			}
		}
		update_post_meta( $post->ID, 'sc_msg_email_sent', $sent );
		update_post_meta( $post->ID, 'sc_msg_email_failed', $failed );

		if ( empty( $queue ) ) {
			update_post_meta( $post->ID, 'sc_msg_email_status', 'done' );
		}
		// Another message, or more of this one, still to go.
		wp_schedule_single_event( time() + self::BATCH_GAP * MINUTE_IN_SECONDS, self::CRON_HOOK . '_batch' );
	}

	/* ------------------------------------------------------------------
	 * REST
	 * ---------------------------------------------------------------- */

	public static function register_routes() {
		$ns     = 'sc-membership/v1';
		$member = function () {
			return is_user_logged_in();
		};
		$editor = function () {
			return current_user_can( 'edit_others_posts' );
		};

		register_rest_route( $ns, '/notifications', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'rest_notifications' ), 'permission_callback' => $member ) );
		register_rest_route( $ns, '/notifications/seen', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'rest_seen' ), 'permission_callback' => $member ) );
		register_rest_route( $ns, '/notifications/(?P<id>\d+)/dismiss', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'rest_dismiss' ), 'permission_callback' => $member ) );
		register_rest_route( $ns, '/notifications/(?P<id>\d+)/click', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'rest_click' ), 'permission_callback' => $member ) );

		register_rest_route(
			$ns,
			'/email-preferences',
			array(
				array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'rest_get_prefs' ), 'permission_callback' => $member ),
				array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'rest_set_prefs' ), 'permission_callback' => $member ),
			)
		);
		// Public, proven by the signed u/t pair in every email. POST with no
		// "subscribe" param is the one-click unsubscribe mail apps send.
		register_rest_route(
			$ns,
			'/email-unsubscribe',
			array(
				array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'rest_token_status' ), 'permission_callback' => '__return_true' ),
				array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'rest_token_set' ), 'permission_callback' => '__return_true' ),
			)
		);

		register_rest_route(
			$ns,
			'/messages',
			array(
				array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'rest_list' ), 'permission_callback' => $editor ),
				array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'rest_save' ), 'permission_callback' => $editor ),
			)
		);
		register_rest_route(
			$ns,
			'/messages/(?P<id>\d+)',
			array(
				array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'rest_get' ), 'permission_callback' => $editor ),
				array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'rest_save' ), 'permission_callback' => $editor ),
			)
		);
		register_rest_route( $ns, '/messages/(?P<id>\d+)/end', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'rest_end' ), 'permission_callback' => $editor ) );
		register_rest_route( $ns, '/messages/test-email', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'rest_test_email' ), 'permission_callback' => $editor ) );
		register_rest_route( $ns, '/messages/reach', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'rest_reach' ), 'permission_callback' => $editor ) );
		register_rest_route(
			$ns,
			'/messages/settings',
			array(
				array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'rest_get_settings' ), 'permission_callback' => $editor ),
				array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'rest_set_settings' ), 'permission_callback' => $editor ),
			)
		);
	}

	public static function rest_notifications() {
		$messages = self::for_user( get_current_user_id() );
		$unread   = count(
			array_filter(
				$messages,
				function ( $m ) {
					return ! $m['seen'];
				}
			)
		);
		return array(
			'unread'   => $unread,
			'messages' => $messages,
		);
	}

	public static function rest_seen( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		$ids     = array_filter( array_map( 'intval', (array) $request->get_param( 'ids' ) ) );
		$visible = wp_list_pluck( self::for_user( $user_id ), 'id' );
		foreach ( array_intersect( $ids, $visible ) as $id ) {
			self::mark( $user_id, $id, 'seen_at' );
		}
		return array( 'ok' => true );
	}

	public static function rest_dismiss( WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$post = get_post( $id );
		if ( ! $post || self::POST_TYPE !== $post->post_type ) {
			return new WP_Error( 'not_found', 'Message not found.', array( 'status' => 404 ) );
		}
		if ( '0' === get_post_meta( $id, 'sc_msg_dismissible', true ) ) {
			return new WP_Error( 'not_dismissible', 'This message can\'t be dismissed.', array( 'status' => 400 ) );
		}
		self::mark( get_current_user_id(), $id, 'seen_at' );
		self::mark( get_current_user_id(), $id, 'dismissed_at' );
		return array( 'ok' => true );
	}

	public static function rest_click( WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$post = get_post( $id );
		if ( $post && self::POST_TYPE === $post->post_type ) {
			self::mark( get_current_user_id(), $id, 'clicked_at' );
		}
		return array( 'ok' => true );
	}

	public static function rest_get_prefs() {
		return array( 'member_emails' => ! self::emails_off( get_current_user_id() ) );
	}

	public static function rest_set_prefs( WP_REST_Request $request ) {
		$on = rest_sanitize_boolean( $request->get_param( 'member_emails' ) );
		self::set_emails( get_current_user_id(), $on, 'dashboard' );
		return array( 'member_emails' => $on );
	}

	/** "r•••@gmail.com" — enough for someone to recognise their own address on the email-settings page, not enough to harvest. */
	private static function email_hint( $email ) {
		$parts = explode( '@', (string) $email );
		if ( 2 !== count( $parts ) ) {
			return '';
		}
		return substr( $parts[0], 0, 1 ) . '•••@' . $parts[1];
	}

	public static function rest_token_status( WP_REST_Request $request ) {
		$user_id = (int) $request->get_param( 'u' );
		if ( ! self::valid_token( $user_id, $request->get_param( 't' ) ) || ! get_userdata( $user_id ) ) {
			return new WP_Error( 'invalid_link', 'This link isn\'t valid.', array( 'status' => 403 ) );
		}
		return array(
			'member_emails' => ! self::emails_off( $user_id ),
			'email_hint'    => self::email_hint( get_userdata( $user_id )->user_email ),
		);
	}

	public static function rest_token_set( WP_REST_Request $request ) {
		$user_id = (int) $request->get_param( 'u' );
		if ( ! self::valid_token( $user_id, $request->get_param( 't' ) ) || ! get_userdata( $user_id ) ) {
			return new WP_Error( 'invalid_link', 'This link isn\'t valid.', array( 'status' => 403 ) );
		}
		$subscribe = $request->get_param( 'subscribe' );
		$on        = null !== $subscribe && rest_sanitize_boolean( $subscribe );
		self::set_emails( $user_id, $on, null === $subscribe ? 'one-click' : 'email-link' );
		return array( 'member_emails' => $on );
	}

	public static function rest_list() {
		$posts = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => array( 'publish', 'draft' ),
				'posts_per_page' => 100,
				'orderby'        => 'date',
				'order'          => 'DESC',
			)
		);
		return array_map(
			function ( $post ) {
				return self::shape( $post, true );
			},
			$posts
		);
	}

	public static function rest_get( WP_REST_Request $request ) {
		$post = get_post( (int) $request['id'] );
		if ( ! $post || self::POST_TYPE !== $post->post_type ) {
			return new WP_Error( 'not_found', 'Message not found.', array( 'status' => 404 ) );
		}
		return self::shape( $post, true );
	}

	private static function clean_date( $value ) {
		$value = (string) $value;
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : '';
	}

	private static function clean_link( $value ) {
		$value = trim( (string) $value );
		if ( '' === $value ) {
			return '';
		}
		if ( '/' === $value[0] && '/' !== ( $value[1] ?? '' ) ) {
			return '/' . ltrim( sanitize_text_field( $value ), '/' );
		}
		return esc_url_raw( $value, array( 'http', 'https', 'mailto' ) );
	}

	public static function rest_save( WP_REST_Request $request ) {
		$id = (int) $request['id'];
		if ( $id ) {
			$existing = get_post( $id );
			if ( ! $existing || self::POST_TYPE !== $existing->post_type ) {
				return new WP_Error( 'not_found', 'Message not found.', array( 'status' => 404 ) );
			}
		}

		$title = sanitize_text_field( (string) $request->get_param( 'title' ) );
		if ( '' === $title ) {
			return new WP_Error( 'missing_title', 'Give the message a title.', array( 'status' => 400 ) );
		}
		$audiences = array_values( array_intersect( (array) $request->get_param( 'audiences' ), array_keys( self::AUDIENCES ) ) );
		if ( empty( $audiences ) ) {
			return new WP_Error( 'missing_audience', 'Tick at least one group under "Who sees it".', array( 'status' => 400 ) );
		}
		$status = 'publish' === $request->get_param( 'status' ) ? 'publish' : 'draft';

		$postarr = array(
			'post_type'    => self::POST_TYPE,
			'post_title'   => $title,
			'post_content' => sanitize_textarea_field( (string) $request->get_param( 'body' ) ),
			'post_status'  => $status,
		);
		if ( $id ) {
			$postarr['ID'] = $id;
			$result        = wp_update_post( $postarr, true );
		} else {
			$result = wp_insert_post( $postarr, true );
		}
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$id = (int) $result;

		$start = self::clean_date( $request->get_param( 'start' ) );
		update_post_meta( $id, 'sc_msg_audiences', $audiences );
		update_post_meta( $id, 'sc_msg_button_text', sanitize_text_field( (string) $request->get_param( 'button_text' ) ) );
		update_post_meta( $id, 'sc_msg_button_url', self::clean_link( $request->get_param( 'button_url' ) ) );
		update_post_meta( $id, 'sc_msg_start', '' !== $start ? $start : self::today() );
		update_post_meta( $id, 'sc_msg_end', self::clean_date( $request->get_param( 'end' ) ) );
		update_post_meta( $id, 'sc_msg_pinned', rest_sanitize_boolean( $request->get_param( 'pinned' ) ) ? '1' : '0' );
		$dismissible = $request->get_param( 'dismissible' );
		update_post_meta( $id, 'sc_msg_dismissible', null === $dismissible || rest_sanitize_boolean( $dismissible ) ? '1' : '0' );
		update_post_meta( $id, 'sc_msg_email', rest_sanitize_boolean( $request->get_param( 'email' ) ) ? '1' : '0' );
		update_post_meta( $id, 'sc_msg_email_subject', sanitize_text_field( (string) $request->get_param( 'email_subject' ) ) );

		self::maybe_queue( get_post( $id ) );
		return self::shape( get_post( $id ), true );
	}

	public static function rest_end( WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$post = get_post( $id );
		if ( ! $post || self::POST_TYPE !== $post->post_type ) {
			return new WP_Error( 'not_found', 'Message not found.', array( 'status' => 404 ) );
		}
		update_post_meta( $id, 'sc_msg_end', wp_date( 'Y-m-d', time() - DAY_IN_SECONDS ) );
		// Stop any send still going out.
		if ( 'sending' === get_post_meta( $id, 'sc_msg_email_status', true ) ) {
			update_post_meta( $id, 'sc_msg_email_queue', array() );
			update_post_meta( $id, 'sc_msg_email_status', 'stopped' );
		}
		return self::shape( get_post( $id ), true );
	}

	/**
	 * Sends Rob (whoever is logged in) the email as members will get it,
	 * built from the edit screen's fields as they stand — nothing is
	 * saved, so testing a live message can never start the real send.
	 */
	public static function rest_test_email( WP_REST_Request $request ) {
		$title = sanitize_text_field( (string) $request->get_param( 'title' ) );
		if ( '' === $title ) {
			return new WP_Error( 'missing_title', 'Give the message a title first.', array( 'status' => 400 ) );
		}
		$msg  = array(
			'title'         => $title,
			'body'          => sanitize_textarea_field( (string) $request->get_param( 'body' ) ),
			'button_text'   => sanitize_text_field( (string) $request->get_param( 'button_text' ) ),
			'button_url'    => self::clean_link( $request->get_param( 'button_url' ) ),
			'audiences'     => array_values( array_intersect( (array) $request->get_param( 'audiences' ), array_keys( self::AUDIENCES ) ) ),
			'email_subject' => sanitize_text_field( (string) $request->get_param( 'email_subject' ) ),
		);
		$user = wp_get_current_user();
		if ( ! self::send_to( $msg, $user, '[Test] ' ) ) {
			return new WP_Error( 'send_failed', 'The test email couldn\'t be sent.', array( 'status' => 500 ) );
		}
		return array(
			'sent_to' => self::email_hint( $user->user_email ),
			'at'      => wp_date( 'H:i' ),
		);
	}

	public static function rest_reach( WP_REST_Request $request ) {
		$audiences = array_values( array_intersect( explode( ',', (string) $request->get_param( 'audiences' ) ), array_keys( self::AUDIENCES ) ) );
		$members   = self::members_for( $audiences );
		$off       = count(
			array_filter(
				$members,
				function ( $id ) {
					return self::emails_off( $id );
				}
			)
		);
		return array(
			'members'     => count( $members ),
			'emailable'   => count( $members ) - $off,
			'unsubscribed' => $off,
		);
	}

	public static function rest_get_settings() {
		return array(
			'postal_address' => (string) get_option( self::OPTION_POSTAL, '' ),
			'audiences'      => self::AUDIENCES,
		);
	}

	public static function rest_set_settings( WP_REST_Request $request ) {
		update_option( self::OPTION_POSTAL, sanitize_text_field( (string) $request->get_param( 'postal_address' ) ) );
		return self::rest_get_settings();
	}
}
