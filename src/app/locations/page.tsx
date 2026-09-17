import { redirect } from "next/navigation";

export default function LocationsPage() {
  redirect("/config?tab=locations");
}
