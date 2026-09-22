/**
 * Text-message consent for the Support Professional application.
 *
 * The exact language shown to the applicant is stored with every record, so the
 * consent can be documented later even if this wording changes. The version
 * string must be incremented whenever the disclosure text below is edited.
 */

export const APPLICATION_VERSION = "2026-08-31";

export const SMS_CONSENT_QUESTION = "Text communication requirement";

export const SMS_CONSENT_INTRO =
  "Elev8 Services uses text messaging for time-sensitive communication throughout the application, interview, hiring, and onboarding process.";

export const SMS_CONSENT_PROMPT =
  "Do you agree to receive application-related text messages from Elev8 Services at the mobile number you provided?";

export const SMS_CONSENT_RATES =
  "Message and data rates may apply. Message frequency varies. You may reply STOP to discontinue text messages.";

export const SMS_CONSENT_YES = "Yes, I agree to receive application-related text messages.";
export const SMS_CONSENT_NO = "No, I do not agree.";

/** The full disclosure exactly as displayed, archived with each record. */
export const SMS_CONSENT_TEXT = [
  SMS_CONSENT_QUESTION,
  SMS_CONSENT_INTRO,
  SMS_CONSENT_PROMPT,
  SMS_CONSENT_RATES,
  SMS_CONSENT_YES,
  SMS_CONSENT_NO,
].join("\n\n");

/** Applicant-facing card shown when text messaging is declined. */
export const SMS_DECLINE_REASON =
  "Text messaging is a required communication method throughout our application, interview, hiring, and onboarding process because we use it for time-sensitive scheduling, confirmations, deadlines, and updates.";

export const SMS_DECLINE_CLOSING =
  "Based on your response, you cannot continue with the application. We appreciate your interest in Elev8 Services.";

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
