import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
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
  FileText
} from 'lucide-react';

interface Kolonne {
  id: string;
  number: string;
  project: string | null;
}

interface LV {
  id: string;
  name: string;
  version: string;
}

interface Report {
  id: string;
  date: string;
  kolonne_id: string;
  employees_count: number;
  hours_per_employee: number;
  planned_revenue: number;
  actual_revenue: number;
  rev_per_employee: number | null;
  rev_per_hour: number | null;
  kolonnen: Kolonne;
}

export default function Berichte() {
  const { isHostOrGF } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [kolonnen, setKolonnen] = useState<Kolonne[]>([]);
  const [lvs, setLvs] = useState<LV[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedKolonne, setSelectedKolonne] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');

  // KPIs
  const [totalPlanned, setTotalPlanned] = useState(0);
  const [totalActual, setTotalActual] = useState(0);
  const [avgRevPerEmployee, setAvgRevPerEmployee] = useState(0);
  const [avgRevPerHour, setAvgRevPerHour] = useState(0);

  useEffect(() => {
    fetchFiltersData();
    fetchReports();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [dateFrom, dateTo, selectedKolonne, selectedProject]);

  const fetchFiltersData = async () => {
    const [kolResult, lvResult] = await Promise.all([
      supabase.from('kolonnen').select('*').order('number'),
      supabase.from('lvs').select('*').order('name')
    ]);

    if (kolResult.data) setKolonnen(kolResult.data);
    if (lvResult.data) setLvs(lvResult.data);
  };

  const fetchReports = async () => {
    setLoading(true);

    let query = supabase
      .from('leistungsmeldung_tags')
      .select('*, kolonnen(*)')
      .order('date', { ascending: false });

    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('date', dateTo);
    }
    if (selectedKolonne) {
      query = query.eq('kolonne_id', selectedKolonne);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Fehler beim Laden der Berichte');
      console.error(error);
    } else {
      let filteredData = data || [];
      
      // Filter by project if selected
      if (selectedProject) {
        filteredData = filteredData.filter(r => 
          r.kolonnen?.project === selectedProject
        );
      }

      setReports(filteredData as Report[]);
      calculateKPIs(filteredData as Report[]);
    }

    setLoading(false);
  };

  const calculateKPIs = (data: Report[]) => {
    if (data.length === 0) {
      setTotalPlanned(0);
      setTotalActual(0);
      setAvgRevPerEmployee(0);
      setAvgRevPerHour(0);
      return;
    }

    const planned = data.reduce((sum, r) => sum + Number(r.planned_revenue || 0), 0);
    const actual = data.reduce((sum, r) => sum + Number(r.actual_revenue || 0), 0);
    
    const revsPerEmployee = data
      .filter(r => r.rev_per_employee !== null)
      .map(r => Number(r.rev_per_employee));
    const avgRPE = revsPerEmployee.length > 0 
      ? revsPerEmployee.reduce((a, b) => a + b, 0) / revsPerEmployee.length 
      : 0;

    const revsPerHour = data
      .filter(r => r.rev_per_hour !== null)
      .map(r => Number(r.rev_per_hour));
    const avgRPH = revsPerHour.length > 0 
      ? revsPerHour.reduce((a, b) => a + b, 0) / revsPerHour.length 
      : 0;

    setTotalPlanned(planned);
    setTotalActual(actual);
    setAvgRevPerEmployee(avgRPE);
    setAvgRevPerHour(avgRPH);
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('de-DE');
  };

  const handleExportCSV = () => {
    if (reports.length === 0) {
      toast.error('Keine Daten zum Exportieren');
      return;
    }

    const headers = ['Datum', 'Kolonne', 'Projekt', 'Mitarbeiter', 'Stunden/MA', 'Umsatz PLAN', 'Umsatz IST', 'Umsatz/MA', 'Umsatz/Std'];
    const rows = reports.map(r => [
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

  const projects = [...new Set(kolonnen.map(k => k.project).filter(Boolean))];
  const delta = totalActual - totalPlanned;
  const deltaPositive = delta >= 0;

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
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Zeitraum von</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Zeitraum bis</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Kolonne</Label>
                <Select value={selectedKolonne} onValueChange={setSelectedKolonne}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle Kolonnen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Alle Kolonnen</SelectItem>
                    {kolonnen.map((k) => (
                      <SelectItem key={k.id} value={k.id}>{k.number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Projekt</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle Projekte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Alle Projekte</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p} value={p!}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Umsatz gesamt (PLAN)</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalPlanned)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Umsatz gesamt (IST)</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalActual)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Euro className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Delta (IST-PLAN)</p>
                  <p className={`text-2xl font-bold ${deltaPositive ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(delta)}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${deltaPositive ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  {deltaPositive ? (
                    <TrendingUp className="w-5 h-5 text-success" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-destructive" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ø Umsatz/MA/AT</p>
                  <p className="text-2xl font-bold">{formatCurrency(avgRevPerEmployee)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ø Umsatz/MA/Std</p>
                  <p className="text-2xl font-bold">{formatCurrency(avgRevPerHour)}</p>
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
            <CardDescription>{reports.length} Einträge</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Keine Daten für den ausgewählten Zeitraum</p>
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
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>{formatDate(report.date)}</TableCell>
                        <TableCell className="font-medium">{report.kolonnen?.number}</TableCell>
                        <TableCell>{report.kolonnen?.project || '-'}</TableCell>
                        <TableCell className="text-center">{report.employees_count}</TableCell>
                        <TableCell className="text-center">{Number(report.hours_per_employee).toFixed(1)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(report.planned_revenue))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(report.actual_revenue))}</TableCell>
                        <TableCell className="text-right">
                          {report.rev_per_employee ? formatCurrency(Number(report.rev_per_employee)) : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          {report.rev_per_hour ? formatCurrency(Number(report.rev_per_hour)) : 'N/A'}
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
