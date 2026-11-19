import { AdminSectionPage } from "./AdminSectionPage";

// Static pages for each Admin Control Centre section (/admin/users, /admin/audit, ...). The page is
// only a shell; the server checks the administrator's permission on every data request.
const SECTIONS = ["overview", "rescue", "alerts", "data", "analytics", "users", "teams", "places", "health", "audit", "settings"];

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}

export const dynamicParams = false;

export default function Page({ params }: { params: { section: string } }) {
  return <AdminSectionPage section={params.section} />;
}
