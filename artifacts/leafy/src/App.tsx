import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { Onboarding } from "@/components/shared/Onboarding";
import NotFound from "@/pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";
import { Leaf } from "lucide-react";

// Pages
import Home from "@/pages/Home";
import Scan from "@/pages/Scan";
import History from "@/pages/History";
import Marketplace from "@/pages/Marketplace";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function LoginScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-6 max-w-xs w-full">
        <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center shadow-lg">
          <Leaf className="w-10 h-10 text-primary-foreground" />
        </div>
        <div className="text-center">
          <h1 className="font-display font-bold text-3xl text-foreground mb-2">Leafy</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Scansiona gli scontrini, guadagna punti per i prodotti sostenibili e scala la classifica verde.
          </p>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Accedendo accetti i nostri Termini di Servizio e la Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
          <Leaf className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      </div>
    </div>
  );
}

function AppRouter() {
  const [location] = useLocation();
  const isAdmin = location === "/admin";

  if (isAdmin) {
    return <Admin />;
  }

  return (
    <AppLayout>
      <Onboarding />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/scan" component={Scan} />
        <Route path="/storico" component={History} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/profilo" component={Profile} />
        <Route path="/impostazioni" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function AuthGate() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoginScreen />;

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AppRouter />
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGate />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              borderRadius: '1rem',
              border: '1px solid hsl(var(--border) / 0.5)',
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
            }
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
