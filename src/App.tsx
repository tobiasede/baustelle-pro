import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import LVVerwaltung from "./pages/LVVerwaltung";
import KolonnenZuweisung from "./pages/KolonnenZuweisung";
import Tagesmeldung from "./pages/Tagesmeldung";
import Berichte from "./pages/Berichte";
import NotFound from "./pages/NotFound";
import AdminDiagnostics from "./pages/AdminDiagnostics";
import AdminDataInspector from "./pages/AdminDataInspector";

// Admin pages
import AdminUsersPage from "./features/users/AdminUsersPage";
import AdminKolonnenPage from "./features/kolonnen/AdminKolonnenPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // During loading, show a minimal loading state but don't block completely
  // The AppShell and AppLayout will show default navigation
  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Authentifizierung wird geladen...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <AppShell>{children}</AppShell>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lv-verwaltung"
        element={
          <ProtectedRoute>
            <LVVerwaltung />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kolonnen-zuweisung"
        element={
          <ProtectedRoute>
            <KolonnenZuweisung />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tagesmeldung"
        element={
          <ProtectedRoute>
            <Tagesmeldung />
          </ProtectedRoute>
        }
      />
      <Route
        path="/berichte"
        element={
          <ProtectedRoute>
            <Berichte />
          </ProtectedRoute>
        }
      />
      {/* Admin routes */}
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <AdminUsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/kolonnen"
        element={
          <ProtectedRoute>
            <AdminKolonnenPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/diagnostics"
        element={
          <ProtectedRoute>
            <AdminDiagnostics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/data-inspector"
        element={
          <ProtectedRoute>
            <AdminDataInspector />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
