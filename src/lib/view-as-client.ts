/** True in the browser while the site owner is viewing as someone (read only). */
export const viewingAs = () => typeof document !== "undefined" && document.cookie.split("; ").some((c) => c.startsWith("inspire_view_as_who="));
