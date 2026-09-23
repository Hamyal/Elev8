import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Ban,
  Eye,
  FileText,
  Inbox,
  Lock,
  Mail,
  MessageSquare,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  BackToTop,
  Commitment,
  ContentsChips,
  ContentsRail,
  FactTable,
  LegalFooterLinks,
  LegalHero,
  CompareGrid,
  DataJourney,
  MessagePreview,
  MessageTranscript,
  Panel,
  ReadingProgress,
  RevealFallbackStyles,
  Section,
  type TocItem,
} from "@/components/site/LegalPage";
import {
  SMS_MESSAGE_FREQUENCY,
  SMS_PROGRAM_DESCRIPTION,
  SMS_RATES_NOTICE,
  SMS_STOP_REPLY,
  SUPPORT_EMAIL,
} from "@/lib/sms-consent";

/**
 * Privacy Policy.
 *
 * Covers three things a reader (or a carrier compliance reviewer) needs to
 * find quickly: what the contact form collects, what a job application
 * collects, and how mobile numbers and text-message consent are handled. The
 * text-messaging statements are shared with the Terms page and the consent
 * card on the application form, so all three always agree.
 */
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Elev8 Services California" },
      {
        name: "description",
        content:
          "How Elev8 Services California handles information submitted through this website, including phone numbers and text-message consent.",
      },
      { property: "og:title", content: "Privacy Policy — Elev8 Services California" },
      {
        property: "og:description",
        content:
          "How Elev8 Services California handles information submitted through this website.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Privacy,
});

const anchor = "font-semibold text-primary underline underline-offset-2 hover:text-accent";

const CONTENTS: TocItem[] = [
  { id: "contact-form", label: "Contact form" },
  { id: "applications", label: "Job applications" },
  { id: "text-messages", label: "Phone & texts" },
  { id: "sensitive", label: "Sensitive info" },
  { id: "removal", label: "Removal" },
];

/** Mirrors buildTemplate("initial_outreach", …) — see MessagePreview. */
const SAMPLE_MESSAGE = [
  "Hello Maria,",
  "Thank you for applying to the Support Professional role with Elev8 Services California. We are reviewing your application now.",
  "Please reply to let us know the days and times you are generally available for a short phone interview.",
  "Elev8 Services California — Recruiting Team",
  "Reply STOP to opt out. Reply HELP for help.",
];

function Privacy() {
  return (
    <div className="bg-background">
      <RevealFallbackStyles />
      <ReadingProgress />
      <LegalHero
        eyebrow="Legal"
        title="Privacy Policy"
        summary="What we collect when you contact us or apply for a role, how we use it, and how to have it removed."
        updated="22 September 2026"
        highlights={[
          { icon: XCircle, label: "Never sold" },
          { icon: ShieldCheck, label: "Hiring staff only" },
          { icon: Trash2, label: "Removal on request" },
        ]}
      />

      <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-12">
          <aside className="hidden lg:block">
            <ContentsRail items={CONTENTS} />
          </aside>

          <div className="min-w-0">
            <ContentsChips items={CONTENTS} />

            <div className="mt-10 space-y-10 lg:mt-0">
              <Section id="contact-form" index={1} icon={Mail} title="When you contact us">
                <p>
                  This website collects only the information you choose to send us through the
                  contact form: your name, email address, optional phone number, the topic you
                  select, and your message. We use it solely to respond to your inquiry.
                </p>
                <Commitment>
                  We do not sell your information, and we do not share it with third parties for
                  marketing.
                </Commitment>
              </Section>

              <Section
                id="applications"
                index={2}
                icon={FileText}
                title="When you apply for a role"
              >
                <p>
                  If you apply for a position, we collect the answers you give on the application
                  form and use them only to consider you for the opportunity you applied for and to
                  contact you about it.
                </p>
                <FactTable
                  rows={[
                    {
                      label: "What we collect",
                      value:
                        "Contact details, availability, education, work history, and your answers to the application questions.",
                    },
                    {
                      label: "Documents",
                      value:
                        "Certification and class-schedule files you upload. An optional résumé is not stored.",
                    },
                    {
                      label: "Who can see it",
                      value: "Our hiring staff only. Uploaded documents are stored privately.",
                    },
                    {
                      label: "Why we hold it",
                      value: "To assess your application and contact you about it.",
                    },
                  ]}
                />

                <div className="pt-4">
                  <p className="pb-4 text-sm font-bold text-primary">Where your information goes</p>
                  <DataJourney
                    steps={[
                      {
                        icon: Send,
                        title: "You submit",
                        detail: "Your answers travel to us over an encrypted connection.",
                      },
                      {
                        icon: Inbox,
                        title: "We store it",
                        detail: "In our own database. Uploads are kept privately, never public.",
                      },
                      {
                        icon: Eye,
                        title: "Staff review it",
                        detail: "Only our hiring team, and every file opened is logged.",
                      },
                      {
                        icon: Trash2,
                        title: "You can remove it",
                        detail: "Email us and we will delete your record.",
                      },
                    ]}
                  />
                </div>
              </Section>

              {/* ---- A2P 10DLC: phone-number and consent disclosures --------- */}
              <Section
                id="text-messages"
                index={3}
                icon={MessageSquare}
                title="Phone numbers and text messages"
              >
                <p>{SMS_PROGRAM_DESCRIPTION}</p>
                <p>
                  Giving consent is optional. You are added only if you tick the checkbox during the
                  application, at the mobile number you give us there — it is never ticked for you,
                  and leaving it unticked does not affect your application. {SMS_MESSAGE_FREQUENCY}{" "}
                  {SMS_RATES_NOTICE} {SMS_STOP_REPLY}
                </p>

                <div className="rounded-2xl border border-accent/30 bg-accent/[0.04] p-5">
                  <div className="flex gap-3">
                    <Ban className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
                    <div>
                      <p className="text-sm font-bold text-primary">
                        We never sell or share your mobile number
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Your mobile number and your text-message consent are not sold, rented, or
                        shared with third parties or affiliates for their own marketing purposes —
                        not under any circumstances.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <p className="flex items-center gap-2 pb-4 text-sm font-bold text-primary">
                    <Smartphone className="h-4 w-4 text-teal" strokeWidth={1.75} />
                    What a message looks like
                  </p>
                  <div className="grid items-start gap-6 lg:grid-cols-[17rem_1fr]">
                    <MessagePreview
                      sender="Elev8 Services California"
                      lines={SAMPLE_MESSAGE}
                      caption="As it arrives on your phone."
                    />
                    <MessageTranscript
                      label="Sample message"
                      sender="Elev8 Services California"
                      lines={SAMPLE_MESSAGE}
                      note="The first message you receive after applying. Every message names us, and this one carries both keywords."
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <CompareGrid
                    doTitle="What we do with your number"
                    doItems={[
                      "Use it to contact you about your own application.",
                      "Keep it with your application record, visible to hiring staff only.",
                      "Stop messaging the moment you reply STOP.",
                      "Delete it with your record when you ask us to.",
                    ]}
                    dontTitle="What we never do"
                    dontItems={[
                      "Sell or rent it to anyone.",
                      "Share it with third parties or affiliates for their marketing.",
                      "Use it for marketing or promotional messages.",
                      "Pass it to a data broker or advertising network.",
                    ]}
                  />
                </div>

                <p>
                  The full program terms, including how to stop messages and how to get help, are in
                  our{" "}
                  <Link to="/terms" className={anchor}>
                    Terms &amp; Conditions
                  </Link>
                  .
                </p>
              </Section>

              <Section id="sensitive" index={4} icon={Lock} title="Sensitive information">
                <p>
                  Please do not submit medical records or other confidential documentation through
                  this website. Contact us and we will arrange a secure method.
                </p>
              </Section>

              <Section id="removal" index={5} icon={Trash2} title="Questions or removal">
                <Panel>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    To ask about your information or request its deletion, email{" "}
                    <a href={`mailto:${SUPPORT_EMAIL}`} className={anchor}>
                      {SUPPORT_EMAIL}
                    </a>
                    . Tell us which form you used and we will find your record.
                  </p>
                </Panel>
              </Section>
            </div>

            <LegalFooterLinks
              other="/terms"
              otherLabel="Terms & Conditions"
              email={SUPPORT_EMAIL}
            />
          </div>
        </div>
      </div>

      <BackToTop />
    </div>
  );
}
