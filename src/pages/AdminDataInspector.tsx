import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, AlertCircle, Database, RefreshCw, Shield, Check, X, Plus } from 'lucide-react';
import { createKolonne } from '@/services/kolonnen';
import { createLV } from '@/services/lv';
import { createProject } from '@/services/projects';
import { assign } from '@/services/assignments';

interface TableInfo {
  name: string;
  count: number;
  rows: Record<string, unknown>[];
  error: string | null;
  rlsSelect: 'allowed' | 'blocked' | 'checking';
  rlsInsert: 'allowed' | 'blocked' | 'checking';
}

const TABLES_TO_INSPECT = ['kolonnen', 'lvs', 'kolonne_lv_assignments', 'leistungsmeldung_tags', 'projects', 'profiles'] as const;

export default function AdminDataInspector() {
  const { isHostOrGF, user } = useAuth();
  const [tables, setTables] = useState<Record<string, TableInfo>>({});
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState<string | null>(null);

  const fetchTableInfo = useCallback(async (tableName: typeof TABLES_TO_INSPECT[number]): Promise<TableInfo> => {
    const info: TableInfo = {
      name: tableName,
      count: 0,
      rows: [],
      error: null,
      rlsSelect: 'checking',
      rlsInsert: 'checking',
    };

    try {
      // Use type-safe table queries
      let result;
      switch (tableName) {
        case 'kolonnen':
          result = await supabase.from('kolonnen').select('*', { count: 'exact' }).limit(10);
          break;
        case 'lvs':
          result = await supabase.from('lvs').select('*', { count: 'exact' }).limit(10);
          break;
        case 'kolonne_lv_assignments':
          result = await supabase.from('kolonne_lv_assignments').select('*', { count: 'exact' }).limit(10);
          break;
        case 'leistungsmeldung_tags':
          result = await supabase.from('leistungsmeldung_tags').select('*', { count: 'exact' }).limit(10);
          break;
        case 'projects':
          result = await supabase.from('projects').select('*', { count: 'exact' }).limit(10);
          break;
        case 'profiles':
          result = await supabase.from('profiles').select('*', { count: 'exact' }).limit(10);
          break;
        default:
          throw new Error(`Unknown table: ${tableName}`);
      }

      const { data, error, count } = result;

      if (error) {
        info.error = `${error.code}: ${error.message}`;
        info.rlsSelect = error.code === '42501' ? 'blocked' : 'allowed';
      } else {
        info.count = count ?? 0;
        info.rows = (data || []) as Record<string, unknown>[];
        info.rlsSelect = 'allowed';
      }
    } catch (e) {
      info.error = e instanceof Error ? e.message : 'Unknown error';
      info.rlsSelect = 'blocked';
    }

    // Don't probe insert for profiles (handled by trigger)
    if (tableName === 'profiles') {
      info.rlsInsert = 'allowed'; // Managed by trigger
    } else {
      info.rlsInsert = info.rlsSelect === 'allowed' ? 'allowed' : 'blocked';
    }

    return info;
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    const results: Record<string, TableInfo> = {};
    
    await Promise.all(
      TABLES_TO_INSPECT.map(async (tableName) => {
        results[tableName] = await fetchTableInfo(tableName);
      })
    );

    setTables(results);
    setLoading(false);
  }, [fetchTableInfo]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleSeedKolonnen = async () => {
    setSeeding('kolonnen');
    const kolonnenToSeed = [
      { number: '1031', project: 'Testprojekt' },
      { number: '1036', project: 'Testprojekt' },
      { number: '2007', project: 'EnBW Projekt' },
    ];

    let created = 0;
    for (const k of kolonnenToSeed) {
      const result = await createKolonne(k);
      if (result.data) created++;
    }
    
    toast.success(`${created} Kolonnen angelegt/aktualisiert`);
    await refreshAll();
    setSeeding(null);
  };

  const handleSeedProjectsLVs = async () => {
    setSeeding('projects');
    
    // Create project
    const projectResult = await createProject({ name: 'Testprojekt A', code: 'TP-A' });
    const projectId = projectResult.data?.id;

    // Create LVs
    const lvsToSeed = [
      { name: 'DTAG Teningen', project: 'DTAG', project_id: projectId, valid_from: '2026-01-01', valid_to: '2026-12-31', created_by: user?.id },
      { name: 'EnBW Mitte', project: 'EnBW', project_id: projectId, valid_from: '2026-01-01', valid_to: '2026-12-31', created_by: user?.id },
    ];

    let created = 0;
    for (const lv of lvsToSeed) {
      const result = await createLV(lv);
      if (result.data) created++;
    }

    toast.success(`Projekt + ${created} LVs angelegt`);
    await refreshAll();
    setSeeding(null);
  };

  const handleSeedAssignments = async () => {
    setSeeding('assignments');
    
    // Get kolonnen and lvs
    const { data: kolonnen } = await supabase.from('kolonnen').select('id, number');
    const { data: lvs } = await supabase.from('lvs').select('id, name');

    if (!kolonnen?.length || !lvs?.length) {
      toast.error('Erst Kolonnen und LVs anlegen');
      setSeeding(null);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    let created = 0;

    // Find DTAG and EnBW LVs
    const dtagLv = lvs.find(l => l.name.includes('DTAG'));
    const enbwLv = lvs.find(l => l.name.includes('EnBW'));

    for (const k of kolonnen) {
      const lvToAssign = k.number === '2007' ? enbwLv : dtagLv;
      if (lvToAssign) {
        const result = await assign({
          kolonne_id: k.id,
          lv_id: lvToAssign.id,
          valid_from: today,
          assigned_by: user?.id,
        });
        if (result.data) created++;
      }
    }

    toast.success(`${created} Zuweisungen erstellt`);
    await refreshAll();
    setSeeding(null);
  };

  const maskPII = (value: unknown, field: string): string => {
    if (value === null || value === undefined) return '—';
    const strVal = String(value);
    if (field === 'email' && strVal.includes('@')) {
      const [name, domain] = strVal.split('@');
      return `${name.slice(0, 2)}***@${domain}`;
    }
    if (field === 'foreman_id' || field === 'user_id' || field === 'assigned_by' || field === 'created_by') {
      return strVal.slice(0, 8) + '...';
    }
    return strVal.length > 30 ? strVal.slice(0, 30) + '...' : strVal;
  };

  const renderRLSBadge = (status: 'allowed' | 'blocked' | 'checking', testId: string) => {
    if (status === 'checking') {
      return <Badge variant="secondary">Prüfung...</Badge>;
    }
    if (status === 'blocked') {
      return (
        <Badge variant="destructive" data-testid={testId}>
          <X className="w-3 h-3 mr-1" /> RLS blockiert
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="bg-success">
        <Check className="w-3 h-3 mr-1" /> Erlaubt
      </Badge>
    );
  };

  if (!isHostOrGF) {
    return (
      <AppLayout>
        <div className="content-container" data-testid="guard-403">
          <Card className="card-elevated border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Zugriff verweigert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Sie haben keine Berechtigung, diese Seite anzuzeigen.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="content-container animate-fade-in" data-testid="admin-data-inspector">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Daten-Inspektor</h1>
            <p className="text-muted-foreground">Tabellen, Zähler und RLS-Status</p>
          </div>
          <Button onClick={refreshAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>

        {/* Environment Info */}
        <Card className="card-elevated mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Umgebung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Supabase URL:</span>
                <Badge variant="secondary" className="ml-2">
                  {import.meta.env.VITE_SUPABASE_URL ? '✓ Konfiguriert' : '✗ Fehlt'}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Anon Key:</span>
                <Badge variant="secondary" className="ml-2">
                  {import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? '✓ Konfiguriert' : '✗ Fehlt'}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Angemeldeter Benutzer:</span>
                <Badge variant="outline" className="ml-2">
                  {user?.email || 'Nicht angemeldet'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seed Panel */}
        <Card className="card-elevated mb-6 border-info/30 bg-info/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Testdaten anlegen (Seed)
            </CardTitle>
            <CardDescription>Idempotent – bereits vorhandene Einträge werden nicht dupliziert</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                onClick={handleSeedKolonnen}
                disabled={seeding !== null}
              >
                {seeding === 'kolonnen' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Seed Kolonnen (1031, 1036, 2007)
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSeedProjectsLVs}
                disabled={seeding !== null}
              >
                {seeding === 'projects' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Seed Projects + LV Versions
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSeedAssignments}
                disabled={seeding !== null}
              >
                {seeding === 'assignments' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Seed Assignments
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tables */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {TABLES_TO_INSPECT.map((tableName) => {
              const info = tables[tableName];
              if (!info) return null;

              return (
                <Card key={tableName} className="card-elevated" data-testid={`section-${tableName}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        {tableName}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" data-testid={`count-${tableName}`}>
                          {info.count} Einträge
                        </Badge>
                        {renderRLSBadge(info.rlsSelect, `rls-${tableName}-select`)}
                      </div>
                    </div>
                    {info.error && (
                      <p className="text-sm text-destructive mt-2">{info.error}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    {info.rows.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Keine Einträge vorhanden</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {Object.keys(info.rows[0]).slice(0, 6).map((key) => (
                                <TableHead key={key}>{key}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {info.rows.slice(0, 5).map((row, idx) => (
                              <TableRow key={idx}>
                                {Object.entries(row).slice(0, 6).map(([key, value]) => (
                                  <TableCell key={key} className="text-sm">
                                    {maskPII(value, key)}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {info.rows.length > 5 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            ... und {info.count - 5} weitere
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
