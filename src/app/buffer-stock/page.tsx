import { redirect } from "next/navigation";

export default function BufferStockPage() {
  redirect("/inventory?tab=buffer");
}
