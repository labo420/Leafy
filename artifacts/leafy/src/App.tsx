import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";

// Pages
import Home from "@/pages/Home";
import Scan from "@/pages/Scan";
import History from "@/pages/History";
import Marketplace from "@/pages/Marketplace";
import Profile from "@/pages/Profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/scan" component={Scan} />
      <Route path="/storico" component={History} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/profilo" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppLayout>
            <Router />
          </AppLayout>
        </WouterRouter>
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
