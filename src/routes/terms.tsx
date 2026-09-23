import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accessibility,
  Building2,
  FileCheck2,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Signal,
  Smartphone,
  XCircle,
} from "lucide-react";
import {
  BackToTop,
  Commitment,
  ContentsChips,
  ContentsRail,
  FactTable,
  KeywordCard,
  LegalFooterLinks,
  LegalHero,
  MessagePreview,
  MessageTranscript,
  CompareGrid,
  StageTimeline,
  Panel,
  ReadingProgress,
  RevealFallbackStyles,
  Section,
  StepFlow,
  type TocItem,
} from "@/components/site/LegalPage";
import {
  SMS_HELP_REPLY,
  SMS_MESSAGE_FREQUENCY,
  SMS_PROGRAM_DESCRIPTION,
  SMS_PROGRAM_NAME,
  SMS_RATES_NOTICE,
  SMS_STOP_REPLY,
  SUPPORT_EMAIL,
} from "@/lib/sms-consent";

/**
 * Terms & Conditions.
 *
 * The text-messaging section is written to satisfy A2P 10DLC campaign review:
 * carriers expect the program description, message frequency, rate notice, and
 * the STOP and HELP keywords to be publicly readable without signing in, and
 * to be linked from beside the opt-in itself. Every one of those disclosures
 * comes from src/lib/sms-consent.ts, which is also the source for the wording
 * on the application form, so the two can never drift apart.
 */
export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Elev8 Services California" },
      {
        name: "description",
        content:
          "Terms of use for the Elev8 Services California website, including the terms of our application text-messaging program.",
      },
      { property: "og:title", content: "Terms & Conditions — Elev8 Services California" },
      {
        property: "og:description",
        content:
          "Terms of use for the Elev8 Services California website, including our text-messaging program terms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Terms,
});

const anchor = "font-semibold text-primary underline underline-offset-2 hover:text-accent";

const CONTENTS: TocItem[] = [
  { id: "website", label: "Using this site" },
  { id: "applications", label: "Applications" },
  { id: "sms", label: "Text messages" },
  { id: "join", label: "How you join" },
  { id: "what-we-send", label: "What we send" },
  { id: "keywords", label: "STOP & HELP" },
  { id: "privacy", label: "Privacy" },
  { id: "changes", label: "Changes" },
];

/** Mirrors buildTemplate("initial_outreach", …) — see MessagePreview. */
const SAMPLE_MESSAGE = [
  "Hello Maria,",
  "Thank you for applying to the Support Professional role with Elev8 Services California. We support patients in their homes and in the community, and we are reviewing your application now.",
  "Please reply to let us know the days and times you are generally available for a short phone interview.",
  "Elev8 Services California — Recruiting Team",
  "Reply STOP to opt out. Reply HELP for help.",
];

function Terms() {
  return (
    <div className="bg-background">
      <RevealFallbackStyles />
      <ReadingProgress />
      <LegalHero
        eyebrow="Legal"
        title="Terms & Conditions"
        summary="How you may use this website, and the terms of the text-messaging program we use to keep applicants informed."
        updated="22 September 2026"
        highlights={[
          { icon: MessageSquare, label: "Application updates only" },
          { icon: XCircle, label: "No marketing messages" },
          { icon: ShieldCheck, label: "Opt out any time" },
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
              <Section id="website" index={1} icon={Building2} title="Using this website">
                <p>
                  The information on this site is provided for general reference about our
                  residential, supported living, and day services, and about employment and
                  internship opportunities. It does not create a contract of employment, a guarantee
                  of placement, or a promise of services.
                </p>
              </Section>

              <Section id="applications" index={2} icon={FileCheck2} title="Applications">
                <p>
                  Submitting an application does not create an offer of employment or an internship.
                  We review each application and contact applicants we wish to move forward with.
                  Information you provide must be accurate and your own; applications containing
                  knowingly false statements may be closed.
                </p>
              </Section>

              {/* ---- A2P 10DLC: the program terms carriers look for ---------- */}
              <Section id="sms" index={3} icon={MessageSquare} title="Text-messaging program">
                <p>{SMS_PROGRAM_DESCRIPTION}</p>

                <FactTable
                  rows={[
                    { label: "Program", value: SMS_PROGRAM_NAME },
                    {
                      label: "Message type",
                      value: "Transactional — about your own application. Never marketing.",
                    },
                    { label: "Frequency", value: SMS_MESSAGE_FREQUENCY },
                    { label: "Cost", value: SMS_RATES_NOTICE },
                    {
                      label: "Support",
                      value: (
                        <a href={`mailto:${SUPPORT_EMAIL}`} className={anchor}>
                          {SUPPORT_EMAIL}
                        </a>
                      ),
                    },
                  ]}
                />

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
                      label="Sample message 1 of 1"
                      sender="Elev8 Services California"
                      lines={SAMPLE_MESSAGE}
                      note="The first message you receive after applying. Every message names us, and this one carries both keywords."
                    />
                  </div>
                </div>
              </Section>

              <Section
                id="what-we-send"
                index={4}
                icon={MessageSquare}
                title="What we send, and what we never send"
              >
                <p>
                  Messages relate to your own application only — scheduling and confirmations,
                  interview details, deadlines, and status updates. They follow your progress and
                  stop when the process does.
                </p>

                <div className="pt-1">
                  <StageTimeline
                    stages={[
                      {
                        stage: "After you apply",
                        count: "1 message",
                        message:
                          "We confirm we have your application and ask when you are free to talk.",
                      },
                      {
                        stage: "Phone screening",
                        count: "1–3 messages",
                        message:
                          "Proposing a time, confirming it, and following up if we miss each other.",
                      },
                      {
                        stage: "Interviews",
                        count: "2–5 messages",
                        message:
                          "Interview times to choose from, confirmations, and any materials you need beforehand.",
                      },
                      {
                        stage: "Offer & onboarding",
                        count: "1–3 messages",
                        message: "Arranging the offer call and the handover to onboarding.",
                      },
                      {
                        stage: "If we stop",
                        count: "1 message",
                        message:
                          "If you are not moving forward, we tell you. Then the messages end.",
                      },
                    ]}
                  />
                </div>

                <div className="pt-3">
                  <CompareGrid
                    doTitle="What we do"
                    doItems={[
                      "Treat consent as optional — you can apply without it.",
                      "Message only the number you gave us on your application.",
                      "Send only messages about your own application.",
                      "Name ourselves in every message.",
                      "Stop immediately when you reply STOP.",
                    ]}
                    dontTitle="What we never do"
                    dontItems={[
                      "Send marketing or promotional messages.",
                      "Sell, rent, or share your number for anyone's marketing.",
                      "Buy or scrape phone numbers from anywhere.",
                      "Message you without your agreement.",
                    ]}
                  />
                </div>

                <Commitment>
                  We do not send marketing or promotional text messages, and we never sell or share
                  your mobile number with third parties for their marketing.
                </Commitment>
              </Section>

              <Section id="join" index={5} icon={FileCheck2} title="How you join">
                <p>
                  You join only by ticking an optional checkbox during the job application, at the
                  mobile number you provide there. It is never ticked for you. We never add a number
                  that was not given to us for this purpose, and we do not buy, rent, or collect
                  numbers from anywhere else.
                </p>
                <div className="pt-3">
                  <StepFlow
                    steps={[
                      {
                        title: "You apply",
                        detail: "You enter your own mobile number on the application form.",
                      },
                      {
                        title: "You read the terms",
                        detail:
                          "The disclosure appears beside the question, with these terms linked.",
                      },
                      {
                        title: "You choose",
                        detail:
                          "An optional checkbox, separate from anything else and never pre-ticked.",
                      },
                      {
                        title: "We message you",
                        detail: "Only about your application, and only while you agree.",
                      },
                    ]}
                  />
                </div>
              </Section>

              <Section
                id="keywords"
                index={6}
                icon={ShieldCheck}
                title="Stopping messages & getting help"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <KeywordCard keyword="STOP" heading="Stopping messages" tone="accent">
                    {SMS_STOP_REPLY} You may also email{" "}
                    <a href={`mailto:${SUPPORT_EMAIL}`} className={anchor}>
                      {SUPPORT_EMAIL}
                    </a>
                    . Stopping text messages does not withdraw your application — we will continue
                    by phone or email instead.
                  </KeywordCard>
                  <KeywordCard keyword="HELP" heading="Getting help" tone="teal">
                    {SMS_HELP_REPLY} You can also reach us any time at{" "}
                    <a href={`mailto:${SUPPORT_EMAIL}`} className={anchor}>
                      {SUPPORT_EMAIL}
                    </a>
                    .
                  </KeywordCard>
                </div>

                <Panel>
                  <div className="flex gap-3">
                    <Signal
                      className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                    <div>
                      <p className="text-sm font-bold text-primary">Carriers</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Carriers are not liable for delayed or undelivered messages. Delivery is not
                        guaranteed and depends on your carrier and device.
                      </p>
                    </div>
                  </div>
                </Panel>
              </Section>

              <Section id="privacy" index={7} icon={ShieldCheck} title="Privacy & accessibility">
                <p>
                  Our{" "}
                  <Link to="/privacy" className={anchor}>
                    Privacy Policy
                  </Link>{" "}
                  explains what we collect, how we use it, and how to ask for its removal.
                </p>
                <p className="flex items-start gap-2">
                  <Accessibility
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <span>
                    We aim to keep this site usable for everyone. See our{" "}
                    <Link to="/accessibility" className={anchor}>
                      accessibility statement
                    </Link>{" "}
                    if you encounter a barrier.
                  </span>
                </p>
              </Section>

              <Section id="changes" index={8} icon={RefreshCw} title="Changes to these terms">
                <p>
                  We may update these terms. The version published here is the one that applies.
                </p>
              </Section>
            </div>

            <LegalFooterLinks other="/privacy" otherLabel="Privacy Policy" email={SUPPORT_EMAIL} />
          </div>
        </div>
      </div>

      <BackToTop />
    </div>
  );
}
