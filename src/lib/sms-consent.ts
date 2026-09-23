/**
 * Text-message consent for the Support Professional application.
 *
 * The exact language shown to the applicant is stored with every record, so the
 * consent can be documented later even if this wording changes. The version
 * string must be incremented whenever the disclosure text below is edited.
 */

export const APPLICATION_VERSION = "2026-09-22b";

/** Where an applicant reaches a person about messages or their data. */
export const SUPPORT_EMAIL = "info@arfsd.com";

/* --------------------------------------------------------------------------
 * A2P 10DLC disclosures.
 *
 * Carrier campaign review expects the program name, what is sent, how often,
 * that rates may apply, and both the STOP and HELP keywords -- shown beside
 * the opt-in and repeated in the public Terms. These constants are the single
 * source for all three places, so the wording cannot drift apart.
 * ------------------------------------------------------------------------ */

export const SMS_PROGRAM_NAME = "Elev8 Services Application Updates";

export const SMS_PROGRAM_DESCRIPTION =
  "Elev8 Services California sends text messages to applicants about their own application: scheduling and confirmations, interview details, deadlines, and status updates. These are not marketing messages.";

export const SMS_MESSAGE_FREQUENCY =
  "Message frequency varies with the stage of your application, and is typically fewer than 10 messages per month.";

export const SMS_RATES_NOTICE = "Message and data rates may apply.";

export const SMS_STOP_REPLY = "Reply STOP at any time to stop receiving text messages.";

export const SMS_HELP_REPLY = "Reply HELP for help.";

export const SMS_CONSENT_QUESTION = "Text message consent (optional)";

export const SMS_CONSENT_INTRO =
  "Elev8 Services uses text messaging for time-sensitive communication throughout the application, interview, hiring, and onboarding process. Agreeing is optional — if you would rather not receive text messages, we will contact you by phone or email instead, and your application is considered exactly the same way.";

export const SMS_CONSENT_PROMPT =
  "Would you like to receive application-related text messages from Elev8 Services?";

/**
 * The checkbox label.
 *
 * Carrier review expects an unchecked, optional checkbox whose label alone
 * says who is messaging and about what — not a yes/no question whose meaning
 * depends on text elsewhere on the page.
 */
export const SMS_CONSENT_AGREE =
  "I agree to receive application-related text messages from Elev8 Services California at the mobile number I provided.";

/** Recorded when the box is left unchecked, so the choice is documented either way. */
export const SMS_CONSENT_NOT_GIVEN = "Not selected — no text-message consent given.";

/** Shown directly beneath the consent question. */
export const SMS_CONSENT_RATES = [
  SMS_MESSAGE_FREQUENCY,
  SMS_RATES_NOTICE,
  SMS_STOP_REPLY,
  SMS_HELP_REPLY,
].join(" ");

/** The full disclosure exactly as displayed, archived with each record. */
export const SMS_CONSENT_TEXT = [
  SMS_CONSENT_QUESTION,
  SMS_CONSENT_INTRO,
  SMS_CONSENT_PROMPT,
  SMS_CONSENT_RATES,
  SMS_CONSENT_AGREE,
].join("\n\n");

/**
 * Single gate for every automated text message. A message may only be sent when
 * the applicant agreed and has not opted out since.
 */
export function canTextApplicant(record: {
  sms_consent?: boolean | null;
  sms_opt_out_at?: string | null;
}): boolean {
  return record.sms_consent === true && !record.sms_opt_out_at;
}
