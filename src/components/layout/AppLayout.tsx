import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { normalizeRole, isAdminRole, getRoleLabel } from '@/lib/roleUtils';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  ClipboardList, 
  BarChart3, 
  LogOut,
  HardHat,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface AppLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
  testId: string;
}

const navItems: NavItem[] = [
  { 
    href: '/', 
    label: 'Dashboard', 
    icon: LayoutDashboard,
    roles: ['HOST', 'GF', 'BAULEITER'],
    testId: 'nav-dashboard'
  },
  { 
    href: '/lv-verwaltung', 
    label: 'LV-Verwaltung', 
    icon: FileText,
    roles: ['HOST', 'GF'],
    testId: 'nav-lv'
  },
  { 
    href: '/kolonnen-zuweisung', 
    label: 'Kolonnen-Zuweisung', 
    icon: Users,
    roles: ['HOST', 'GF'],
    testId: 'nav-kolonnen-zuweisung'
  },
  { 
    href: '/tagesmeldung', 
    label: 'Tagesmeldung', 
    icon: ClipboardList,
    roles: ['HOST', 'GF', 'BAULEITER'],
    testId: 'nav-tagesmeldung'
  },
  { 
    href: '/berichte', 
    label: 'Berichte', 
    icon: BarChart3,
    roles: ['HOST', 'GF', 'BAULEITER'],
    testId: 'nav-berichte'
  },
  { 
    href: '/admin/users', 
    label: 'Bauleiter & Zugänge', 
    icon: Users,
    roles: ['HOST', 'GF'],
    testId: 'nav-users'
  },
  { 
    href: '/admin/kolonnen', 
    label: 'Kolonnen', 
    icon: Users,
    roles: ['HOST', 'GF'],
    testId: 'nav-kolonnen'
  },
  { 
    href: '/admin/data-inspector', 
    label: 'Daten-Inspektor', 
    icon: LayoutDashboard,
    roles: ['HOST', 'GF'],
    testId: 'nav-data-inspector'
  },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, userRole, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Normalize role
  const role = normalizeRole(userRole);
  const isLoading = loading;
  const isAdmin = isAdminRole(role);

  // Build navigation: show all items during loading (disabled), or filter by role
  const getVisibleNavItems = () => {
    if (isLoading) {
      // During loading, show admin nav items in disabled state to avoid blank UI
      return navItems;
    }
    if (!role) {
      // No role = minimal nav (bauleiter-like)
      return navItems.filter(item => 
        item.roles.includes('BAULEITER')
      );
    }
    return navItems.filter(item => item.roles.includes(role));
  };

  const visibleNavItems = getVisibleNavItems();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform duration-300 lg:translate-x-0 lg:static",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <HardHat className="w-5 h-5 text-sidebar-primary-foreground" />
              </div>
              <span className="font-semibold text-sidebar-foreground">Leistungsmeldung</span>
            </div>
            <button 
              className="lg:hidden text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav data-testid="main-nav" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {isLoading ? (
              // Show skeleton nav items during loading
              <>
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.href}
                      data-testid={item.testId}
                      className="nav-item nav-item-inactive opacity-50 cursor-not-allowed"
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </>
            ) : (
              // Normal nav items
              visibleNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    data-testid={item.testId}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "nav-item",
                      isActive ? "nav-item-active" : "nav-item-inactive"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })
            )}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                {isLoading ? (
                  <Skeleton className="w-4 h-4" />
                ) : (
                  <span className="text-sm font-medium text-sidebar-accent-foreground">
                    {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {isLoading ? (
                  <>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {profile?.name || 'Benutzer'}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60 truncate">
                      {getRoleLabel(role)}
                    </p>
                  </>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={isLoading}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Abmelden
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between h-16 px-4 bg-card border-b border-border">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="text-foreground"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <HardHat className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Leistungsmeldung</span>
          </div>
          <div className="w-6" /> {/* Spacer */}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
