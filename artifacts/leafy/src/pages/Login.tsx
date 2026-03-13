import { useState } from "react";
import { Leaf, Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook } from "react-icons/fa";

type Mode = "login" | "register";

interface LoginPageProps {
  onSuccess: () => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Inserisci email e password.");
      return;
    }
    if (mode === "register" && !username.trim()) {
      setError("Inserisci un nome utente.");
      return;
    }
    if (password.length < 8) {
      setError("La password deve essere di almeno 8 caratteri.");
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, username };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Si è verificato un errore.");
        return;
      }

      onSuccess();
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = "/api/auth/google";
  };

  const handleFacebook = () => {
    window.location.href = "/api/auth/facebook";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-10">
      <div className="flex flex-col items-center gap-5 w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <Leaf className="w-8 h-8 text-primary-foreground" />
        </div>

        <div className="text-center">
          <h1 className="font-display font-bold text-2xl text-foreground">Leafy</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === "login"
              ? "Bentornato! Accedi al tuo account."
              : "Crea il tuo account gratuito."}
          </p>
        </div>

        <div className="flex w-full rounded-xl bg-muted/50 p-1 gap-1">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === "login"
                ? "bg-card shadow text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Accedi
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === "register"
                ? "bg-card shadow text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Registrati
          </button>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          {mode === "register" && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Nome utente"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoComplete="name"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoComplete="email"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password (min. 8 caratteri)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-11 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 text-sm"
          >
            {loading
              ? "Caricamento…"
              : mode === "login"
              ? "Accedi"
              : "Crea account"}
          </button>
        </form>

        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">oppure</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex flex-col gap-2.5 w-full">
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border bg-card hover:bg-muted/50 active:scale-95 transition-all text-sm font-medium text-foreground"
          >
            <FcGoogle className="w-5 h-5" />
            Continua con Google
          </button>

          <button
            type="button"
            onClick={handleFacebook}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border bg-card hover:bg-muted/50 active:scale-95 transition-all text-sm font-medium text-foreground"
          >
            <FaFacebook className="w-5 h-5 text-[#1877F2]" />
            Continua con Facebook
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Accedendo accetti i nostri Termini di Servizio e la Privacy Policy.
        </p>
      </div>
    </div>
  );
}
