import { notFound } from "next/navigation";
import { getEntity } from "@/lib/admin/entities";
import { currentEditionId, requireEntityAccess } from "@/lib/admin/server";
import { AdminHeader, Flash } from "@/components/admin/ui";
import { EntityForm, DeleteEntity } from "@/components/admin/entity-form";

export const dynamic = "force-dynamic";

export default async function EntityEdit({ params, searchParams }: { params: Promise<{ entity: string; id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ entity: key, id }, sp] = await Promise.all([params, searchParams]);
  const entity = getEntity(key);
  if (!entity) notFound();
  const { db } = await requireEntityAccess(entity);
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let row: Record<string, unknown> | null = null;
  if (!isNew) {
    const { data } = await db.from(entity.table).select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }

  // Options for relation and speaker fields.
  const editionId = await currentEditionId(db);
  const relations: Record<string, { value: string; label: string }[]> = {};
  for (const f of entity.fields) {
    if (f.type === "relation" && f.relation) {
      let q = db.from(f.relation.table).select(`id, ${f.relation.label}`).order(f.relation.label);
      if (f.relation.editionScoped && editionId) q = q.eq("edition_id", editionId);
      const { data } = await q;
      relations[f.name] = ((data ?? []) as unknown as Record<string, string>[]).map((r) => ({ value: r.id, label: r[f.relation!.label] }));
    }
    if (f.type === "speakers") {
      const { data } = await db.from("speakers").select("id, full_name, published").order("full_name");
      relations[f.name] = (data ?? []).map((s) => ({ value: s.id, label: `${s.full_name}${s.published ? "" : " (unpublished)"}` }));
      if (row) {
        const { data: links } = await db.from("session_speakers").select("speaker_id").eq("session_id", id);
        row.speakers = (links ?? []).map((l) => l.speaker_id);
      }
    }
  }

  const title = isNew ? `Add ${entity.singular}` : String(row?.[entity.titleField] || `Edit ${entity.singular}`);
  return (
    <div className="max-w-4xl">
      <AdminHeader title={title} description={entity.description} back={{ href: `/admin/content/${entity.key}`, label: entity.label }} />
      {sp.created && <Flash>Created. You can keep editing below.</Flash>}
      <EntityForm entityKey={entity.key} id={isNew ? null : id} row={row} relations={relations} />
      {!isNew && (
        <div className="mt-10 border-t border-navy/10 pt-6">
          <DeleteEntity entityKey={entity.key} id={id} singular={entity.singular} />
        </div>
      )}
    </div>
  );
}
