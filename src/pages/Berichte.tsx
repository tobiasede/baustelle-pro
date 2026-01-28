import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { SelectField } from '@/components/SelectField';
import { 
  Loader2, 
  AlertCircle, 
  BarChart3, 
  Download, 
  TrendingUp, 
  TrendingDown,
  Euro,
  Users,
  Clock,
  FileText,
  Calendar
} from 'lucide-react';
import { 
  aggregatePeriod, 
  calculateKPIs, 
  getDateRangeForPreset, 
  toISODateString 
} from '@/features/aggregation/stats';
import { PERIOD_PRESETS, type PeriodPreset, type DailyRecord } from '@/features/aggregation/types';
import { formatCurrency, formatDate } from '@/lib/numberUtils';
import { toRadixSelectValue, fromRadixSelectValue } from '@/lib/selectUtils';

interface Kolonne {
  id: string;
  number: string;
  project: string | null;
}

// Storage key for persisting filters
const FILTERS_STORAGE_KEY = 'berichte-filters';

interface StoredFilters {
  periodPreset?: PeriodPreset;
  customDateFrom?: string;
  customDateTo?: string;
  selectedKolonne?: string;
  selectedProject?: string;
}

function loadStoredFilters(): StoredFilters {
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    // Sanitize - no empty strings
    return {
      periodPreset: parsed.periodPreset || undefined,
      customDateFrom: parsed.customDateFrom || undefined,
      customDateTo: parsed.customDateTo || undefined,
      selectedKolonne: parsed.selectedKolonne || undefined,
      selectedProject: parsed.selectedProject || undefined,
    };
  } catch {
    return {};
  }
}

function saveFilters(filters: StoredFilters): void {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore storage errors
  }
}

export default function Berichte() {
  const { isHostOrGF } = useAuth();
  const [reports, setReports] = useState<DailyRecord[]>([]);
  const [kolonnen, setKolonnen] = useState<Kolonne[]>([]);
  const [loading, setLoading] = useState(true);

  // Load stored filters
  const storedFilters = useMemo(() => loadStoredFilters(), []);

  // Period selection
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(
    storedFilters.periodPreset || 'this_month'
  );
  const [customDateFrom, setCustomDateFrom] = useState<string>(
    storedFilters.customDateFrom || ''
  );
  const [customDateTo, setCustomDateTo] = useState<string>(
    storedFilters.customDateTo || ''
  );

  // Other filters
  const [selectedKolonne, setSelectedKolonne] = useState<string | undefined>(
    storedFilters.selectedKolonne
  );
  const [selectedProject, setSelectedProject] = useState<string | undefined>(
    storedFilters.selectedProject
  );

  // Computed date range
  const dateRange = useMemo(() => {
    if (periodPreset === 'custom') {
      return {
        from: customDateFrom ? new Date(customDateFrom) : new Date(),
        to: customDateTo ? new Date(customDateTo) : new Date(),
      };
    }
    return getDateRangeForPreset(periodPreset);
  }, [periodPreset, customDateFrom, customDateTo]);

  // Filter and aggregate reports
  const { filteredReports, aggregation, kpis } = useMemo(() => {
    let filtered = reports;

    // Filter by kolonne if selected
    if (selectedKolonne) {
      filtered = filtered.filter(r => r.kolonne_id === selectedKolonne);
    }

    // Filter by project if selected
    if (selectedProject) {
      filtered = filtered.filter(r => r.kolonnen?.project === selectedProject);
    }

    const agg = aggregatePeriod(filtered, dateRange);
    const calculatedKpis = calculateKPIs(agg.totals);

    return {
      filteredReports: filtered.filter(r => {
        const date = new Date(r.date);
        return date >= dateRange.from && date <= dateRange.to;
      }),
      aggregation: agg,
      kpis: calculatedKpis,
    };
  }, [reports, selectedKolonne, selectedProject, dateRange]);

  // Save filters when they change
  useEffect(() => {
    saveFilters({
      periodPreset,
      customDateFrom: customDateFrom || undefined,
      customDateTo: customDateTo || undefined,
      selectedKolonne,
      selectedProject,
    });
  }, [periodPreset, customDateFrom, customDateTo, selectedKolonne, selectedProject]);

  useEffect(() => {
    fetchFiltersData();
    fetchReports();
  }, []);

  const fetchFiltersData = async () => {
    const { data: kolResult } = await supabase
      .from('kolonnen')
      .select('*')
      .order('number');

    if (kolResult) setKolonnen(kolResult);
  };

  const fetchReports = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('leistungsmeldung_tags')
      .select('*, kolonnen(*)')
      .order('date', { ascending: false });

    if (error) {
      toast.error('Fehler beim Laden der Berichte');
      console.error(error);
    } else {
      setReports((data || []) as DailyRecord[]);
    }

    setLoading(false);
  };

  const handleExportCSV = () => {
    if (filteredReports.length === 0) {
      toast.error('Keine Daten zum Exportieren');
      return;
    }

    const headers = ['Datum', 'Kolonne', 'Projekt', 'Mitarbeiter', 'Stunden/MA', 'Umsatz PLAN', 'Umsatz IST', 'Umsatz/MA', 'Umsatz/Std'];
    const rows = filteredReports.map(r => [
      r.date,
      r.kolonnen?.number || '',
      r.kolonnen?.project || '',
      r.employees_count,
      r.hours_per_employee,
      r.planned_revenue,
      r.actual_revenue,
      r.rev_per_employee || '',
      r.rev_per_hour || ''
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leistungsmeldung_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('CSV-Export erfolgreich');
  };

  const projects = [...new Set(kolonnen.map(k => k.project).filter(Boolean))] as string[];
  
  // Build options for SelectField
  const periodOptions = PERIOD_PRESETS.map(p => ({ label: p.label, value: p.value }));
  const kolonneOptions = kolonnen.map(k => ({ 
    label: `${k.number}${k.project ? ` (${k.project})` : ''}`, 
    value: k.id 
  }));
  const projectOptions = projects.map(p => ({ label: p, value: p }));

  if (!isHostOrGF) {
    return (
      <AppLayout>
        <div className="content-container">
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
      <div className="content-container animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Berichte</h1>
            <p className="text-muted-foreground">Auswertungen und KPIs</p>
          </div>
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            CSV exportieren
          </Button>
        </div>

        {/* Filters */}
        <Card className="card-elevated mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Period Preset */}
              <SelectField
                label="Zeitraum"
                value={periodPreset}
                onChange={(v) => setPeriodPreset((v as PeriodPreset) || 'this_month')}
                options={periodOptions}
                placeholder="Zeitraum wählen"
              />

              {/* Custom Date Range */}
              {periodPreset === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label>Von</Label>
                    <Input
                      type="date"
                      value={customDateFrom}
                      onChange={(e) => setCustomDateFrom(e.target.value)}
                      max={customDateTo || undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bis</Label>
                    <Input
                      type="date"
                      value={customDateTo}
                      onChange={(e) => setCustomDateTo(e.target.value)}
                      min={customDateFrom || undefined}
                    />
                  </div>
                </>
              )}

              {/* Kolonne Filter */}
              <SelectField
                label="Kolonne"
                value={selectedKolonne}
                onChange={setSelectedKolonne}
                options={kolonneOptions}
                placeholder="Alle Kolonnen"
                allowEmpty
                emptyLabel="Alle Kolonnen"
              />

              {/* Project Filter */}
              <SelectField
                label="Projekt"
                value={selectedProject}
                onChange={setSelectedProject}
                options={projectOptions}
                placeholder="Alle Projekte"
                allowEmpty
                emptyLabel="Alle Projekte"
              />
            </div>

            {/* Show selected date range */}
            <div className="mt-4 text-sm text-muted-foreground">
              Zeitraum: {formatDate(dateRange.from)} – {formatDate(dateRange.to)}
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          {/* Contributing Crews */}
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Kolonnen mit Werten</p>
                  <p className="text-2xl font-bold">{aggregation.contributingCrewsCount}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Planned Revenue */}
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Umsatz (PLAN)</p>
                  <p className="text-2xl font-bold">{formatCurrency(aggregation.totals.totalPlanned)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actual Revenue */}
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Umsatz (IST)</p>
                  <p className="text-2xl font-bold">{formatCurrency(aggregation.totals.totalActual)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Euro className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delta */}
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Delta (IST-PLAN)</p>
                  <p className={`text-2xl font-bold ${kpis.deltaPositive ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(kpis.delta)}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpis.deltaPositive ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  {kpis.deltaPositive ? (
                    <TrendingUp className="w-5 h-5 text-success" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-destructive" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue per Employee */}
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ø Umsatz/MA/AT</p>
                  <p className="text-2xl font-bold">
                    {aggregation.contributingCrewsCount > 0 
                      ? formatCurrency(kpis.avgRevPerEmployee) 
                      : '—'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue per Hour */}
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ø Umsatz/MA/Std</p>
                  <p className="text-2xl font-bold">
                    {aggregation.contributingCrewsCount > 0 
                      ? formatCurrency(kpis.avgRevPerHour) 
                      : '—'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Tagesmeldungen
            </CardTitle>
            <CardDescription>
              {filteredReports.length} Einträge im gewählten Zeitraum
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : aggregation.contributingCrewsCount === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Keine Werte im gewählten Zeitraum</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Passen Sie den Zeitraum oder die Filter an.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Kolonne</TableHead>
                      <TableHead>Projekt</TableHead>
                      <TableHead className="text-center">MA</TableHead>
                      <TableHead className="text-center">Std/MA</TableHead>
                      <TableHead className="text-right">PLAN (€)</TableHead>
                      <TableHead className="text-right">IST (€)</TableHead>
                      <TableHead className="text-right">€/MA</TableHead>
                      <TableHead className="text-right">€/Std</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>{formatDate(report.date)}</TableCell>
                        <TableCell className="font-medium">{report.kolonnen?.number}</TableCell>
                        <TableCell>{report.kolonnen?.project || '-'}</TableCell>
                        <TableCell className="text-center">{report.employees_count}</TableCell>
                        <TableCell className="text-center">{Number(report.hours_per_employee).toFixed(1)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(report.planned_revenue))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(report.actual_revenue))}</TableCell>
                        <TableCell className="text-right">
                          {report.rev_per_employee ? formatCurrency(Number(report.rev_per_employee)) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {report.rev_per_hour ? formatCurrency(Number(report.rev_per_hour)) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
