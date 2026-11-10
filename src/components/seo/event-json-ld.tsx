import type { Edition } from "@/lib/types";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { eventEnd, eventStart } from "@/lib/time";

/**
 * schema.org Event data. Only verified details are included: start/end times
 * are omitted (date only) until the organisers configure them.
 */
export function EventJsonLd({ edition }: { edition: Edition }) {
  const start = eventStart(edition);
  const data = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${edition.name}: ${edition.theme}`,
    description: edition.themeStatement,
    startDate: start.hasConfirmedTime ? start.at.toISOString() : edition.date,
    endDate: edition.endTime ? eventEnd(edition).toISOString() : edition.date,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: `${edition.venueName}, ${edition.venueInstitution}`,
      address: { "@type": "PostalAddress", streetAddress: edition.venueAddress, addressCountry: "GB" },
    },
    organizer: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    url: `${SITE_URL}/conference`,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
