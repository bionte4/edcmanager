import { BUFFER_STOCK_MIN_PERCENT } from "@/config/inventory.config";
import type { BufferStockRow } from "@/data/dashboard";

export type MutationAction = "POOLING" | "TRANSFER_BUFFER" | "IDLE_TO_BUFFER";

export interface MutationRequest {
  action: MutationAction;
  fromRo: string;
  toRo: string;
  units: number;
}

export interface MutationResult {
  ok: boolean;
  message: string;
  rows: BufferStockRow[];
}

function recalc(row: Omit<BufferStockRow, "bufferPercent" | "belowThreshold">): BufferStockRow {
  const bufferPercent =
    row.totalUnits === 0 ? 0 : Number(((row.bufferUnits / row.totalUnits) * 100).toFixed(1));
  return {
    ...row,
    bufferPercent,
    belowThreshold: bufferPercent < BUFFER_STOCK_MIN_PERCENT,
  };
}

export function applyStockMutation(
  rows: BufferStockRow[],
  request: MutationRequest
): MutationResult {
  const { action, fromRo, toRo, units } = request;

  if (!Number.isInteger(units) || units <= 0) {
    return { ok: false, message: "Jumlah unit harus bilangan bulat positif.", rows };
  }
  if (action !== "IDLE_TO_BUFFER" && fromRo === toRo) {
    return { ok: false, message: "RO sumber dan tujuan tidak boleh sama.", rows };
  }

  const next = rows.map((r) => ({ ...r }));
  const from = next.find((r) => r.regionalOffice === fromRo);
  const to = next.find((r) => r.regionalOffice === toRo);

  if (!from || !to) {
    return { ok: false, message: "Regional Office tidak ditemukan.", rows };
  }

  if (action === "IDLE_TO_BUFFER") {
    // Convert idle → buffer on the same RO (toRo ignored; uses fromRo)
    if (from.idleUnits < units) {
      return {
        ok: false,
        message: `${fromRo} hanya punya ${from.idleUnits} unit idle.`,
        rows,
      };
    }
    from.idleUnits -= units;
    from.bufferUnits += units;
    const updated = next.map((r) =>
      r.regionalOffice === fromRo
        ? recalc({
            regionalOffice: from.regionalOffice,
            totalUnits: from.totalUnits,
            bufferUnits: from.bufferUnits,
            deployedUnits: from.deployedUnits,
            idleUnits: from.idleUnits,
          })
        : r
    );
    return {
      ok: true,
      message: `${units} unit idle di ${fromRo} dialihkan ke buffer.`,
      rows: updated,
    };
  }

  const available =
    action === "POOLING" ? from.idleUnits + from.bufferUnits : from.bufferUnits;

  if (available < units) {
    return {
      ok: false,
      message: `${fromRo} tidak punya cukup unit untuk ${action} (${available} tersedia).`,
      rows,
    };
  }

  let remaining = units;
  if (action === "POOLING") {
    const fromIdle = Math.min(from.idleUnits, remaining);
    from.idleUnits -= fromIdle;
    remaining -= fromIdle;
    if (remaining > 0) {
      from.bufferUnits -= remaining;
    }
  } else {
    from.bufferUnits -= units;
  }

  to.bufferUnits += units;
  from.totalUnits -= units;
  to.totalUnits += units;

  const updated = next.map((r) => {
    if (r.regionalOffice === fromRo) {
      return recalc({
        regionalOffice: from.regionalOffice,
        totalUnits: from.totalUnits,
        bufferUnits: from.bufferUnits,
        deployedUnits: from.deployedUnits,
        idleUnits: from.idleUnits,
      });
    }
    if (r.regionalOffice === toRo) {
      return recalc({
        regionalOffice: to.regionalOffice,
        totalUnits: to.totalUnits,
        bufferUnits: to.bufferUnits,
        deployedUnits: to.deployedUnits,
        idleUnits: to.idleUnits,
      });
    }
    return r;
  });

  return {
    ok: true,
    message: `${units} unit ${action === "POOLING" ? "di-pooling" : "ditransfer"} dari ${fromRo} ke ${toRo}.`,
    rows: updated,
  };
}

export function surplusSourceRos(rows: BufferStockRow[]): BufferStockRow[] {
  return rows.filter(
    (r) => !r.belowThreshold && (r.idleUnits > 0 || r.bufferUnits > r.totalUnits * 0.1)
  );
}
