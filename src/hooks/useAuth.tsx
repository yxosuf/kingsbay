import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type StaffRole = 'admin' | 'front_desk' | 'manager' | 'viewer';

/**
 * Auth context interface providing user authentication and role information.
 * 
 * SECURITY NOTE: The role-based boolean properties (isAdmin, isManager, isFrontDesk)
 * are for UI/UX purposes ONLY - they control what the user sees, not what they can do.
 * 
 * All actual security enforcement is handled server-side via Row Level Security (RLS)
 * policies in the database. These client-side checks can be bypassed by modifying
 * browser state, so they should NEVER be relied upon for security decisions.
 * 
 * The backend RLS policies use SECURITY DEFINER functions (is_admin(), is_manager(), etc.)
 * to properly validate user roles before allowing database operations.
 */
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: StaffRole | null;
  profile: { full_name: string | null; email: string | null } | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isFrontDesk: boolean;
  isViewer: boolean;
  canWrite: boolean;
  /** True when the authenticated user is a guest (not staff) with a linked guest profile */
  isGuest: boolean;
  /** The guest record ID if this is a guest user */
  guestId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null } | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer fetching additional data with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setProfile(null);
          setGuestId(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch role + profile + guest link in parallel
      const [{ data: roleData }, { data: profileData }, { data: guestData }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).single(),
        supabase.from('profiles').select('full_name, email').eq('id', userId).single(),
        supabase.from('guests').select('id').eq('auth_user_id', userId).maybeSingle(),
      ]);

      if (roleData) {
        setRole(roleData.role as StaffRole);
      }
      if (profileData) {
        setProfile(profileData);
      }
      setGuestId(guestData?.id ?? null);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setProfile(null);
  };

  const value = {
    user,
    session,
    loading,
    role,
    profile,
    signIn,
    signUp,
    signOut,
    // NOTE: These role flags are for UI/UX only. Security is enforced by RLS policies.
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isFrontDesk: role === 'front_desk',
    isViewer: role === 'viewer',
    canWrite: role !== null && role !== 'viewer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
