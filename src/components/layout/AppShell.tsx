import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface AppShellProps {
  children: ReactNode;
}

const AUTH_TIMEOUT_MS = 4000;

/**
 * Clear localStorage keys related to filters (berichte, lv, kolonnen)
 */
function clearLocalStorageFilters() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('berichte:') || key.startsWith('lv:') || key.startsWith('kolonnen:'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

export function AppShell({ children }: AppShellProps) {
  const { loading, user, userRole } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setTimedOut(true);
      }, AUTH_TIMEOUT_MS);

      return () => clearTimeout(timeout);
    } else {
      setTimedOut(false);
    }
  }, [loading]);

  const handleClearLocalData = useCallback(() => {
    setIsClearing(true);
    clearLocalStorageFilters();
    // Reload the page to re-hydrate
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }, []);

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  // Show fallback banner when auth times out
  const showFallbackBanner = timedOut && loading;

  return (
    <div data-testid="app-shell" className="min-h-screen bg-background">
      {showFallbackBanner && (
        <Alert 
          data-testid="auth-fallback-banner" 
          className="rounded-none border-x-0 border-t-0 bg-warning/10 border-warning/30"
        >
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-warning-foreground">
              Verbindung langsam – Navigation geladen mit Standardrechten
            </span>
            <div className="flex gap-2">
              <Button
                data-testid="clear-local-btn"
                variant="outline"
                size="sm"
                onClick={handleClearLocalData}
                disabled={isClearing}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Lokale Daten löschen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Erneut versuchen
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      {children}
    </div>
  );
}

export { clearLocalStorageFilters };
