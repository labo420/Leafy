import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { Onboarding } from "@/components/shared/Onboarding";
import NotFound from "@/pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";
import { Leaf } from "lucide-react";
import LoginPage from "@/pages/Login";
import ProfileDemo from "@/pages/ProfileDemo";

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
  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => window.location.reload()} />;
  }

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AppRouter />
    </WouterRouter>
  );
}

function isDemoRoute(): boolean {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const path = window.location.pathname;
  return path === `${base}/demo` || path === `${base}/demo/`;
}

function App() {
  const showDemo = isDemoRoute();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {showDemo ? <ProfileDemo /> : <AuthGate />}
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
