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
import { Loader2, AlertCircle, Users, Plus, Edit, Trash2, UserCheck } from 'lucide-react';
import { SelectField } from '@/components/SelectField';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'HOST' | 'GF' | 'BAULEITER';
}

interface UserRole {
  user_id: string;
  role: 'HOST' | 'GF' | 'BAULEITER';
}

interface Kolonne {
  id: string;
  number: string;
  project: string | null;
}

interface Assignment {
  id: string;
  user_id: string;
  kolonne_id: string;
}

export default function AdminUsersPage() {
  const { isHostOrGF } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [kolonnen, setKolonnen] = useState<Kolonne[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string | undefined>(undefined);
  const [editAssignedKolonnen, setEditAssignedKolonnen] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [profilesResult, rolesResult, kolonnenResult, assignmentsResult] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('user_roles').select('*'),
      supabase.from('kolonnen').select('*').order('number'),
      supabase.from('bauleiter_kolonne_assignments').select('*'),
    ]);

    if (profilesResult.error) {
      toast.error('Fehler beim Laden der Benutzer');
      console.error(profilesResult.error);
    } else {
      setProfiles(profilesResult.data || []);
    }

    if (rolesResult.error) {
      console.error(rolesResult.error);
    } else {
      setUserRoles(rolesResult.data || []);
    }

    if (kolonnenResult.error) {
      console.error(kolonnenResult.error);
    } else {
      setKolonnen(kolonnenResult.data || []);
    }

    if (assignmentsResult.error) {
      console.error(assignmentsResult.error);
    } else {
      setAssignments(assignmentsResult.data || []);
    }

    setLoading(false);
  };

  const getUserRole = (userId: string): string => {
    const role = userRoles.find(r => r.user_id === userId);
    return role?.role || 'BAULEITER';
  };

  const getUserAssignments = (userId: string): string[] => {
    return assignments
      .filter(a => a.user_id === userId)
      .map(a => a.kolonne_id);
  };

  const handleEditUser = (user: Profile) => {
    setEditingUser(user);
    setEditRole(getUserRole(user.id));
    setEditAssignedKolonnen(getUserAssignments(user.id));
    setEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser || !editRole) return;

    setSaving(true);

    const typedRole = editRole as 'HOST' | 'GF' | 'BAULEITER';

    // Update role - delete old and insert new to avoid upsert issues
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', editingUser.id);

    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: editingUser.id, role: typedRole });

    if (roleError) {
      toast.error('Fehler beim Speichern der Rolle');
      console.error(roleError);
      setSaving(false);
      return;
    }

    // Update profile role for display
    await supabase
      .from('profiles')
      .update({ role: typedRole })
      .eq('id', editingUser.id);

    // Update assignments - delete old, insert new
    await supabase
      .from('bauleiter_kolonne_assignments')
      .delete()
      .eq('user_id', editingUser.id);

    if (editAssignedKolonnen.length > 0) {
      const newAssignments = editAssignedKolonnen.map(kolonneId => ({
        user_id: editingUser.id,
        kolonne_id: kolonneId,
      }));

      const { error: assignError } = await supabase
        .from('bauleiter_kolonne_assignments')
        .insert(newAssignments);

      if (assignError) {
        toast.error('Fehler beim Speichern der Kolonnen-Zuweisungen');
        console.error(assignError);
      }
    }

    toast.success('Benutzer erfolgreich aktualisiert');
    setEditDialogOpen(false);
    setSaving(false);
    fetchData();
  };

  const roleLabels: Record<string, string> = {
    HOST: 'Administrator',
    GF: 'Geschäftsführer',
    BAULEITER: 'Bauleiter',
  };

  const roleOptions = [
    { label: 'Administrator', value: 'HOST' },
    { label: 'Geschäftsführer', value: 'GF' },
    { label: 'Bauleiter', value: 'BAULEITER' },
  ];

  const kolonneOptions = kolonnen.map(k => ({
    label: `${k.number}${k.project ? ` (${k.project})` : ''}`,
    value: k.id,
  }));

  const toggleKolonneAssignment = (kolonneId: string) => {
    setEditAssignedKolonnen(prev => 
      prev.includes(kolonneId)
        ? prev.filter(id => id !== kolonneId)
        : [...prev, kolonneId]
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
      <div className="content-container animate-fade-in" data-testid="admin-users-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bauleiter & Zugänge</h1>
            <p className="text-muted-foreground">Benutzer verwalten und Kolonnen zuweisen</p>
          </div>
        </div>

        {/* Users Table */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Benutzer
            </CardTitle>
            <CardDescription>{profiles.length} Benutzer</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Keine Benutzer vorhanden</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead>Zugewiesene Kolonnen</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((user) => {
                      const role = getUserRole(user.id);
                      const userAssignments = getUserAssignments(user.id);
                      const assignedKolonnenNames = userAssignments
                        .map(id => kolonnen.find(k => k.id === id)?.number)
                        .filter(Boolean)
                        .join(', ');

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={role === 'BAULEITER' ? 'secondary' : 'default'}>
                              {roleLabels[role] || role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {role === 'BAULEITER' 
                              ? (assignedKolonnenNames || <span className="text-muted-foreground">Keine</span>)
                              : <span className="text-muted-foreground">—</span>
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)}>
                              <Edit className="w-4 h-4" />
                            </Button>
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

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Benutzer bearbeiten</DialogTitle>
              <DialogDescription>
                {editingUser?.name} ({editingUser?.email})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <SelectField
                label="Rolle"
                value={editRole}
                onChange={setEditRole}
                options={roleOptions}
                placeholder="Rolle wählen"
              />

              {editRole === 'BAULEITER' && (
                <div className="space-y-2">
                  <Label>Zugewiesene Kolonnen</Label>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {kolonnen.map(k => (
                      <label
                        key={k.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={editAssignedKolonnen.includes(k.id)}
                          onChange={() => toggleKolonneAssignment(k.id)}
                          className="rounded"
                        />
                        <span>{k.number}{k.project ? ` (${k.project})` : ''}</span>
                      </label>
                    ))}
                    {kolonnen.length === 0 && (
                      <p className="text-sm text-muted-foreground">Keine Kolonnen vorhanden</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveUser} disabled={saving}>
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
