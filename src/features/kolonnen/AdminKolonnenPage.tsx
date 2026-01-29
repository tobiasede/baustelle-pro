import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, AlertCircle, Users, Plus, Edit, Trash2 } from 'lucide-react';

interface Kolonne {
  id: string;
  number: string;
  project: string | null;
  created_at: string | null;
}

export default function AdminKolonnenPage() {
  const { user, isHostOrGF } = useAuth();
  const [kolonnen, setKolonnen] = useState<Kolonne[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKolonne, setEditingKolonne] = useState<Kolonne | null>(null);
  const [kolonneNumber, setKolonneNumber] = useState('');
  const [kolonneProject, setKolonneProject] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchKolonnen();
  }, []);

  const fetchKolonnen = async () => {
    setLoading(true);
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
    setLoading(false);
  };

  const handleOpenCreate = () => {
    setEditingKolonne(null);
    setKolonneNumber('');
    setKolonneProject('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (kolonne: Kolonne) => {
    setEditingKolonne(kolonne);
    setKolonneNumber(kolonne.number);
    setKolonneProject(kolonne.project || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!kolonneNumber.trim()) {
      toast.error('Bitte geben Sie eine Kolonnennummer ein');
      return;
    }

    // Check for unique number (excluding current if editing)
    const duplicate = kolonnen.find(k => 
      k.number === kolonneNumber.trim() && 
      k.id !== editingKolonne?.id
    );
    if (duplicate) {
      toast.error('Diese Kolonnennummer existiert bereits');
      return;
    }

    setSaving(true);

    if (editingKolonne) {
      // Update
      const { error } = await supabase
        .from('kolonnen')
        .update({
          number: kolonneNumber.trim(),
          project: kolonneProject.trim() || null,
        })
        .eq('id', editingKolonne.id);

      if (error) {
        toast.error('Fehler beim Aktualisieren der Kolonne');
        console.error(error);
      } else {
        toast.success('Kolonne erfolgreich aktualisiert');
        setDialogOpen(false);
        fetchKolonnen();
      }
    } else {
      // Create
      const { error } = await supabase
        .from('kolonnen')
        .insert({
          number: kolonneNumber.trim(),
          project: kolonneProject.trim() || null,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Diese Kolonnennummer existiert bereits');
        } else {
          toast.error('Fehler beim Erstellen der Kolonne');
        }
        console.error(error);
      } else {
        toast.success('Kolonne erfolgreich erstellt');
        setDialogOpen(false);
        fetchKolonnen();
      }
    }

    setSaving(false);
  };

  const handleDelete = async (kolonne: Kolonne) => {
    if (!confirm(`Möchten Sie die Kolonne "${kolonne.number}" wirklich löschen?`)) return;

    const { error } = await supabase
      .from('kolonnen')
      .delete()
      .eq('id', kolonne.id);

    if (error) {
      toast.error('Fehler beim Löschen der Kolonne');
      console.error(error);
    } else {
      toast.success('Kolonne erfolgreich gelöscht');
      fetchKolonnen();
    }
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
      <div className="content-container animate-fade-in" data-testid="admin-kolonnen-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kolonnen</h1>
            <p className="text-muted-foreground">Kolonnen erstellen und verwalten</p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Neue Kolonne
          </Button>
        </div>

        {/* Kolonnen Table */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Kolonnen
            </CardTitle>
            <CardDescription>{kolonnen.length} Kolonnen</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : kolonnen.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Noch keine Kolonnen vorhanden</p>
                <Button onClick={handleOpenCreate} variant="outline" className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Erste Kolonne anlegen
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nummer</TableHead>
                      <TableHead>Projekt</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kolonnen.map((kolonne) => (
                      <TableRow key={kolonne.id}>
                        <TableCell className="font-medium">{kolonne.number}</TableCell>
                        <TableCell>{kolonne.project || '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(kolonne)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(kolonne)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>
                {editingKolonne ? 'Kolonne bearbeiten' : 'Neue Kolonne'}
              </DialogTitle>
              <DialogDescription>
                {editingKolonne 
                  ? 'Bearbeiten Sie die Kolonnendaten.'
                  : 'Erstellen Sie eine neue Kolonne.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="kolonne-number">Nummer *</Label>
                <Input
                  id="kolonne-number"
                  value={kolonneNumber}
                  onChange={(e) => setKolonneNumber(e.target.value)}
                  placeholder="z.B. 1031"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kolonne-project">Projekt</Label>
                <Input
                  id="kolonne-project"
                  value={kolonneProject}
                  onChange={(e) => setKolonneProject(e.target.value)}
                  placeholder="z.B. Teningen"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Speichern...
                  </>
                ) : (
                  'Speichern'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
