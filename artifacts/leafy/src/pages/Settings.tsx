import React, { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Bell, Globe, Lock, Mail, ShieldCheck, Trash2, User, LogOut, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@workspace/replit-auth-web";

export default function Settings() {
  const { user, logout } = useAuth();
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [challengeAlerts, setChallengeAlerts] = useState(true);

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || `Utente #${user.id}`
    : "—";
  const displayEmail = user?.email ?? "—";

  const handleDeleteAccount = () => {
    toast.error("Funzione non ancora disponibile.");
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <div className="min-h-full pb-10">
      {/* Header */}
      <div className="bg-primary pt-12 pb-8 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="flex items-center gap-3 relative z-10">
          <Link href="/profilo">
            <button className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center text-white backdrop-blur-md hover:bg-black/20 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="font-display font-bold text-2xl text-primary-foreground">Impostazioni</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">

        {/* Account */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-2">Account</p>
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-0 divide-y divide-border/50">
              <SettingsRow icon={<User className="w-4 h-4 text-primary" />} label="Nome utente" value={displayName} />
              <SettingsRow icon={<Mail className="w-4 h-4 text-primary" />} label="Email" value={displayEmail} />
            </CardContent>
          </Card>
        </section>

        {/* Notifiche */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-2">Notifiche</p>
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-0 divide-y divide-border/50">
              <ToggleRow
                icon={<Bell className="w-4 h-4 text-primary" />}
                label="Notifiche push"
                description="Avvisi su punti e sfide"
                value={pushNotifications}
                onChange={setPushNotifications}
              />
              <ToggleRow
                icon={<Mail className="w-4 h-4 text-primary" />}
                label="Notifiche email"
                description="Aggiornamenti settimanali via email"
                value={emailNotifications}
                onChange={setEmailNotifications}
              />
              <ToggleRow
                icon={<Globe className="w-4 h-4 text-primary" />}
                label="Report settimanale"
                description="Riepilogo del tuo impatto verde"
                value={weeklyReport}
                onChange={setWeeklyReport}
              />
              <ToggleRow
                icon={<Bell className="w-4 h-4 text-accent" />}
                label="Avvisi sfide"
                description="Promemoria scadenze sfide mensili"
                value={challengeAlerts}
                onChange={setChallengeAlerts}
              />
            </CardContent>
          </Card>
        </section>

        {/* Privacy e Sicurezza */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-2">Privacy e Sicurezza</p>
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-0 divide-y divide-border/50">
              <SettingsRow icon={<ShieldCheck className="w-4 h-4 text-primary" />} label="Informativa Privacy" tappable />
              <SettingsRow icon={<Lock className="w-4 h-4 text-primary" />} label="Termini di Servizio" tappable />
              <SettingsRow icon={<Globe className="w-4 h-4 text-primary" />} label="Lingua" value="Italiano" tappable />
            </CardContent>
          </Card>
        </section>

        {/* Zona Pericolo */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-2">Zona Pericolo</p>
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <button
                onClick={handleDeleteAccount}
                className="w-full flex items-center gap-3 px-4 py-4 text-destructive hover:bg-destructive/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <span className="font-medium text-sm">Cancella account</span>
              </button>
            </CardContent>
          </Card>
        </section>

        {/* Versione */}
        <p className="text-center text-xs text-muted-foreground pt-2">Leafy v1.0.0 — Sustainability Loyalty Platform</p>

        {/* Logout */}
        <Button
          variant="ghost-muted"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" /> Disconnetti
        </Button>
      </div>
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  tappable,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  tappable?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${tappable ? "hover:bg-muted/40 transition-colors cursor-pointer" : ""}`}>
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <span className="flex-1 font-medium text-sm text-foreground">{label}</span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {tappable && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
