import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppShell, clearLocalStorageFilters } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface DiagnosticCheck {
  id: string;
  label: string;
  testId: string;
  status: 'pending' | 'pass' | 'fail';
}

export default function AdminDiagnostics() {
  const { user, profile, userRole, loading } = useAuth();
  const [checks, setChecks] = useState<DiagnosticCheck[]>([
    { id: 'app-shell', label: 'App Shell sichtbar', testId: 'app-shell', status: 'pending' },
    { id: 'main-nav', label: 'Navigation vorhanden', testId: 'main-nav', status: 'pending' },
    { id: 'nav-dashboard', label: 'Nav: Dashboard', testId: 'nav-dashboard', status: 'pending' },
    { id: 'nav-berichte', label: 'Nav: Berichte', testId: 'nav-berichte', status: 'pending' },
    { id: 'nav-lv', label: 'Nav: LV-Verwaltung', testId: 'nav-lv', status: 'pending' },
  ]);
  const [isClearing, setIsClearing] = useState(false);

  // Run DOM assertions on mount
  useEffect(() => {
    const runChecks = () => {
      setChecks(prev => prev.map(check => {
        const element = document.querySelector(`[data-testid="${check.testId}"]`);
        return {
          ...check,
          status: element ? 'pass' : 'fail'
        };
      }));
    };

    // Wait for DOM to settle
    const timeout = setTimeout(runChecks, 500);
    return () => clearTimeout(timeout);
  }, []);

  const handleClearLocalData = () => {
    setIsClearing(true);
    clearLocalStorageFilters();
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const handleForceNavRender = () => {
    // Force a re-render by reloading
    window.location.reload();
  };

  const authContextReady = !loading && (userRole !== null || user !== null);

  const StatusIcon = ({ status }: { status: 'pending' | 'pass' | 'fail' }) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />;
    }
  };

  return (
    <AppShell>
      <AppLayout>
        <div data-testid="diagnostics-page" className="content-container animate-fade-in">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Admin Diagnostics</h1>
            <p className="text-muted-foreground mt-1">System-Diagnose und Assertions</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Auth Context Status */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Auth Context Status
                  {authContextReady ? (
                    <Badge data-testid="auth-context-ready" variant="default" className="bg-success text-success-foreground">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Ready
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Loading
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Aktueller Authentifizierungsstatus</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">User ID:</p>
                    <p className="font-mono text-xs truncate">{user?.id || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Role:</p>
                    <p className="font-medium">{userRole || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Name:</p>
                    <p className="font-medium">{profile?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email:</p>
                    <p className="font-medium">{profile?.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">isLoading:</p>
                    <p className="font-medium">{loading ? 'true' : 'false'}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleForceNavRender}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Admin-Shell testen
                  </Button>
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
                </div>
              </CardContent>
            </Card>

            {/* DOM Assertions */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>DOM Assertions</CardTitle>
                <CardDescription>Prüfung der data-testid Marker</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {checks.map(check => (
                    <div key={check.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={check.status} />
                        <span className="text-sm">{check.label}</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">
                        {check.testId}
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Gesamt:</span>
                    <Badge variant={checks.every(c => c.status === 'pass') ? 'default' : 'secondary'}>
                      {checks.filter(c => c.status === 'pass').length}/{checks.length} PASS
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assigned Kolonnen (for BAULEITER context) */}
            <Card className="card-elevated lg:col-span-2">
              <CardHeader>
                <CardTitle>Zugewiesene Kolonnen</CardTitle>
                <CardDescription>IDs der zugewiesenen Kolonnen (für BAULEITER-Rolle)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span className="text-sm text-muted-foreground">
                    Kolonnenzuweisungen werden aus der Datenbank geladen
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </AppShell>
  );
}
