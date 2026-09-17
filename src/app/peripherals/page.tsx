import { redirect } from "next/navigation";

export default function PeripheralsPage() {
  redirect("/inventory?tab=peripherals");
}
