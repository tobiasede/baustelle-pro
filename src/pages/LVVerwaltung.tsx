import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Upload, FileSpreadsheet, Trash2, Edit, Eye, Loader2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface LV {
  id: string;
  name: string;
  project: string | null;
  version: string;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
}

interface LVItem {
  id: string;
  lv_id: string;
  position_code: string;
  short_text: string;
  unit: string;
  unit_price: number;
  category: string | null;
}

interface ExcelColumn {
  index: number;
  header: string;
}

interface ColumnMapping {
  position_code: number | null;
  short_text: number | null;
  unit: number | null;
  unit_price: number | null;
  category: number | null;
}

export default function LVVerwaltung() {
  const { user, isHostOrGF } = useAuth();
  const [lvs, setLvs] = useState<LV[]>([]);
  const [selectedLV, setSelectedLV] = useState<LV | null>(null);
  const [lvItems, setLvItems] = useState<LVItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Create LV dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLVName, setNewLVName] = useState('');
  const [newLVProject, setNewLVProject] = useState('');
  const [newLVVersion, setNewLVVersion] = useState('1.0');
  const [newLVValidFrom, setNewLVValidFrom] = useState('');
  const [newLVValidTo, setNewLVValidTo] = useState('');

  // Excel upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<'upload' | 'sheet' | 'mapping'>('upload');
  const [excelWorkbook, setExcelWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [excelColumns, setExcelColumns] = useState<ExcelColumn[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    position_code: null,
    short_text: null,
    unit: null,
    unit_price: null,
    category: null
  });
  const [excelData, setExcelData] = useState<any[]>([]);
  const [uploadLVId, setUploadLVId] = useState<string | null>(null);

  // View items dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    fetchLVs();
  }, []);

  const fetchLVs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lvs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Fehler beim Laden der LVs');
      console.error(error);
    } else {
      setLvs(data || []);
    }
    setLoading(false);
  };

  const fetchLVItems = async (lvId: string) => {
    setItemsLoading(true);
    const { data, error } = await supabase
      .from('lv_items')
      .select('*')
      .eq('lv_id', lvId)
      .order('position_code');

    if (error) {
      toast.error('Fehler beim Laden der LV-Positionen');
      console.error(error);
    } else {
      setLvItems(data || []);
    }
    setItemsLoading(false);
  };

  const handleCreateLV = async () => {
    if (!newLVName.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    const { data, error } = await supabase
      .from('lvs')
      .insert({
        name: newLVName,
        project: newLVProject || null,
        version: newLVVersion,
        valid_from: newLVValidFrom || null,
        valid_to: newLVValidTo || null,
        created_by: user?.id
      })
      .select()
      .single();

    if (error) {
      toast.error('Fehler beim Erstellen des LV');
      console.error(error);
    } else {
      toast.success('LV erfolgreich erstellt');
      setCreateDialogOpen(false);
      resetCreateForm();
      fetchLVs();
    }
  };

  const resetCreateForm = () => {
    setNewLVName('');
    setNewLVProject('');
    setNewLVVersion('1.0');
    setNewLVValidFrom('');
    setNewLVValidTo('');
  };

  const handleDeleteLV = async (lv: LV) => {
    if (!confirm(`Möchten Sie das LV "${lv.name}" wirklich löschen?`)) return;

    const { error } = await supabase
      .from('lvs')
      .delete()
      .eq('id', lv.id);

    if (error) {
      toast.error('Fehler beim Löschen des LV');
      console.error(error);
    } else {
      toast.success('LV erfolgreich gelöscht');
      fetchLVs();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, lvId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadLVId(lvId);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      setExcelWorkbook(workbook);
      setSheetNames(workbook.SheetNames);
      setUploadStep('sheet');
      setUploadDialogOpen(true);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSheetSelect = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (!excelWorkbook) return;

    const worksheet = excelWorkbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (jsonData.length === 0) {
      toast.error('Das Tabellenblatt ist leer');
      return;
    }

    const headers = jsonData[0] as string[];
    const columns: ExcelColumn[] = headers.map((header, index) => ({
      index,
      header: String(header || `Spalte ${index + 1}`)
    }));

    setExcelColumns(columns);
    setExcelData(jsonData.slice(1));
    setUploadStep('mapping');
  };

  const handleImport = async () => {
    if (columnMapping.position_code === null || 
        columnMapping.short_text === null || 
        columnMapping.unit === null || 
        columnMapping.unit_price === null) {
      toast.error('Bitte ordnen Sie alle Pflichtfelder zu');
      return;
    }

    if (!uploadLVId) return;

    const items = excelData
      .filter(row => row[columnMapping.position_code!] && row[columnMapping.unit_price!])
      .map(row => ({
        lv_id: uploadLVId,
        position_code: String(row[columnMapping.position_code!]),
        short_text: String(row[columnMapping.short_text!] || ''),
        unit: String(row[columnMapping.unit!] || ''),
        unit_price: parseFloat(String(row[columnMapping.unit_price!]).replace(',', '.')) || 0,
        category: columnMapping.category !== null ? String(row[columnMapping.category] || '') : null
      }))
      .filter(item => item.unit_price > 0);

    if (items.length === 0) {
      toast.error('Keine gültigen Daten zum Importieren gefunden');
      return;
    }

    // Check for duplicates
    const positionCodes = items.map(i => i.position_code);
    const duplicates = positionCodes.filter((code, index) => positionCodes.indexOf(code) !== index);
    if (duplicates.length > 0) {
      toast.error(`Doppelte Positions-IDs gefunden: ${[...new Set(duplicates)].join(', ')}`);
      return;
    }

    const { error } = await supabase
      .from('lv_items')
      .insert(items);

    if (error) {
      if (error.code === '23505') {
        toast.error('Einige Positions-IDs existieren bereits im LV');
      } else {
        toast.error('Fehler beim Importieren der Daten');
      }
      console.error(error);
    } else {
      toast.success(`${items.length} Positionen erfolgreich importiert`);
      resetUpload();
      setUploadDialogOpen(false);
    }
  };

  const resetUpload = () => {
    setUploadStep('upload');
    setExcelWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setExcelColumns([]);
    setColumnMapping({
      position_code: null,
      short_text: null,
      unit: null,
      unit_price: null,
      category: null
    });
    setExcelData([]);
    setUploadLVId(null);
  };

  const handleViewItems = (lv: LV) => {
    setSelectedLV(lv);
    fetchLVItems(lv.id);
    setViewDialogOpen(true);
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">LV-Verwaltung</h1>
            <p className="text-muted-foreground">Leistungsverzeichnisse erstellen und verwalten</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Neues LV anlegen
          </Button>
        </div>

        {/* LV List */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Leistungsverzeichnisse</CardTitle>
            <CardDescription>{lvs.length} LVs vorhanden</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : lvs.length === 0 ? (
              <div className="text-center py-8">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Noch keine LVs vorhanden</p>
                <Button onClick={() => setCreateDialogOpen(true)} variant="outline" className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Erstes LV anlegen
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Projekt</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Gültig von</TableHead>
                      <TableHead>Gültig bis</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lvs.map((lv) => (
                      <TableRow key={lv.id}>
                        <TableCell className="font-medium">{lv.name}</TableCell>
                        <TableCell>{lv.project || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{lv.version}</Badge>
                        </TableCell>
                        <TableCell>{lv.valid_from || '-'}</TableCell>
                        <TableCell>{lv.valid_to || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleViewItems(lv)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={(e) => handleFileUpload(e, lv.id)}
                              />
                              <Button variant="ghost" size="sm" asChild>
                                <span>
                                  <Upload className="w-4 h-4" />
                                </span>
                              </Button>
                            </label>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteLV(lv)}>
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

        {/* Create LV Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Neues LV anlegen</DialogTitle>
              <DialogDescription>
                Erstellen Sie ein neues Leistungsverzeichnis
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="lv-name">Name *</Label>
                <Input
                  id="lv-name"
                  value={newLVName}
                  onChange={(e) => setNewLVName(e.target.value)}
                  placeholder="z.B. Projekt Musterstadt 2024"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lv-project">Projekt</Label>
                <Input
                  id="lv-project"
                  value={newLVProject}
                  onChange={(e) => setNewLVProject(e.target.value)}
                  placeholder="z.B. Musterstadt"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lv-version">Version</Label>
                <Input
                  id="lv-version"
                  value={newLVVersion}
                  onChange={(e) => setNewLVVersion(e.target.value)}
                  placeholder="z.B. 1.0"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lv-valid-from">Gültig von</Label>
                  <Input
                    id="lv-valid-from"
                    type="date"
                    value={newLVValidFrom}
                    onChange={(e) => setNewLVValidFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lv-valid-to">Gültig bis</Label>
                  <Input
                    id="lv-valid-to"
                    type="date"
                    value={newLVValidTo}
                    onChange={(e) => setNewLVValidTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleCreateLV}>
                LV anlegen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={(open) => { if (!open) resetUpload(); setUploadDialogOpen(open); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {uploadStep === 'sheet' ? 'Tabellenblatt wählen' : 
                 uploadStep === 'mapping' ? 'Spalten zuordnen' : 'LV hochladen'}
              </DialogTitle>
            </DialogHeader>

            {uploadStep === 'sheet' && (
              <div className="space-y-4 py-4">
                <Label>Tabellenblatt auswählen</Label>
                <Select value={selectedSheet} onValueChange={handleSheetSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tabellenblatt wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sheetNames.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {uploadStep === 'mapping' && (
              <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Positions-ID *</Label>
                    <Select 
                      value={columnMapping.position_code?.toString() || ''} 
                      onValueChange={(v) => setColumnMapping(prev => ({ ...prev, position_code: parseInt(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Spalte wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {excelColumns.map((col) => (
                          <SelectItem key={col.index} value={col.index.toString()}>{col.header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Kurztext *</Label>
                    <Select 
                      value={columnMapping.short_text?.toString() || ''} 
                      onValueChange={(v) => setColumnMapping(prev => ({ ...prev, short_text: parseInt(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Spalte wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {excelColumns.map((col) => (
                          <SelectItem key={col.index} value={col.index.toString()}>{col.header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Einheit *</Label>
                    <Select 
                      value={columnMapping.unit?.toString() || ''} 
                      onValueChange={(v) => setColumnMapping(prev => ({ ...prev, unit: parseInt(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Spalte wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {excelColumns.map((col) => (
                          <SelectItem key={col.index} value={col.index.toString()}>{col.header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Einheitspreis (EP) *</Label>
                    <Select 
                      value={columnMapping.unit_price?.toString() || ''} 
                      onValueChange={(v) => setColumnMapping(prev => ({ ...prev, unit_price: parseInt(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Spalte wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {excelColumns.map((col) => (
                          <SelectItem key={col.index} value={col.index.toString()}>{col.header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Kategorie (optional)</Label>
                    <Select 
                      value={columnMapping.category?.toString() || ''} 
                      onValueChange={(v) => setColumnMapping(prev => ({ ...prev, category: v ? parseInt(v) : null }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Spalte wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Keine</SelectItem>
                        {excelColumns.map((col) => (
                          <SelectItem key={col.index} value={col.index.toString()}>{col.header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  {excelData.length} Zeilen gefunden
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { resetUpload(); setUploadDialogOpen(false); }}>
                Abbrechen
              </Button>
              {uploadStep === 'mapping' && (
                <Button onClick={handleImport}>
                  Importieren
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Items Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{selectedLV?.name} - Positionen</DialogTitle>
              <DialogDescription>
                Version {selectedLV?.version} • {lvItems.length} Positionen
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {itemsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : lvItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Keine Positionen vorhanden</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Positions-ID</TableHead>
                      <TableHead>Kurztext</TableHead>
                      <TableHead>Einheit</TableHead>
                      <TableHead className="text-right">EP (€)</TableHead>
                      <TableHead>Kategorie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lvItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.position_code}</TableCell>
                        <TableCell>{item.short_text}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">{Number(item.unit_price).toFixed(2)}</TableCell>
                        <TableCell>{item.category || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
