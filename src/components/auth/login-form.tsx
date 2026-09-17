"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { DEMO_PASSWORD } from "@/config/rbac.config";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const { refresh } = useAuth();

  const [email, setEmail] = useState("admin@edc.local");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        error?: string;
        attendance?: {
          status: string;
          note?: string | null;
          shiftType?: string | null;
        } | null;
      };
      if (!res.ok) {
        setError(data.error || "Login gagal");
        return;
      }
      if (data.attendance) {
        try {
          sessionStorage.setItem(
            "edc_login_attendance",
            JSON.stringify(data.attendance)
          );
        } catch {
          // ignore
        }
      }
      // Reload auth context so nav permissions appear after cookie is set.
      await refresh();
      router.replace(next);
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background">
              <Radio className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base text-foreground">EDC Manager</CardTitle>
              <p className="text-xs text-muted-foreground">Sign in to Operations Command Center</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Email</span>
              <input
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Password</span>
              <input
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p className="text-xs text-sla-breached">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Demo: <span className="font-mono">admin@edc.local</span> /{" "}
              <span className="font-mono">{DEMO_PASSWORD}</span>
              <br />
              Role lain: andi.noc@edc.local · dewi.supervisor@edc.local · rudi.ops@edc.local ·
              hendra.gm@edc.local · eko.tech@edc.local (password sama)
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
