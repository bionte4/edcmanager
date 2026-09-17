import { redirect } from "next/navigation";

export default function NocPage() {
  redirect("/workforce?tab=noc");
}
