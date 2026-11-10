import type { Metadata } from "next";
import { CampusMap, type MapSession } from "@/components/map/campus-map";
import { getConferenceBundle, getMapPlaces } from "@/lib/data/content";
import { formatEventDate, formatTime } from "@/lib/time";

import { getCurrentUser } from "@/lib/auth";
import { getSwitches } from "@/lib/switches";
import { ComingSoon } from "@/components/ui/coming-soon";

// Checked on each visit, so the committee can preview the map before it opens.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campus map",
  description:
    "Interactive map of the University of Lincoln Brayford Pool campus for INSPIRE: find Lincoln Medical School, the Isaac Newton Building and your rooms on the day.",
  alternates: { canonical: "/map" },
};

export default async function MapPage() {
  const switches = await getSwitches();
  if (!switches.map_open) {
    const me = await getCurrentUser();
    if (!me?.profile.access.can.edit_website && !me?.profile.access.owner)
      return (
        <div className="bg-paper px-4 pb-20 pt-28 sm:pt-36">
          <div className="mx-auto max-w-3xl">
            <ComingSoon eyebrow="Campus map">
              An interactive map of the Brayford Pool campus, with every room you&apos;ll need on the day. Check back here soon.
            </ComingSoon>
          </div>
        </div>
      );
  }
  const [{ edition, sessions }, places] = await Promise.all([getConferenceBundle(), getMapPlaces()]);
  const timed: MapSession[] = sessions
    .filter((s) => s.startsAt)
    .map((s) => ({
      id: s.id,
      title: s.title,
      roomId: s.roomId,
      starts: formatTime(s.startsAt!),
      ends: s.endsAt ? formatTime(s.endsAt) : null,
      startsAt: s.startsAt!,
    }));
  return <CampusMap places={places} sessions={timed} dateLabel={formatEventDate(edition.date)} />;
}
