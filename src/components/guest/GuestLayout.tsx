import { ReactNode, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Hotel, LogOut, User, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GuestLayoutProps {
  children: ReactNode;
  title?: string;
}

export function GuestLayout({ children, title }: GuestLayoutProps) {
  const { user, loading, isGuest, isAdmin, isManager, isFrontDesk, isViewer, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/guest/login');
    }
    // If this is a staff user, redirect to staff dashboard
    if (!loading && user && (isAdmin || isManager || isFrontDesk || isViewer)) {
      navigate('/');
    }
  }, [user, loading, isGuest, isAdmin, isManager, isFrontDesk, isViewer, navigate]);

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

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/guest/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/guest/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Hotel className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">King's Bay Villa</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/guest/dashboard">
                <User className="h-4 w-4 mr-1" />
                Dashboard
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/guest/book">
                <CalendarDays className="h-4 w-4 mr-1" />
                Book Now
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" />
              Sign Out
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-5xl mx-auto">
          {title && (
            <h1 className="text-2xl font-bold text-foreground mb-6">{title}</h1>
          )}
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} King's Bay Villa. All rights reserved.
      </footer>
    </div>
  );
}
