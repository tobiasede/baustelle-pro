import { useState, useEffect, useCallback } from 'react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Upload, FileSpreadsheet, Trash2, Eye, Loader2, AlertCircle, Download, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { SelectField } from '@/components/SelectField';
import {
  type CanonicalHeader,
  type LVRow,
  ALL_HEADERS,
  REQUIRED_HEADERS,
  saveMappingToStorage,
} from '@/features/lv/importSchema';
import {
  parseFile,
  parseSheet,
  validateAndTransform,
  downloadTemplate,
  type ParsedFile,
  type ValidationError,
  type ImportResult,
} from '@/features/lv/importService';

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

type ImportStep = 'upload' | 'sheet' | 'mapping' | 'validation' | 'confirm';

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

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<ImportStep>('upload');
  const [uploadLVId, setUploadLVId] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<CanonicalHeader, number | null>>({
    'Positions-ID': null,
    'Kurztext': null,
    'Einheit': null,
    'EP': null,
    'Kategorie': null,
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [generateAutoIds, setGenerateAutoIds] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const resetUpload = useCallback(() => {
    setUploadStep('upload');
    setCurrentFile(null);
    setParsedFile(null);
    setMapping({
      'Positions-ID': null,
      'Kurztext': null,
      'Einheit': null,
      'EP': null,
      'Kategorie': null,
    });
    setImportResult(null);
    setUploadLVId(null);
    setGenerateAutoIds(false);
    setIsProcessing(false);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, lvId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadLVId(lvId);
    setCurrentFile(file);
    setIsProcessing(true);
    setUploadDialogOpen(true);

    try {
      const parsed = await parseFile(file);
      setParsedFile(parsed);
      setMapping(parsed.mapping);

      if (parsed.sheets.length > 1) {
        // Multiple sheets - let user choose
        setUploadStep('sheet');
      } else if (parsed.isCanonical) {
        // Canonical schema - skip mapping, go to validation
        runValidation(parsed.rawData, parsed.mapping);
      } else {
        // Need mapping
        setUploadStep('mapping');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Lesen der Datei');
      resetUpload();
      setUploadDialogOpen(false);
    } finally {
      setIsProcessing(false);
    }
    
    // Reset file input
    event.target.value = '';
  };

  const handleSheetSelect = async (sheetName: string | undefined) => {
    if (!sheetName || !currentFile) return;

    setIsProcessing(true);
    try {
      const result = await parseSheet(currentFile, sheetName);
      setParsedFile(prev => prev ? {
        ...prev,
        selectedSheet: sheetName,
        headers: result.headers,
        rawData: result.rawData,
        mapping: result.mapping,
        isCanonical: result.isCanonical,
      } : null);
      setMapping(result.mapping);

      if (result.isCanonical) {
        runValidation(result.rawData, result.mapping);
      } else {
        setUploadStep('mapping');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Lesen des Tabellenblatts');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingChange = (target: CanonicalHeader, value: string | undefined) => {
    setMapping(prev => ({
      ...prev,
      [target]: value !== undefined ? parseInt(value) : null,
    }));
  };

  const runValidation = useCallback((rawData: unknown[][], currentMapping: Record<CanonicalHeader, number | null>) => {
    const result = validateAndTransform(rawData, currentMapping, { generateAutoIds });
    setImportResult(result);
    setUploadStep('validation');
  }, [generateAutoIds]);

  const handleValidate = () => {
    if (!parsedFile) return;
    
    // Save mapping for future use
    saveMappingToStorage(parsedFile.storedMappingKey, mapping);
    
    runValidation(parsedFile.rawData, mapping);
  };

  const handleImport = async () => {
    if (!importResult || !uploadLVId || importResult.rows.length === 0) return;

    setIsProcessing(true);
    
    try {
      const items = importResult.rows.map(row => ({
        lv_id: uploadLVId,
        position_code: row['Positions-ID'],
        short_text: row['Kurztext'],
        unit: row['Einheit'],
        unit_price: row['EP'],
        category: row['Kategorie'] || null,
      }));

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
    } catch (error) {
      toast.error('Unerwarteter Fehler beim Import');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewItems = (lv: LV) => {
    setSelectedLV(lv);
    fetchLVItems(lv.id);
    setViewDialogOpen(true);
  };

  const getMappingOptions = () => {
    if (!parsedFile) return [];
    return parsedFile.headers.map((header, index) => ({
      label: header || `Spalte ${index + 1}`,
      value: index,
    }));
  };

  const getStepTitle = () => {
    switch (uploadStep) {
      case 'sheet': return 'Tabellenblatt wählen';
      case 'mapping': return 'Spalten zuordnen';
      case 'validation': return 'Validierungsergebnis';
      case 'confirm': return 'Import bestätigen';
      default: return 'LV hochladen';
    }
  };

  const renderErrors = (errors: ValidationError[], maxShow: number = 10) => {
    const shown = errors.slice(0, maxShow);
    const remaining = errors.length - maxShow;

    return (
      <div className="space-y-1">
        {shown.map((err, idx) => (
          <div key={idx} className="text-sm flex items-start gap-2">
            {err.severity === 'error' ? (
              <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            )}
            <span>
              <strong>Zeile {err.row}:</strong> {err.column} - {err.message}
            </span>
          </div>
        ))}
        {remaining > 0 && (
          <div className="text-sm text-muted-foreground pl-6">
            ... und {remaining} weitere {errors[0]?.severity === 'error' ? 'Fehler' : 'Warnungen'}
          </div>
        )}
      </div>
    );
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadTemplate('xlsx')} size="sm">
              <Download className="w-4 h-4 mr-2" />
              Excel-Vorlage
            </Button>
            <Button variant="outline" onClick={() => downloadTemplate('csv')} size="sm">
              <Download className="w-4 h-4 mr-2" />
              CSV-Vorlage
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Neues LV
            </Button>
          </div>
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
                                accept=".xlsx,.xls,.csv"
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
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{getStepTitle()}</DialogTitle>
              {parsedFile && (
                <DialogDescription>
                  {parsedFile.fileName} • {parsedFile.fileType === 'csv' ? 'CSV' : 'Excel'}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4">
              {isProcessing && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Verarbeite...</span>
                </div>
              )}

              {/* Step: Sheet Selection */}
              {uploadStep === 'sheet' && parsedFile && !isProcessing && (
                <SelectField
                  label="Tabellenblatt auswählen"
                  value={parsedFile.selectedSheet}
                  onChange={handleSheetSelect}
                  options={parsedFile.sheets.map(name => ({ label: name, value: name }))}
                  placeholder="Tabellenblatt wählen..."
                />
              )}

              {/* Step: Mapping */}
              {uploadStep === 'mapping' && parsedFile && !isProcessing && (
                <div className="space-y-4">
                  {parsedFile.isCanonical && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Kanonisches Schema erkannt</AlertTitle>
                      <AlertDescription>
                        Die Datei verwendet das Standard-Schema. Die Spalten wurden automatisch zugeordnet.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-3">
                    {REQUIRED_HEADERS.map((header) => (
                      <SelectField
                        key={header}
                        label={header}
                        required
                        value={mapping[header]}
                        onChange={(v) => handleMappingChange(header, v)}
                        options={getMappingOptions()}
                        placeholder="Spalte wählen..."
                        allowEmpty
                        emptyLabel="Nicht zugeordnet"
                      />
                    ))}
                    
                    <SelectField
                      label="Kategorie (optional)"
                      value={mapping['Kategorie']}
                      onChange={(v) => handleMappingChange('Kategorie', v)}
                      options={getMappingOptions()}
                      placeholder="Spalte wählen..."
                      allowEmpty
                      emptyLabel="Nicht zugeordnet"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="auto-ids"
                      checked={generateAutoIds}
                      onCheckedChange={(checked) => setGenerateAutoIds(checked === true)}
                    />
                    <Label htmlFor="auto-ids" className="text-sm font-normal cursor-pointer">
                      Auto-IDs generieren, wenn Positions-ID leer ist
                    </Label>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {parsedFile.rawData.length} Zeilen gefunden
                  </div>
                </div>
              )}

              {/* Step: Validation */}
              {uploadStep === 'validation' && importResult && !isProcessing && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-primary">{importResult.validRows}</div>
                        <div className="text-sm text-muted-foreground">Gültige Zeilen</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-muted-foreground">{importResult.totalRows}</div>
                        <div className="text-sm text-muted-foreground">Gesamt</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Errors */}
                  {importResult.errors.length > 0 && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>{importResult.errors.length} Fehler gefunden</AlertTitle>
                      <AlertDescription className="mt-2">
                        {renderErrors(importResult.errors)}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Warnings */}
                  {importResult.warnings.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{importResult.warnings.length} Warnungen</AlertTitle>
                      <AlertDescription className="mt-2">
                        {renderErrors(importResult.warnings)}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Success */}
                  {importResult.errors.length === 0 && importResult.validRows > 0 && (
                    <Alert className="border-primary/30 bg-primary/5">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <AlertTitle>Bereit zum Import</AlertTitle>
                      <AlertDescription>
                        {importResult.validRows} Positionen können importiert werden.
                        {importResult.warnings.length > 0 && ' Die Warnungen beeinträchtigen den Import nicht.'}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* No valid rows */}
                  {importResult.validRows === 0 && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Keine gültigen Daten</AlertTitle>
                      <AlertDescription>
                        Es wurden keine gültigen Zeilen zum Importieren gefunden. Bitte korrigieren Sie die Fehler in der Quelldatei.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { resetUpload(); setUploadDialogOpen(false); }}>
                Abbrechen
              </Button>

              {uploadStep === 'mapping' && (
                <Button onClick={handleValidate} disabled={isProcessing}>
                  Validieren
                </Button>
              )}

              {uploadStep === 'validation' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setUploadStep('mapping')}
                    disabled={isProcessing}
                  >
                    Zurück zur Zuordnung
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={isProcessing || !importResult || importResult.validRows === 0}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {importResult?.validRows || 0} Positionen importieren
                  </Button>
                </>
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
