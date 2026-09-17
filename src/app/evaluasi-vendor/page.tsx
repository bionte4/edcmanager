import { redirect } from "next/navigation";

export default function EvaluasiVendorRedirect() {
  redirect("/vendors?tab=evaluasi");
}
