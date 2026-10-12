<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The site's contact form (/contact on the frontend), replacing Contact
 * Form 7. The frontend's /api/contact route checks the spam trap, then
 * calls this with the shared secret Settings → Site refresh already holds
 * (sc-revalidate's sc_revalidate_secret, the same value as Vercel's
 * REVALIDATE_SECRET), so nobody can post here directly. The message is
 * emailed to TO with Reply-To set to the sender.
 */
class SC_Membership_Contact {

	const TO = 'info@secretcarshalton.com';

	/** Messages allowed per visitor (by IP, passed on by the frontend) per hour. */
	const HOURLY_LIMIT = 5;

	public static function register_routes() {
		register_rest_route(
			'sc-membership/v1',
			'/contact',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'send' ),
				'permission_callback' => array( __CLASS__, 'from_frontend' ),
			)
		);
	}

	public static function from_frontend( WP_REST_Request $request ) {
		$secret = (string) get_option( 'sc_revalidate_secret', '' );
		$given  = (string) $request->get_header( 'x-sc-secret' );
		return '' !== $secret && hash_equals( $secret, $given );
	}

	public static function send( WP_REST_Request $request ) {
		$name    = sanitize_text_field( (string) $request->get_param( 'name' ) );
		$email   = sanitize_email( (string) $request->get_param( 'email' ) );
		$subject = sanitize_text_field( (string) $request->get_param( 'subject' ) );
		$message = sanitize_textarea_field( (string) $request->get_param( 'message' ) );

		if ( '' === $name || ! is_email( $email ) || '' === trim( $message ) ) {
			return new WP_Error( 'missing_fields', 'Please add your name, email address and a message.', array( 'status' => 400 ) );
		}
		if ( strlen( $message ) > 5000 ) {
			return new WP_Error( 'too_long', 'Please keep your message under 5,000 characters.', array( 'status' => 400 ) );
		}

		$ip  = sanitize_text_field( (string) $request->get_header( 'x-sc-client-ip' ) );
		$key = 'sc_contact_' . md5( $ip ? $ip : 'unknown' );
		$count = (int) get_transient( $key );
		if ( $count >= self::HOURLY_LIMIT ) {
			return new WP_Error( 'rate_limited', 'You\'ve sent a few messages already. Please try again in an hour, or email us at ' . self::TO . '.', array( 'status' => 429 ) );
		}

		$lines = array(
			'Name: ' . $name,
			'Email: ' . $email,
			'',
			$message,
			'',
			'—',
			'Sent from the contact form on the Secret Carshalton website.',
		);
		$sent = wp_mail(
			self::TO,
			'Website message: ' . ( '' !== $subject ? $subject : 'from ' . $name ),
			implode( "\n", $lines ),
			array( 'Reply-To: ' . str_replace( array( "\r", "\n", '<', '>' ), '', $name ) . ' <' . $email . '>' )
		);
		if ( ! $sent ) {
			return new WP_Error( 'not_sent', 'Sorry, your message couldn\'t be sent. Please email us at ' . self::TO . '.', array( 'status' => 500 ) );
		}

		set_transient( $key, $count + 1, HOUR_IN_SECONDS );
		return array( 'sent' => true );
	}
}
