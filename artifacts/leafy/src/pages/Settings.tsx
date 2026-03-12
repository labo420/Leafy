import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, User, Bell, Shield, Globe, LogOut, 
  ChevronRight, Mail, Smartphone, Eye, Trash2 
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Settings() {
  const [pushNotif, setPushNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState(true);

  return (
    <div className="p-6 pt-8 space-y-6 pb-8">
      <header className="flex items-center gap-3">
        <Link href="/profilo">
          <button className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="font-display font-bold text-2xl text-foreground">Impostazioni</h1>
      </header>

      <section className="space-y-3">
        <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
          <User className="w-4 h-4" /> Account
        </h3>
        <Card className="border-border/50">
          <CardContent className="p-0 divide-y divide-border/50">
            <SettingsRow label="Nome utente" value="Marco" />
            <SettingsRow label="Email" value="marco@leafy.app" />
            <SettingsRow label="Livello" value="Argento" />
            <SettingsRow label="ID utente" value="#00001" />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Notifiche
        </h3>
        <Card className="border-border/50">
          <CardContent className="p-0 divide-y divide-border/50">
            <ToggleRow 
              icon={<Smartphone className="w-4 h-4 text-primary" />} 
              label="Notifiche Push" 
              description="Sfide, badge e premi" 
              checked={pushNotif} 
              onCheckedChange={setPushNotif} 
            />
            <ToggleRow 
              icon={<Mail className="w-4 h-4 text-primary" />} 
              label="Notifiche Email" 
              description="Riepilogo settimanale e novità" 
              checked={emailNotif} 
              onCheckedChange={setEmailNotif} 
            />
            <ToggleRow 
              icon={<Eye className="w-4 h-4 text-primary" />} 
              label="Report Settimanale" 
              description="Il tuo impatto verde della settimana" 
              checked={weeklyReport} 
              onCheckedChange={setWeeklyReport} 
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
          <Globe className="w-4 h-4" /> Lingua e Regione
        </h3>
        <Card className="border-border/50">
          <CardContent className="p-0 divide-y divide-border/50">
            <SettingsRow label="Lingua" value="Italiano" chevron />
            <SettingsRow label="Regione" value="Italia" chevron />
            <SettingsRow label="Valuta punti" value="EUR" chevron />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Privacy e Dati
        </h3>
        <Card className="border-border/50">
          <CardContent className="p-0 divide-y divide-border/50">
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
              onClick={() => toast.info("Funzionalità in arrivo")}>
              <span className="text-sm font-medium text-foreground">Scarica i tuoi dati</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button className="w-full flex items-center justify-between p-4 hover:bg-destructive/5 transition-colors text-left"
              onClick={() => toast.error("Funzionalità in arrivo")}>
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">Elimina account</span>
              </div>
              <ChevronRight className="w-4 h-4 text-destructive/50" />
            </button>
          </CardContent>
        </Card>
      </section>

      <Button 
        variant="ghost" 
        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => toast.info("Disconnessione non disponibile in demo")}
      >
        <LogOut className="w-4 h-4 mr-2" /> Disconnetti
      </Button>

      <p className="text-center text-[10px] text-muted-foreground pt-2">Leafy v1.0.0 — Made with 🌱</p>
    </div>
  );
}

function SettingsRow({ label, value, chevron }: { label: string; value: string; chevron?: boolean }) {
  return (
    <div className="flex items-center justify-between p-4">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">{value}</span>
        {chevron && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </div>
    </div>
  );
}

function ToggleRow({ icon, label, description, checked, onCheckedChange }: { 
  icon: React.ReactNode; label: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void 
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
