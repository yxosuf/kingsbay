import { ReactNode, useEffect } from 'react';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { Button } from '@/components/ui/button';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { user, loading, role, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-semibold text-foreground">Access Pending</h2>
          <p className="text-muted-foreground">
            Your account has been created but you haven't been assigned a role yet. 
            Please contact an administrator to get access to the system.
          </p>
          <Button
            variant="outline"
            onClick={handleReturnToLogin}
            className="mt-2"
          >
            <LogIn className="h-4 w-4" />
            Return to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
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
    </SidebarProvider>
  );
}
