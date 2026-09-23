# A2P 10DLC campaign registration

Copy-ready content for the Twilio campaign registration form, plus what still
needs to be filled in from your own business records.

Everything below matches what the application actually does. If the wording in
the app changes, update this file too — reviewers compare the registration
against the live site.

---

## 1. Brand / business information

**You must supply these from your records — do not guess.** A mismatch between
what you register and your legal records is the most common rejection.

| Field | Value |
| --- | --- |
| Legal business name | *(from your registration documents)* |
| DBA / brand name | Elev8 Services California |
| EIN | *(from your IRS records)* |
| Business address | *(your registered address)* |
| Business phone | *(a number that reaches you)* |
| Website | `https://www.withelev8.com` |
| Support email | `info@arfsd.com` |

> **Decide first:** the site currently uses `withelev8.com` for staff and
> outgoing mail, and `info@arfsd.com` on the public pages. The brand name, the
> website domain and the support email should tell one consistent story before
> you register. A reviewer who sees two unrelated domains will ask why.

---

## 2. Campaign use case

**Use case type:** Customer Care / Account Notification (conversational,
low volume). This is **not** a marketing campaign.

**Campaign description:**

> Elev8 Services California is a provider of residential, supported living and
> day services for adults with developmental disabilities. This campaign sends
> text messages to people who have applied for employment or a paid internship
> with us, about their own application only: confirming receipt, arranging and
> confirming phone and in-person interviews, sending interview details and
> deadlines, and giving status updates. Applicants opt in themselves on the
> job application form on our website by ticking an optional, unticked consent
> checkbox at the mobile number they provide; applicants who do not tick it can
> still apply and are contacted by phone or email. No marketing or promotional
> messages are
> sent on this campaign, and no numbers are purchased, rented or obtained from
> any third party.

---

## 3. Message flow (how people opt in)

> Consent is collected on the public job application form at
> `https://www.withelev8.com/careers/apply`, on the final step before
> submission.
>
> The applicant enters their own mobile number earlier in the form. On the
> review step they are shown a disclosure headed "Text messages about your
> application" which states who is sending, what is sent, that message
> frequency varies and is typically fewer than 10 messages per month, that
> message and data rates may apply, that they may reply STOP to opt out and
> HELP for help, and that we do not sell or share the number. Links to the
> Privacy Policy and the Terms & Conditions appear directly beneath that
> disclosure.
>
> Underneath it is a single, dedicated checkbox, unticked by default, reading
> "I agree to receive application-related text messages from Elev8 Services
> California at the mobile number I provided."
>
> The checkbox is optional. It is separate from accepting the Terms and is not
> bundled with any other agreement. An applicant who leaves it unticked can
> submit their application normally and is contacted by phone or email instead;
> their application is assessed in exactly the same way.
>
> The exact disclosure text shown is stored with the application record, along
> with the answer, the timestamp, the mobile number and a version identifier,
> so any individual consent can be evidenced later.

**Opt-in URL:** `https://www.withelev8.com/careers/apply`
**Privacy Policy URL:** `https://www.withelev8.com/privacy`
**Terms URL:** `https://www.withelev8.com/terms`

All three must be publicly reachable with no login before you submit.

---

## 4. Sample messages

These are the real messages the system produces, with a sample applicant name.
Each identifies the business.

**Sample 1 — first message after applying (carries the keywords):**

```
Hello Maria,

Thank you for applying to the Support Professional role with Elev8 Services
California. We support patients in their homes and in the community, and we
are reviewing your application now.

Please reply to let us know the days and times you are generally available for
a short phone interview.

If we do not hear from you by Friday, October 2, we will close your
application for this hiring cycle.

Elev8 Services California — Recruiting Team
Reply STOP to opt out. Reply HELP for help.
```

**Sample 2 — offering interview times:**

```
Hello Maria,

Thank you for your interest in the Support Professional role with Elev8
Services. We have 2 interview times available. Please rank all 2 in order of
preference:

Tuesday, October 6
  • 9:00 AM
  • 1:30 PM

If we do not hear from you by Friday, October 2, we will close your
application for this hiring cycle.

Elev8 Services California — Recruiting Team
```

**Sample 3 — HELP reply:**

```
Elev8 Services California: application updates for applicants. For help,
email info@arfsd.com. Msg & data rates may apply. Reply STOP to opt out.
```

**Sample 4 — STOP reply:**

```
Elev8 Services California: You have been unsubscribed and will receive no
further text messages. Your application is not affected — we will contact you
by phone or email instead.
```

> Samples 3 and 4 describe the replies your messaging provider must be
> configured to send. They are not generated by this application, because it
> does not yet send text messages programmatically — see the note below.

---

## 5. Things a reviewer will check that are not code

- **Do not state that users are automatically opted in.** They are not; consent
  is an explicit choice on the form.
- **Do not claim consent you do not collect.** Only applicants who ticked the
  box may be messaged. The `canTextApplicant()` gate in
  `src/lib/sms-consent.ts` enforces this, and it also checks that the person
  has not opted out since.
- **Samples must be messages you actually send.** The two above are generated
  verbatim by `buildTemplate()` and `buildSlotOfferMessage()` in
  `src/lib/ats-workflow.ts`.

---

## 6. Open item before you register

**No text messages are sent programmatically yet.** Today the system generates
the approved wording and a staff member copies it and sends it from their own
phone. A2P registration governs messages sent through a provider, so you are
registering for a capability the app does not use yet.

That is not a problem in itself — registering ahead of wiring up the provider
is normal — but be aware that:

- STOP and HELP are currently handled by whatever phone the staff member uses,
  not by the application. Once a provider is connected, STOP handling must be
  wired to `recordTextOptOut()` so an opt-out actually blocks future messages.
- Samples 3 and 4 above need to be configured as auto-replies at the provider.

---

## 7. Compliance checklist status

| Item | Where |
| --- | --- |
| Privacy explains phone number collection and use | `/privacy` → Text messages |
| Privacy explains SMS communications | `/privacy` → Text messages |
| Privacy states opt-in data is not sold | `/privacy` → Text messages |
| Privacy states not shared with third parties for their marketing | `/privacy` → Text messages |
| Privacy identifies the business | `/privacy` |
| Privacy contact method | `/privacy` → `info@arfsd.com` |
| Terms: business name | `/terms` |
| Terms: SMS program description | `/terms#sms` |
| Terms: message frequency | `/terms#sms` |
| Terms: rates statement | `/terms#sms` |
| Terms: STOP instructions | `/terms#sms` |
| Terms: HELP instructions | `/terms#sms` |
| Terms: support contact | `/terms#sms` |
| Terms: Privacy Policy link | `/terms` → Privacy |
| Terms: carrier disclaimer | `/terms#sms` → Carriers |
| Samples identify the brand | every template signs off as Elev8 Services California |

| Consent is optional | An unticked box still submits the application |
| Consent is a separate, unticked checkbox | Not bundled with the Terms |

**Still outstanding:** legal name, EIN and business address (section 1), and
the domain inconsistency (section 1).
