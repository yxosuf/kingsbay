import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { SessionTimeoutWarning } from './SessionTimeoutWarning';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { CreateCompany } from '@/components/organization/CreateCompany';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { user, loading, role, signOut, isGuest } = useAuth();
  const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    // Guest users should not access staff pages
    if (!loading && user && isGuest) {
      navigate('/guest/dashboard');
    }
  }, [user, loading, isGuest, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleReturnToLogin = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!role) {
    return <CreateCompany onSignOut={handleReturnToLogin} />;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0">
          <AppHeader title={title} />
          <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-20 md:pb-6 bg-background overflow-x-hidden">
            <div className="max-w-[1600px] mx-auto animate-page-in">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
      <BottomNav />
      <SessionTimeoutWarning />
      <KeyboardShortcutsDialog open={showHelp} onOpenChange={setShowHelp} shortcuts={shortcuts} />
    </SidebarProvider>
  );
}
