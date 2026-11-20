import React from "react";
import { ExternalLink, HeartPulse, Info, LifeBuoy, Phone, Truck } from "lucide-react";
import { Language, toBnNum } from "../../lib/translations";
import { ContactKind, FLOOD_CONTACTS, FloodContact } from "../../data/floodContacts";
import { Notice } from "../rk/Notice";

// Verified flood contacts, grouped by the kind of help (design-system/rokkha/MASTER.md).

const GROUPS: Array<{ kind: ContactKind; en: string; bn: string; icon: React.ElementType }> = [
  { kind: "rescue", en: "Rescue and emergency", bn: "উদ্ধার ও জরুরি", icon: LifeBuoy },
  { kind: "relief", en: "Relief and disaster support", bn: "ত্রাণ ও দুর্যোগ সহায়তা", icon: Truck },
  { kind: "medical", en: "Medical advice", bn: "চিকিৎসা পরামর্শ", icon: HeartPulse },
  { kind: "information", en: "Flood information", bn: "বন্যার তথ্য", icon: Info },
];

const ContactCard: React.FC<{ contact: FloodContact; isBn: boolean }> = ({ contact, isBn }) => {
  const tr = (en: string, bn: string | null) => (isBn && bn ? bn : en);
  return (
    <li className="rounded-xl border border-rk-line bg-rk-surface p-4 flex flex-col gap-3">
      <div>
        <div className="text-[17px] font-bold text-rk-ink leading-snug">{tr(contact.name.en, contact.name.bn)}</div>
        <p className="mt-1 text-[15px] text-rk-muted leading-snug">{tr(contact.provides.en, contact.provides.bn)}</p>
        <p className="mt-1 text-[13px] text-rk-muted">
          {tr(contact.coverage.en, contact.coverage.bn)}
          {contact.hours ? ` · ${tr(contact.hours.en, contact.hours.bn)}` : ""}
        </p>
      </div>
      <a
        href={`tel:${contact.tel}`}
        className="mt-auto h-12 rounded-xl bg-rk-brand hover:bg-rk-brand-strong text-white font-bold text-lg inline-flex items-center justify-center gap-2"
        aria-label={`${isBn ? "কল করুন" : "Call"} ${tr(contact.name.en, contact.name.bn)}: ${contact.number}`}
      >
        <Phone className="w-5 h-5" aria-hidden="true" />
        {isBn ? toBnNum(contact.number) : contact.number}
      </a>
      <a
        href={contact.source}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[13px] text-rk-muted underline inline-flex items-center gap-1 self-start"
      >
        {isBn ? `উৎস · যাচাই ${toBnNum(contact.checkedOn)}` : `Source · checked ${contact.checkedOn}`}
        <ExternalLink className="w-3 h-3" aria-hidden="true" />
      </a>
    </li>
  );
};

export const ContactDirectory: React.FC<{ lang: Language; headingLevel?: "h1" | "h2" }> = ({ lang, headingLevel = "h2" }) => {
  const isBn = lang === "bn";
  const Heading = headingLevel;
  const SubHeading = headingLevel === "h1" ? "h2" : "h3";
  const groups = GROUPS.map((g) => ({ ...g, items: FLOOD_CONTACTS.filter((c) => c.kind === g.kind) })).filter(
    (g) => g.items.length > 0
  );

  return (
    <section aria-labelledby="contacts-title" className="space-y-5">
      <div>
        <Heading id="contacts-title" className="text-2xl md:text-[28px] font-extrabold text-rk-ink tracking-tight">
          {isBn ? "উদ্ধার ও ত্রাণের যোগাযোগ" : "Rescue and relief contacts"}
        </Heading>
        <p className="mt-1 text-[15px] text-rk-muted max-w-2xl">
          {isBn
            ? "শুধু সরকারি বা প্রতিষ্ঠানের নিজস্ব ওয়েবসাইটে প্রকাশিত নম্বর। প্রতিটির উৎস ও যাচাইয়ের তারিখ দেওয়া আছে।"
            : "Only numbers published by the organisation itself or the government. Each shows its source and the date it was checked."}
        </p>
      </div>

      {groups.length === 0 ? (
        <Notice tone="warning" title={isBn ? "যাচাই করা নম্বর এখনো যোগ হয়নি" : "No verified numbers added yet"}>
          {isBn
            ? "জীবন ঝুঁকিতে থাকলে জাতীয় জরুরি সেবা ৯৯৯ এ কল করুন।"
            : "If a life is in danger, call the national emergency number 999."}
        </Notice>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3 xl:items-start">
          {groups.map((group) => (
            <div key={group.kind} className="space-y-3">
              <SubHeading className="flex items-center gap-2 text-lg font-bold text-rk-ink">
                <group.icon className="w-5 h-5 text-rk-brand" aria-hidden="true" />
                {isBn ? group.bn : group.en}
              </SubHeading>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {group.items.map((c) => (
                  <ContactCard key={c.id} contact={c} isBn={isBn} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
