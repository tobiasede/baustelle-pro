import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, AlertCircle, Users, Check } from 'lucide-react';

interface Kolonne {
  id: string;
  number: string;
  project: string | null;
}

interface LV {
  id: string;
  name: string;
  version: string;
  valid_from: string | null;
  valid_to: string | null;
}

interface Assignment {
  id: string;
  kolonne_id: string;
  lv_id: string;
  is_active: boolean;
}

export default function KolonnenZuweisung() {
  const { user, isHostOrGF } = useAuth();
  const [kolonnen, setKolonnen] = useState<Kolonne[]>([]);
  const [lvs, setLvs] = useState<LV[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [kolResult, lvResult, assignResult] = await Promise.all([
      supabase.from('kolonnen').select('*').order('number'),
      supabase.from('lvs').select('*').order('name'),
      supabase.from('kolonne_lv_assignments').select('*').eq('is_active', true)
    ]);

    if (kolResult.error) {
      toast.error('Fehler beim Laden der Kolonnen');
      console.error(kolResult.error);
    } else {
      setKolonnen(kolResult.data || []);
    }

    if (lvResult.error) {
      toast.error('Fehler beim Laden der LVs');
      console.error(lvResult.error);
    } else {
      setLvs(lvResult.data || []);
    }

    if (assignResult.error) {
      toast.error('Fehler beim Laden der Zuweisungen');
      console.error(assignResult.error);
    } else {
      setAssignments(assignResult.data || []);
    }

    setLoading(false);
  };

  const getCurrentAssignment = (kolonneId: string): string | undefined => {
    const assignment = assignments.find(a => a.kolonne_id === kolonneId && a.is_active);
    return assignment?.lv_id;
  };

  const handleAssignmentChange = async (kolonneId: string, lvId: string | null) => {
    setSaving(kolonneId);

    // First, deactivate any existing active assignment
    const existingAssignment = assignments.find(a => a.kolonne_id === kolonneId && a.is_active);
    
    if (existingAssignment) {
      const { error: deactivateError } = await supabase
        .from('kolonne_lv_assignments')
        .update({ is_active: false })
        .eq('id', existingAssignment.id);

      if (deactivateError) {
        toast.error('Fehler beim Aktualisieren der Zuweisung');
        console.error(deactivateError);
        setSaving(null);
        return;
      }
    }

    // If a new LV is selected, create the new assignment
    if (lvId) {
      const { error: insertError } = await supabase
        .from('kolonne_lv_assignments')
        .insert({
          kolonne_id: kolonneId,
          lv_id: lvId,
          assigned_by: user?.id,
          is_active: true
        });

      if (insertError) {
        // Handle unique constraint violation (only one active per kolonne)
        if (insertError.code === '23505') {
          // Try to update instead
          const { error: updateError } = await supabase
            .from('kolonne_lv_assignments')
            .update({ 
              lv_id: lvId, 
              assigned_by: user?.id, 
              assigned_at: new Date().toISOString(),
              is_active: true 
            })
            .eq('kolonne_id', kolonneId)
            .eq('is_active', true);

          if (updateError) {
            toast.error('Fehler beim Aktualisieren der Zuweisung');
            console.error(updateError);
            setSaving(null);
            return;
          }
        } else {
          toast.error('Fehler beim Erstellen der Zuweisung');
          console.error(insertError);
          setSaving(null);
          return;
        }
      }
    }

    toast.success('Zuweisung erfolgreich aktualisiert');
    await fetchData();
    setSaving(null);
  };

  const getLVDisplay = (lv: LV): string => {
    return `${lv.name} (v${lv.version})`;
  };

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Kolonnen-Zuweisung</h1>
          <p className="text-muted-foreground">Weisen Sie jeder Kolonne ein aktives Leistungsverzeichnis zu</p>
        </div>

        {/* Assignment Table */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Kolonnen
            </CardTitle>
            <CardDescription>
              {kolonnen.length} Kolonnen • Jede Kolonne kann genau ein aktives LV haben
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : kolonnen.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Keine Kolonnen vorhanden</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kolonne Nr.</TableHead>
                      <TableHead>Projekt</TableHead>
                      <TableHead>Zugewiesenes LV</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kolonnen.map((kolonne) => {
                      const currentLvId = getCurrentAssignment(kolonne.id);
                      const currentLV = lvs.find(lv => lv.id === currentLvId);
                      const isSaving = saving === kolonne.id;

                      return (
                        <TableRow key={kolonne.id}>
                          <TableCell className="font-medium">{kolonne.number}</TableCell>
                          <TableCell>{kolonne.project || '-'}</TableCell>
                          <TableCell className="min-w-[300px]">
                            <Select
                              value={currentLvId || ''}
                              onValueChange={(value) => handleAssignmentChange(kolonne.id, value || null)}
                              disabled={isSaving}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="LV auswählen...">
                                  {currentLV ? getLVDisplay(currentLV) : 'Kein LV zugewiesen'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Keine Zuweisung</SelectItem>
                                {lvs.map((lv) => (
                                  <SelectItem key={lv.id} value={lv.id}>
                                    {getLVDisplay(lv)}
                                    {lv.valid_from && lv.valid_to && (
                                      <span className="text-muted-foreground ml-2">
                                        ({lv.valid_from} - {lv.valid_to})
                                      </span>
                                    )}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin inline" />
                            ) : currentLvId ? (
                              <Badge variant="default" className="bg-success text-success-foreground">
                                <Check className="w-3 h-3 mr-1" />
                                Zugewiesen
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                Nicht zugewiesen
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="card-elevated mt-6 border-info/30 bg-info/5">
          <CardHeader>
            <CardTitle className="text-lg text-info">Hinweis zur LV-Zuweisung</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Jede Kolonne kann nur ein aktives LV gleichzeitig haben.</li>
              <li>• Die Bauleiter sehen automatisch das zugewiesene LV für ihre Kolonnen.</li>
              <li>• Bei der Tagesmeldung wird geprüft, ob das LV für das gewählte Datum gültig ist.</li>
              <li>• Änderungen werden sofort wirksam.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
