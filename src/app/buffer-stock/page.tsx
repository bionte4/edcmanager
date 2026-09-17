import { AppShell } from "@/components/layout/app-shell";
import { BufferStockModule } from "@/components/buffer-stock/buffer-stock-module";
import { MOCK_BUFFER_STOCK } from "@/data/dashboard";
import { BUFFER_STOCK_MIN_PERCENT } from "@/config/inventory.config";

export default function BufferStockPage() {
  return (
    <AppShell
      title="Buffer Stock Logistik"
      description={`Distribusi stok cadangan EDC per Regional Office. Target minimum ${BUFFER_STOCK_MIN_PERCENT}% — pooling jika menipis.`}
    >
      <BufferStockModule initialRows={MOCK_BUFFER_STOCK} />
    </AppShell>
  );
}
