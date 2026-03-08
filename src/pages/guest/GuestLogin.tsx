import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hotel, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const schema = z.object({
  email: z.string().trim().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function GuestLogin() {
  const navigate = useNavigate();
  const { user, loading, isGuest, role, signIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!loading && user) {
      if (isGuest) {
        navigate('/guest/dashboard');
      } else if (role) {
        navigate('/');
      }
    }
  }, [user, loading, isGuest, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse({ email, password });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Welcome back!');
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-3">
            <Hotel className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Guest Portal</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage your bookings</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Enter your email and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/guest/reset-password" className="text-xs text-primary underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground text-center mt-4">
              Don't have an account?{' '}
              <Link to="/guest/register" className="text-primary underline">Register</Link>
            </p>
            <p className="text-xs text-muted-foreground text-center mt-2">
              <Link to="/auth" className="underline">Staff login →</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
