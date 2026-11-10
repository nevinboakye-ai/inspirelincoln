import type { Metadata } from "next";
import { CampusMap, type MapSession } from "@/components/map/campus-map";
import { getConferenceBundle, getMapPlaces } from "@/lib/data/content";
import { formatEventDate, formatTime } from "@/lib/time";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Campus map",
  description:
    "Interactive map of the University of Lincoln Brayford Pool campus for INSPIRE: find Lincoln Medical School, the Isaac Newton Building and your rooms on the day.",
  alternates: { canonical: "/map" },
};

export default async function MapPage() {
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
