import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Users, 
  ClipboardList, 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Euro,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function Dashboard() {
  const { profile, userRole, isHostOrGF, isBauleiter } = useAuth();

  const roleLabels: Record<string, string> = {
    HOST: 'Administrator',
    GF: 'Geschäftsführer',
    BAULEITER: 'Bauleiter'
  };

  return (
    <AppLayout>
      <div className="content-container animate-fade-in">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Willkommen, {profile?.name || 'Benutzer'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {userRole ? roleLabels[userRole] : ''} • Übersicht und Schnellzugriff
          </p>
        </div>

        {/* Quick Stats for HOST/GF */}
        {isHostOrGF && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="card-elevated">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Umsatz heute (IST)</p>
                    <p className="text-2xl font-bold text-foreground">€ 0</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                    <Euro className="w-6 h-6 text-success" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span>Keine Daten</span>
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Umsatz heute (PLAN)</p>
                    <p className="text-2xl font-bold text-foreground">€ 0</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
                    <Euro className="w-6 h-6 text-info" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                  <span>Keine Daten</span>
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Umsatz/MA/Std</p>
                    <p className="text-2xl font-bold text-foreground">€ 0</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                  <span>Keine Daten</span>
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Delta (IST-PLAN)</p>
                    <p className="text-2xl font-bold text-foreground">€ 0</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <TrendingDown className="w-6 h-6 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                  <span>Keine Daten</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Schnellzugriff</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isHostOrGF && (
              <>
                <Card className="card-elevated hover:shadow-elevated transition-shadow cursor-pointer group">
                  <Link to="/lv-verwaltung">
                    <CardHeader className="pb-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">LV-Verwaltung</CardTitle>
                      <CardDescription>
                        Leistungsverzeichnisse erstellen, bearbeiten und importieren
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-sm text-primary font-medium">
                        Öffnen <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    </CardContent>
                  </Link>
                </Card>

                <Card className="card-elevated hover:shadow-elevated transition-shadow cursor-pointer group">
                  <Link to="/kolonnen-zuweisung">
                    <CardHeader className="pb-2">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-2 group-hover:bg-accent/20 transition-colors">
                        <Users className="w-5 h-5 text-accent" />
                      </div>
                      <CardTitle className="text-lg">Kolonnen-Zuweisung</CardTitle>
                      <CardDescription>
                        LV-Versionen Kolonnen zuweisen und verwalten
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-sm text-primary font-medium">
                        Öffnen <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    </CardContent>
                  </Link>
                </Card>

                <Card className="card-elevated hover:shadow-elevated transition-shadow cursor-pointer group">
                  <Link to="/berichte">
                    <CardHeader className="pb-2">
                      <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center mb-2 group-hover:bg-success/20 transition-colors">
                        <BarChart3 className="w-5 h-5 text-success" />
                      </div>
                      <CardTitle className="text-lg">Berichte</CardTitle>
                      <CardDescription>
                        Auswertungen und KPIs anzeigen und exportieren
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-sm text-primary font-medium">
                        Öffnen <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              </>
            )}

            <Card className="card-elevated hover:shadow-elevated transition-shadow cursor-pointer group">
              <Link to="/tagesmeldung">
                <CardHeader className="pb-2">
                  <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center mb-2 group-hover:bg-info/20 transition-colors">
                    <ClipboardList className="w-5 h-5 text-info" />
                  </div>
                  <CardTitle className="text-lg">Tagesmeldung</CardTitle>
                  <CardDescription>
                    {isBauleiter 
                      ? 'Tägliche Leistungsmeldungen für Ihre Kolonnen erfassen'
                      : 'Tägliche Leistungsmeldungen einsehen und bearbeiten'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-primary font-medium">
                    {isBauleiter ? 'Neue Meldung' : 'Öffnen'} <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>
        </div>

        {/* Info for Bauleiter */}
        {isBauleiter && (
          <Card className="card-elevated border-info/30 bg-info/5">
            <CardHeader>
              <CardTitle className="text-lg text-info">Hinweis für Bauleiter</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Als Bauleiter können Sie Tagesmeldungen für Ihre zugewiesenen Kolonnen erfassen. 
                Das Leistungsverzeichnis wird automatisch basierend auf der Kolonne-Zuweisung geladen.
                Wenden Sie sich an einen Geschäftsführer, wenn Sie Zugriff auf zusätzliche Kolonnen benötigen.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
