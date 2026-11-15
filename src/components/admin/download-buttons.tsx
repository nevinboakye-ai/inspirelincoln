import { FileSpreadsheet, FileText } from "lucide-react";
import { btn } from "@/components/admin/ui";

/**
 * Excel and Word buttons for one list on the downloads page's route. `label`
 * names the list for screen readers, e.g. "Car registrations".
 */
export function DownloadButtons({ set, label, short }: { set: string; label: string; short?: string }) {
  const link = (format: "xlsx" | "docx") => `/admin/downloads/file?set=${set}&format=${format}`;
  return (
    <>
      <a href={link("xlsx")} download className={btn.secondary} aria-label={`Download ${label} as Excel`}>
        <FileSpreadsheet aria-hidden className="size-4 text-[#1d6f42]" /> {short ? `${short} (Excel)` : "Excel"}
      </a>
      <a href={link("docx")} download className={btn.secondary} aria-label={`Download ${label} as Word`}>
        <FileText aria-hidden className="size-4 text-[#2b579a]" /> {short ? `${short} (Word)` : "Word"}
      </a>
    </>
  );
}
