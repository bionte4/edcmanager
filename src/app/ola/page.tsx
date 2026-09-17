import { redirect } from "next/navigation";

export default function OlaPage() {
  redirect("/config?tab=ola");
}
