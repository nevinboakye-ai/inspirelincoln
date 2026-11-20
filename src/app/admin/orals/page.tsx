import type { Metadata } from "next";
import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { OralBoardEditor, OralPublishForm, OralRoomsForm } from "@/components/admin/oral-board";
import { AudiencePublishForm, OralAudienceEditor } from "@/components/admin/oral-audience";
import { Notice } from "@/components/ui/notice";
import { loadOralBoard } from "@/lib/orals/admin";

export const metadata: Metadata = { title: "Oral presentation rooms" };
export const dynamic = "force-dynamic";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-700">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-700">{note}</p>}
    </div>
  );
}

const when = (d: string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function OralRoomsPage() {
  const { db, profile } = await requireAccess("allocate_orals", "/admin/orals");
  const b = await loadOralBoard(db);

  if (!b.ready) {
    return (
      <div>
        <AdminHeader title="Oral presentation rooms" />
        <Notice tone="warning" title="Not set up yet">
          Run the setup file <code>20261220000000_oral_presentation_rooms.sql</code> in the Supabase SQL editor, then refresh this page.
        </Notice>
      </div>
    );
  }

  const roomIds = new Set(b.rooms.map((r) => r.id));
  const placed = new Set(b.board.filter((p) => p.roomId && roomIds.has(p.roomId)).map((p) => p.key));
  const inRooms = b.presenters.filter((p) => placed.has(p.key)).length;
  const confirmed = b.presenters.filter((p) => p.attendance === "confirmed").length;
  const unavailable = b.presenters.filter((p) => p.attendance === "unavailable");
  const unavailablePlaced = unavailable.filter((p) => placed.has(p.key));
  const capacity = b.rooms.reduce((n, r) => (r.capacity == null || n == null ? null : n + r.capacity), 0 as number | null);
  const canProgramme = profile.access.owner || profile.access.can.edit_programme;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Oral presentation rooms"
        description="The oral presentations run in two rooms at the same time, in buildings too far apart to swap between talks. Share the speakers and then the audience between the rooms at random, and move anyone you like. Anyone you place by hand is locked, so sharing out at random again keeps them where you put them."
      />

      {b.rooms.length < 2 && (
        <Notice tone="warning" title="Two oral presentation sessions are needed">
          The programme needs one session for each oral presentation room, with a title starting &ldquo;Oral presentations&rdquo;.{" "}
          {canProgramme && (
            <Link href="/admin/content/sessions" className="font-semibold text-electric-600 underline underline-offset-4">
              Open the programme
            </Link>
          )}
        </Notice>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Oral presenters" value={`${b.presenters.length}`} note={capacity != null ? `${capacity} talk slots across the rooms` : undefined} />
        <Stat label="In a room" value={`${inRooms} of ${b.presenters.length}`} note={b.lastRun ? `Last allocated ${when(b.lastRun.at)}` : "Not allocated yet"} />
        <Stat label="Confirmed attending" value={`${confirmed} of ${b.presenters.length}`} note={unavailable.length ? `${unavailable.length} can't attend` : undefined} />
        <Stat label="Shown to presenters" value={b.published ? "Yes" : "No"} note={b.published ? "In My Hub, their day and the judges' list" : undefined} />
      </div>

      {unavailablePlaced.length > 0 && (
        <Notice tone="warning" title={`${unavailablePlaced.length === 1 ? "Someone" : `${unavailablePlaced.length} people`} in a room said they can't attend`}>
          {unavailablePlaced.map((p) => p.name).join(", ")}. Take them out of the rooms, or check with them.
        </Notice>
      )}
      {b.presenters.length > 0 && capacity != null && b.presenters.length - unavailable.length > capacity && (
        <Notice tone="warning" title="More presenters than talk slots">
          There are {b.presenters.length - unavailable.length} oral presenters who can attend and {capacity} talk slots. Allocating at random fills each room to its number of talks first, then shares out the rest, so one or both rooms will have extra talks. You can change the number of talks under &ldquo;Rooms&rdquo;.
        </Notice>
      )}

      <Panel title="Speakers">
        {b.presenters.length === 0 ? (
          <p className="text-sm text-slate-700">
            No oral presenters yet. People show here once their account (or their entry on the selected list) has the Oral presenter role.
          </p>
        ) : (
          <OralBoardEditor
            rooms={b.rooms.map((r) => ({ id: r.id, name: r.name, building: r.building, time: r.time, capacity: r.capacity }))}
            people={b.presenters.map((p) => ({ key: p.key, name: p.name, institution: p.institution, title: p.title, hasAccount: Boolean(p.userId), attendance: p.attendance }))}
            board={b.board}
            version={b.version}
            unavailable={unavailable.length}
          />
        )}
      </Panel>

      <Panel title="Show presenters their room">
        <OralPublishForm published={b.published} hasPlaces={inRooms > 0} />
      </Panel>

      <Panel title="Audience">
        {!b.audience ? (
          <Notice tone="warning" title="Not set up yet">
            Run the setup file <code>20261221000000_oral_rooms_audience.sql</code> in the Supabase SQL editor, then refresh this page.
          </Notice>
        ) : (
          <>
            <p className="mb-4 max-w-3xl text-sm text-slate-700">
              Everyone else attending stays in one room for all the oral presentations. Choose who to share out, split them at random, then tap a room beside anyone&apos;s name to move them.
            </p>
            <OralAudienceEditor
              rooms={b.rooms.map((r) => ({ id: r.id, name: r.name, building: r.building, time: r.time, capacity: r.capacity, seats: r.seats }))}
              people={b.audience.people}
              board={b.audience.board}
              version={b.audience.version}
            />
            <div className="mt-6 border-t border-navy/10 pt-6">
              <AudiencePublishForm published={b.audience.published} hasPlaces={b.audience.board.some((p) => p.roomId)} />
            </div>
          </>
        )}
      </Panel>

      <div className="grid gap-6">
        <Panel title="Rooms">
          <p className="mb-4 text-sm text-slate-700">
            How many talks each room takes{b.audience ? ", and how many seats it has for the audience (the audience is shared out in proportion to the seats, or evenly if they're left empty)" : ""}. The rooms, times and buildings come from the programme
            {canProgramme ? (
              <>
                {" "}
                (
                <Link href="/admin/content/sessions" className="font-semibold text-electric-600 underline underline-offset-4">
                  Website, Programme
                </Link>
                )
              </>
            ) : null}
            .
          </p>
          <OralRoomsForm withSeats={Boolean(b.audience)} rooms={b.rooms.map((r) => ({ id: r.id, name: r.name, building: r.building, time: r.time, capacity: r.capacity, seats: r.seats }))} />
        </Panel>
      </div>
    </div>
  );
}
