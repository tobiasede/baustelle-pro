import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, AlertCircle, ClipboardList, Save, AlertTriangle, Euro, Lock } from 'lucide-react';
import { SelectField } from '@/components/SelectField';
import { toNumberOrZero, formatCurrency, formatDate } from '@/lib/numberUtils';
import { isWithinEditWindow, getEditDeadline } from '@/features/aggregation/stats';

interface Kolonne {
  id: string;
  number: string;
  project: string | null;
}

interface LVItem {
  id: string;
  position_code: string;
  short_text: string;
  unit: string;
  unit_price: number;
  category: string | null;
}

interface LV {
  id: string;
  name: string;
  version: string;
  valid_from: string | null;
  valid_to: string | null;
}

interface ReportItem {
  lv_item_id: string;
  qty_plan: number;
  qty_actual: number;
}

export default function Tagesmeldung() {
  const { user, isBauleiter, isHostOrGF } = useAuth();
  const [kolonnen, setKolonnen] = useState<Kolonne[]>([]);
  const [lvItems, setLvItems] = useState<LVItem[]>([]);
  const [currentLV, setCurrentLV] = useState<LV | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validityWarning, setValidityWarning] = useState<string | null>(null);

  // Form state
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedKolonneId, setSelectedKolonneId] = useState<string | undefined>(undefined);
  
  // Plan vs Actual fields
  const [employeesPlan, setEmployeesPlan] = useState<string>('');
  const [employeesActual, setEmployeesActual] = useState<string>('');
  const [hoursPlan, setHoursPlan] = useState<string>('8');
  const [hoursActual, setHoursActual] = useState<string>('8');
  const [reportItems, setReportItems] = useState<Map<string, ReportItem>>(new Map());

  // Track which fields have been touched (for hasEntries calculation)
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Computed values
  const [plannedRevenue, setPlannedRevenue] = useState<number>(0);
  const [actualRevenue, setActualRevenue] = useState<number>(0);

  // Derived numeric values (treat empty as 0)
  const employeesPlanNum = toNumberOrZero(employeesPlan);
  const employeesActualNum = toNumberOrZero(employeesActual);
  const hoursPlanNum = toNumberOrZero(hoursPlan);
  const hoursActualNum = toNumberOrZero(hoursActual);

  // Edit window logic
  const canEdit = isWithinEditWindow(selectedDate, isHostOrGF);
  const editDeadline = getEditDeadline(selectedDate);

  useEffect(() => {
    fetchKolonnen();
  }, [user, isBauleiter]);

  useEffect(() => {
    if (selectedKolonneId) {
      fetchLVForKolonne(selectedKolonneId);
    } else {
      setLvItems([]);
      setCurrentLV(null);
    }
  }, [selectedKolonneId]);

  useEffect(() => {
    // Check LV validity when date changes
    if (currentLV && selectedDate) {
      checkLVValidity();
    }
  }, [selectedDate, currentLV]);

  useEffect(() => {
    // Calculate revenues
    let planned = 0;
    let actual = 0;

    reportItems.forEach((item) => {
      const lvItem = lvItems.find(lvi => lvi.id === item.lv_item_id);
      if (lvItem) {
        planned += toNumberOrZero(item.qty_plan) * Number(lvItem.unit_price);
        actual += toNumberOrZero(item.qty_actual) * Number(lvItem.unit_price);
      }
    });

    setPlannedRevenue(planned);
    setActualRevenue(actual);
  }, [reportItems, lvItems]);

  const markFieldTouched = useCallback((fieldId: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldId));
  }, []);

  const fetchKolonnen = async () => {
    setLoading(true);
    
    if (isBauleiter && user) {
      // Bauleiter can only see assigned kolonnen
      const { data: assignments, error: assignError } = await supabase
        .from('bauleiter_kolonne_assignments')
        .select('kolonne_id')
        .eq('user_id', user.id);

      if (assignError) {
        toast.error('Fehler beim Laden der Kolonnen');
        console.error(assignError);
        setLoading(false);
        return;
      }

      if (assignments && assignments.length > 0) {
        const kolonneIds = assignments.map(a => a.kolonne_id);
        const { data, error } = await supabase
          .from('kolonnen')
          .select('*')
          .in('id', kolonneIds)
          .order('number');

        if (error) {
          toast.error('Fehler beim Laden der Kolonnen');
          console.error(error);
        } else {
          setKolonnen(data || []);
        }
      } else {
        setKolonnen([]);
      }
    } else if (isHostOrGF) {
      // HOST/GF can see all kolonnen
      const { data, error } = await supabase
        .from('kolonnen')
        .select('*')
        .order('number');

      if (error) {
        toast.error('Fehler beim Laden der Kolonnen');
        console.error(error);
      } else {
        setKolonnen(data || []);
      }
    }
    
    setLoading(false);
  };

  const fetchLVForKolonne = async (kolonneId: string) => {
    // Get active LV assignment for this kolonne
    const { data: assignment, error: assignError } = await supabase
      .from('kolonne_lv_assignments')
      .select('lv_id')
      .eq('kolonne_id', kolonneId)
      .eq('is_active', true)
      .maybeSingle();

    if (assignError) {
      toast.error('Fehler beim Laden der LV-Zuweisung');
      console.error(assignError);
      return;
    }

    if (!assignment) {
      toast.warning('Dieser Kolonne ist kein LV zugewiesen');
      setLvItems([]);
      setCurrentLV(null);
      return;
    }

    // Fetch LV details
    const { data: lvData, error: lvError } = await supabase
      .from('lvs')
      .select('*')
      .eq('id', assignment.lv_id)
      .single();

    if (lvError) {
      toast.error('Fehler beim Laden des LV');
      console.error(lvError);
      return;
    }

    setCurrentLV(lvData);

    // Fetch LV items
    const { data: items, error: itemsError } = await supabase
      .from('lv_items')
      .select('*')
      .eq('lv_id', assignment.lv_id)
      .order('position_code');

    if (itemsError) {
      toast.error('Fehler beim Laden der LV-Positionen');
      console.error(itemsError);
    } else {
      setLvItems(items || []);
      // Initialize report items
      const newReportItems = new Map<string, ReportItem>();
      (items || []).forEach(item => {
        newReportItems.set(item.id, {
          lv_item_id: item.id,
          qty_plan: 0,
          qty_actual: 0
        });
      });
      setReportItems(newReportItems);
      // Reset touched fields when loading new data
      setTouchedFields(new Set());
    }
  };

  const checkLVValidity = () => {
    if (!currentLV) return;

    const date = new Date(selectedDate);
    let warning = null;

    if (currentLV.valid_from && new Date(currentLV.valid_from) > date) {
      warning = 'Die ausgewählte LV-Version ist für dieses Datum nicht gültig. Bitte GF kontaktieren.';
    }
    if (currentLV.valid_to && new Date(currentLV.valid_to) < date) {
      warning = 'Die ausgewählte LV-Version ist für dieses Datum nicht gültig. Bitte GF kontaktieren.';
    }

    setValidityWarning(warning);
  };

  const handleItemChange = (itemId: string, field: 'qty_plan' | 'qty_actual', value: string) => {
    const numValue = toNumberOrZero(value);
    const newReportItems = new Map(reportItems);
    const item = newReportItems.get(itemId);
    if (item) {
      newReportItems.set(itemId, { ...item, [field]: numValue });
      setReportItems(newReportItems);
    }
    // Mark this field as touched
    markFieldTouched(`item_${itemId}_${field}`);
  };

  const handleEmployeesPlanChange = (value: string) => {
    setEmployeesPlan(value);
    markFieldTouched('employees_plan');
  };

  const handleEmployeesActualChange = (value: string) => {
    setEmployeesActual(value);
    markFieldTouched('employees_actual');
  };

  const handleHoursPlanChange = (value: string) => {
    setHoursPlan(value);
    markFieldTouched('hours_plan');
  };

  const handleHoursActualChange = (value: string) => {
    setHoursActual(value);
    markFieldTouched('hours_actual');
  };

  const handleSave = async () => {
    if (!selectedKolonneId || !selectedDate || !user) {
      toast.error('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    if (!canEdit) {
      toast.error('Die Bearbeitungsfrist für dieses Datum ist abgelaufen');
      return;
    }

    if (validityWarning) {
      toast.error('Die LV-Version ist für das gewählte Datum nicht gültig');
      return;
    }

    setSaving(true);

    // Calculate hasEntries based on touched fields
    const hasEntries = touchedFields.size > 0;

    // Calculate KPIs using normalized values
    const revPerEmployee = employeesActualNum > 0 ? actualRevenue / employeesActualNum : 0;
    const totalHours = employeesActualNum * hoursActualNum;
    const revPerHour = totalHours > 0 ? actualRevenue / totalHours : 0;

    // Create or update the report tag
    const { data: existingTag, error: checkError } = await supabase
      .from('leistungsmeldung_tags')
      .select('id')
      .eq('kolonne_id', selectedKolonneId)
      .eq('date', selectedDate)
      .maybeSingle();

    if (checkError) {
      toast.error('Fehler beim Prüfen vorhandener Meldungen');
      console.error(checkError);
      setSaving(false);
      return;
    }

    let tagId: string;

    const tagData = {
      employees_count: employeesActualNum,
      employees_plan: employeesPlanNum,
      hours_per_employee: hoursActualNum,
      hours_plan: hoursPlanNum,
      planned_revenue: plannedRevenue,
      actual_revenue: actualRevenue,
      rev_per_employee: revPerEmployee,
      rev_per_hour: revPerHour,
      has_entries: hasEntries,
      lv_snapshot_id: currentLV?.id || null
    };

    if (existingTag) {
      // Update existing
      const { error: updateError } = await supabase
        .from('leistungsmeldung_tags')
        .update(tagData)
        .eq('id', existingTag.id);

      if (updateError) {
        toast.error('Fehler beim Aktualisieren der Meldung');
        console.error(updateError);
        setSaving(false);
        return;
      }

      tagId = existingTag.id;

      // Delete old items
      await supabase
        .from('leistungsmeldung_items')
        .delete()
        .eq('leistungsmeldung_tag_id', tagId);

    } else {
      // Create new
      const { data: newTag, error: insertError } = await supabase
        .from('leistungsmeldung_tags')
        .insert({
          date: selectedDate,
          kolonne_id: selectedKolonneId,
          foreman_id: user.id,
          ...tagData
        })
        .select()
        .single();

      if (insertError) {
        toast.error('Fehler beim Erstellen der Meldung');
        console.error(insertError);
        setSaving(false);
        return;
      }

      tagId = newTag.id;
    }

    // Insert items - include all items with non-zero values
    const itemsToInsert = Array.from(reportItems.values())
      .filter(item => toNumberOrZero(item.qty_plan) > 0 || toNumberOrZero(item.qty_actual) > 0)
      .map(item => ({
        leistungsmeldung_tag_id: tagId,
        lv_item_id: item.lv_item_id,
        qty_plan: toNumberOrZero(item.qty_plan),
        qty_actual: toNumberOrZero(item.qty_actual)
      }));

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('leistungsmeldung_items')
        .insert(itemsToInsert);

      if (itemsError) {
        toast.error('Fehler beim Speichern der Positionen');
        console.error(itemsError);
        setSaving(false);
        return;
      }
    }

    toast.success('Tagesmeldung erfolgreich gespeichert');
    setSaving(false);
  };

  // Build options for SelectField
  const kolonneOptions = kolonnen.map(k => ({
    label: `${k.number}${k.project ? ` (${k.project})` : ''}`,
    value: k.id
  }));

  return (
    <AppLayout>
      <div className="content-container animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tagesmeldung</h1>
              <p className="text-muted-foreground">Tägliche Leistungsmeldung erfassen</p>
            </div>
            {isBauleiter && selectedDate && (
              <Badge variant={canEdit ? 'default' : 'secondary'} className="flex items-center gap-1">
                {canEdit ? (
                  <>Bearbeitbar bis: {formatDate(editDeadline)}</>
                ) : (
                  <>
                    <Lock className="w-3 h-3" />
                    Nur Lesen
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : kolonnen.length === 0 ? (
          <Card className="card-elevated border-warning/30 bg-warning/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertCircle className="w-5 h-5" />
                Keine Kolonnen zugewiesen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {isBauleiter 
                  ? 'Ihnen sind noch keine Kolonnen zugewiesen. Bitte kontaktieren Sie einen Geschäftsführer.'
                  : 'Es sind noch keine Kolonnen im System vorhanden.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Form Section */}
            <Card className="card-elevated mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Meldungsdaten
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-2">
                    <Label htmlFor="date">Datum *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      disabled={!canEdit && isBauleiter}
                    />
                  </div>
                  
                  <SelectField
                    label="Kolonne *"
                    value={selectedKolonneId}
                    onChange={setSelectedKolonneId}
                    options={kolonneOptions}
                    placeholder="Kolonne wählen..."
                    disabled={!canEdit && isBauleiter}
                  />
                </div>

                {/* Plan vs Actual: Employees */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeesPlan"># Mitarbeiter (PLAN)</Label>
                    <Input
                      id="employeesPlan"
                      type="number"
                      min={0}
                      value={employeesPlan}
                      onChange={(e) => handleEmployeesPlanChange(e.target.value)}
                      placeholder="0"
                      disabled={!canEdit && isBauleiter}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeesActual"># Mitarbeiter (IST)</Label>
                    <Input
                      id="employeesActual"
                      type="number"
                      min={0}
                      value={employeesActual}
                      onChange={(e) => handleEmployeesActualChange(e.target.value)}
                      placeholder="0"
                      disabled={!canEdit && isBauleiter}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hoursPlan">Stunden/MA (PLAN)</Label>
                    <Input
                      id="hoursPlan"
                      type="number"
                      min={0}
                      step={0.5}
                      value={hoursPlan}
                      onChange={(e) => handleHoursPlanChange(e.target.value)}
                      placeholder="8"
                      disabled={!canEdit && isBauleiter}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hoursActual">Stunden/MA (IST)</Label>
                    <Input
                      id="hoursActual"
                      type="number"
                      min={0}
                      step={0.5}
                      value={hoursActual}
                      onChange={(e) => handleHoursActualChange(e.target.value)}
                      placeholder="8"
                      disabled={!canEdit && isBauleiter}
                    />
                  </div>
                </div>

                {!canEdit && isBauleiter && (
                  <Alert variant="destructive" className="mt-4">
                    <Lock className="h-4 w-4" />
                    <AlertDescription>
                      Die Bearbeitungsfrist für dieses Datum ist abgelaufen. Nur Administratoren können Änderungen vornehmen.
                    </AlertDescription>
                  </Alert>
                )}

                {validityWarning && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{validityWarning}</AlertDescription>
                  </Alert>
                )}

                {currentLV && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      <strong>Zugewiesenes LV:</strong> {currentLV.name} (v{currentLV.version})
                      {currentLV.valid_from && currentLV.valid_to && (
                        <span> • Gültig: {currentLV.valid_from} - {currentLV.valid_to}</span>
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Items Table */}
            {selectedKolonneId && lvItems.length > 0 && (
              <Card className="card-elevated mb-6">
                <CardHeader>
                  <CardTitle>Positionen</CardTitle>
                  <CardDescription>{lvItems.length} Positionen</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-32">Positions-ID</TableHead>
                          <TableHead>Kurztext</TableHead>
                          <TableHead className="w-20">Einheit</TableHead>
                          <TableHead className="w-32 text-right">EP (€)</TableHead>
                          <TableHead className="w-32">PLAN Menge</TableHead>
                          <TableHead className="w-32">IST Menge</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lvItems.map((item) => {
                          const reportItem = reportItems.get(item.id);
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-sm">{item.position_code}</TableCell>
                              <TableCell className="max-w-xs truncate">{item.short_text}</TableCell>
                              <TableCell>{item.unit}</TableCell>
                              <TableCell className="text-right">{Number(item.unit_price).toFixed(2)}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.001}
                                  value={reportItem?.qty_plan || ''}
                                  onChange={(e) => handleItemChange(item.id, 'qty_plan', e.target.value)}
                                  className="w-full"
                                  placeholder="0"
                                  disabled={!canEdit && isBauleiter}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.001}
                                  value={reportItem?.qty_actual || ''}
                                  onChange={(e) => handleItemChange(item.id, 'qty_actual', e.target.value)}
                                  className="w-full"
                                  placeholder="0"
                                  disabled={!canEdit && isBauleiter}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary & Save */}
            {selectedKolonneId && lvItems.length > 0 && (
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Euro className="w-5 h-5" />
                    Zusammenfassung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Umsatz (PLAN)</p>
                      <p className="text-xl font-bold">{formatCurrency(plannedRevenue)}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Umsatz (IST)</p>
                      <p className="text-xl font-bold">{formatCurrency(actualRevenue)}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Umsatz/MA</p>
                      <p className="text-xl font-bold">
                        {employeesActualNum > 0 ? formatCurrency(actualRevenue / employeesActualNum) : '—'}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Umsatz/Std</p>
                      <p className="text-xl font-bold">
                        {employeesActualNum > 0 && hoursActualNum > 0 
                          ? formatCurrency(actualRevenue / (employeesActualNum * hoursActualNum)) 
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <Button 
                    onClick={handleSave} 
                    disabled={saving || !!validityWarning || !selectedKolonneId || (!canEdit && isBauleiter)}
                    className="w-full sm:w-auto"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Speichern...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Tagesmeldung speichern
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {selectedKolonneId && lvItems.length === 0 && currentLV === null && (
              <Card className="card-elevated border-warning/30 bg-warning/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-warning">
                    <AlertCircle className="w-5 h-5" />
                    Kein LV zugewiesen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Dieser Kolonne ist kein Leistungsverzeichnis zugewiesen. 
                    Bitte kontaktieren Sie einen Geschäftsführer.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}