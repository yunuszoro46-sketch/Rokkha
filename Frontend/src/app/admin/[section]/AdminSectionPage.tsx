"use client";

import { CitizenPortalApp } from "@/components/CitizenPortalApp";

export function AdminSectionPage({ section }: { section: string }) {
  return <CitizenPortalApp initialView="admin" adminSection={section} />;
}
