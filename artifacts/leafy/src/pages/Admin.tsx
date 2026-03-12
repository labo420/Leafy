import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, BarChart3, Tag, Target, Trash2, Plus, Eye, EyeOff, Users, Receipt, Star } from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL}api`;

type Stats = {
  users: number;
  receipts: number;
  totalPointsAwarded: number;
  vouchers: number;
  challenges: number;
  topUsers: Array<{ id: number; username: string; totalPoints: number; streak: number }>;
};

type Voucher = {
  id: number; title: string; brandName: string; category: string;
  pointsCost: number; discount: string; isActive: boolean; stock: number | null;
};

type Challenge = {
  id: number; title: string; category: string; emoji: string;
  targetCount: number; rewardPoints: number; isActive: boolean; expiresAt: string;
};

function useAdminApi(password: string) {
  const headers = { "Content-Type": "application/json", "X-Admin-Password": password };

  const get = async <T>(path: string): Promise<T> => {
    const r = await fetch(`${API_BASE}/${path}`, { headers });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };
  const post = async <T>(path: string, body: unknown): Promise<T> => {
    const r = await fetch(`${API_BASE}/${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };
  const put = async <T>(path: string, body: unknown): Promise<T> => {
    const r = await fetch(`${API_BASE}/${path}`, { method: "PUT", headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };
  const del = async (path: string) => {
    const r = await fetch(`${API_BASE}/${path}`, { method: "DELETE", headers });
    if (!r.ok) throw new Error(await r.text());
  };

  return { get, post, put, del };
}

type Tab = "stats" | "vouchers" | "challenges";

export default function Admin() {
  const [password, setPassword] = useState(() => sessionStorage.getItem("leafy_admin_pw") || "");
  const [authed, setAuthed] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [tab, setTab] = useState<Tab>("stats");

  const [stats, setStats] = useState<Stats | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  const [showNewVoucher, setShowNewVoucher] = useState(false);
  const [showNewChallenge, setShowNewChallenge] = useState(false);

  const api = useAdminApi(password);

  const login = async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (r.ok) {
        sessionStorage.setItem("leafy_admin_pw", password);
        setAuthed(true);
        toast.success("Accesso admin riuscito!");
      } else {
        toast.error("Password non valida.");
      }
    } catch {
      toast.error("Errore di connessione.");
    }
  };

  useEffect(() => {
    if (authed) {
      api.get<Stats>("admin/stats").then(setStats).catch(() => toast.error("Errore nel caricare le stats"));
      api.get<Voucher[]>("admin/vouchers").then(setVouchers).catch(() => {});
      api.get<Challenge[]>("admin/challenges").then(setChallenges).catch(() => {});
    }
  }, [authed]);

  const deleteVoucher = async (id: number) => {
    if (!confirm("Eliminare questo voucher?")) return;
    try {
      await api.del(`admin/vouchers/${id}`);
      setVouchers(v => v.filter(x => x.id !== id));
      toast.success("Voucher eliminato");
    } catch { toast.error("Errore durante l'eliminazione"); }
  };

  const toggleVoucher = async (id: number, current: boolean) => {
    try {
      await api.put(`admin/vouchers/${id}`, { isActive: !current });
      setVouchers(v => v.map(x => x.id === id ? { ...x, isActive: !current } : x));
    } catch { toast.error("Errore"); }
  };

  const deleteChallenge = async (id: number) => {
    if (!confirm("Eliminare questa sfida?")) return;
    try {
      await api.del(`admin/challenges/${id}`);
      setChallenges(c => c.filter(x => x.id !== id));
      toast.success("Sfida eliminata");
    } catch { toast.error("Errore durante l'eliminazione"); }
  };

  const toggleChallenge = async (id: number, current: boolean) => {
    try {
      await api.put(`admin/challenges/${id}`, { isActive: !current });
      setChallenges(c => c.map(x => x.id === id ? { ...x, isActive: !current } : x));
    } catch { toast.error("Errore"); }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a3a2a] to-[#2D6A4F] flex items-center justify-center p-6">
        <Card className="w-full max-w-sm shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="font-display text-2xl">Admin Leafy</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Pannello di gestione riservato</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="w-full border rounded-xl px-4 py-3 pr-12 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Password amministratore"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && login()}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button className="w-full rounded-xl" onClick={login}>
              Accedi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "stats", label: "Statistiche", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "vouchers", label: "Voucher", icon: <Tag className="w-4 h-4" /> },
    { id: "challenges", label: "Sfide", icon: <Target className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-display font-bold text-foreground">Admin Leafy</span>
          </div>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Torna all'app
          </a>
        </div>
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {tab === "stats" && stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Utenti", value: stats.users, icon: <Users className="w-5 h-5 text-blue-500" />, bg: "bg-blue-50" },
                { label: "Scontrini", value: stats.receipts, icon: <Receipt className="w-5 h-5 text-green-500" />, bg: "bg-green-50" },
                { label: "Punti Totali", value: Number(stats.totalPointsAwarded).toLocaleString("it"), icon: <Star className="w-5 h-5 text-amber-500" />, bg: "bg-amber-50" },
                { label: "Voucher", value: stats.vouchers, icon: <Tag className="w-5 h-5 text-purple-500" />, bg: "bg-purple-50" },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className={`p-4 flex items-center gap-3 ${s.bg} rounded-xl`}>
                    {s.icon}
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-xl font-bold">{s.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Top Utenti per Punti</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.topUsers.map((u, i) => (
                    <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{u.username}</p>
                          <p className="text-xs text-muted-foreground">🔥 {u.streak} giorni streak</p>
                        </div>
                      </div>
                      <span className="font-bold text-primary">{u.totalPoints.toLocaleString("it")} pt</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {tab === "vouchers" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">{vouchers.length} Voucher</h2>
              <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowNewVoucher(v => !v)}>
                <Plus className="w-4 h-4" /> Nuovo Voucher
              </Button>
            </div>

            {showNewVoucher && <NewVoucherForm onSave={async (data) => {
              try {
                const v = await api.post<Voucher>("admin/vouchers", data);
                setVouchers(prev => [v, ...prev]);
                setShowNewVoucher(false);
                toast.success("Voucher creato!");
              } catch { toast.error("Errore nella creazione"); }
            }} onCancel={() => setShowNewVoucher(false)} />}

            <div className="space-y-3">
              {vouchers.map(v => (
                <Card key={v.id} className={!v.isActive ? "opacity-60" : ""}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{v.title}</p>
                        <Badge variant={v.isActive ? "default" : "secondary"} className="text-xs">
                          {v.isActive ? "Attivo" : "Disattivo"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{v.brandName} · {v.category} · {v.pointsCost} pt · {v.discount}</p>
                      {v.stock !== null && <p className="text-xs text-muted-foreground">Stock: {v.stock}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="rounded-lg h-8 px-3" onClick={() => toggleVoucher(v.id, v.isActive)}>
                        {v.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="sm" variant="destructive" className="rounded-lg h-8 px-3" onClick={() => deleteVoucher(v.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {tab === "challenges" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">{challenges.length} Sfide</h2>
              <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowNewChallenge(v => !v)}>
                <Plus className="w-4 h-4" /> Nuova Sfida
              </Button>
            </div>

            {showNewChallenge && <NewChallengeForm onSave={async (data) => {
              try {
                const c = await api.post<Challenge>("admin/challenges", data);
                setChallenges(prev => [c, ...prev]);
                setShowNewChallenge(false);
                toast.success("Sfida creata!");
              } catch { toast.error("Errore nella creazione"); }
            }} onCancel={() => setShowNewChallenge(false)} />}

            <div className="space-y-3">
              {challenges.map(c => (
                <Card key={c.id} className={!c.isActive ? "opacity-60" : ""}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span>{c.emoji}</span>
                        <p className="font-semibold text-sm">{c.title}</p>
                        <Badge variant={c.isActive ? "default" : "secondary"} className="text-xs">
                          {c.isActive ? "Attiva" : "Disattiva"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.category} · Obiettivo: {c.targetCount} · Premio: {c.rewardPoints} pt
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Scade: {new Date(c.expiresAt).toLocaleDateString("it-IT")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="rounded-lg h-8 px-3" onClick={() => toggleChallenge(c.id, c.isActive)}>
                        {c.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="sm" variant="destructive" className="rounded-lg h-8 px-3" onClick={() => deleteChallenge(c.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function NewVoucherForm({ onSave, onCancel }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", brandName: "", category: "Bio", pointsCost: 100, discount: "10%", stock: "" });
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Nuovo Voucher</h3>
        <div className="grid grid-cols-2 gap-3">
          {(["title", "description", "brandName", "discount"] as const).map(k => (
            <input key={k} type="text" placeholder={k} value={form[k]}
              onChange={e => set(k, e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-background col-span-2 last:col-span-1 focus:outline-none focus:ring-1 focus:ring-primary" />
          ))}
          <input type="number" placeholder="Punti costo" value={form.pointsCost}
            onChange={e => set("pointsCost", parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          <input type="text" placeholder="Stock (opz.)" value={form.stock}
            onChange={e => set("stock", e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          <select value={form.category} onChange={e => set("category", e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-background col-span-2 focus:outline-none focus:ring-1 focus:ring-primary">
            {["Bio", "Km 0", "Senza Plastica", "Vegano", "Equo Solidale", "DOP/IGP", "Generico"].map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="rounded-lg" onClick={() => onSave({ ...form, stock: form.stock ? parseInt(form.stock) : undefined })}>Salva</Button>
          <Button size="sm" variant="outline" className="rounded-lg" onClick={onCancel}>Annulla</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NewChallengeForm({ onSave, onCancel }: { onSave: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const [form, setForm] = useState({
    title: "", description: "", emoji: "🌿", category: "Bio",
    targetCount: 5, rewardPoints: 50, expiresAt: nextMonth.toISOString().slice(0, 10),
  });
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Nuova Sfida</h3>
        <div className="grid grid-cols-2 gap-3">
          <input type="text" placeholder="Titolo" value={form.title}
            onChange={e => set("title", e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-background col-span-2 focus:outline-none focus:ring-1 focus:ring-primary" />
          <input type="text" placeholder="Descrizione" value={form.description}
            onChange={e => set("description", e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-background col-span-2 focus:outline-none focus:ring-1 focus:ring-primary" />
          <input type="text" placeholder="Emoji" value={form.emoji}
            onChange={e => set("emoji", e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          <select value={form.category} onChange={e => set("category", e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary">
            {["Bio", "Km 0", "Senza Plastica", "Vegano", "Equo Solidale", "DOP/IGP", "tutti"].map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input type="number" placeholder="Obiettivo (n. prodotti)" value={form.targetCount}
            onChange={e => set("targetCount", parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          <input type="number" placeholder="Punti premio" value={form.rewardPoints}
            onChange={e => set("rewardPoints", parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground block mb-1">Data scadenza</label>
            <input type="date" value={form.expiresAt}
              onChange={e => set("expiresAt", e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-background w-full focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="rounded-lg" onClick={() => onSave(form)}>Salva</Button>
          <Button size="sm" variant="outline" className="rounded-lg" onClick={onCancel}>Annulla</Button>
        </div>
      </CardContent>
    </Card>
  );
}
