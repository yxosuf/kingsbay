import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Mail,
  RefreshCw,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TestTube2,
  Send,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface EmailLog {
  id: string;
  provider: string;
  message_id: string | null;
  subject: string | null;
  from_email: string | null;
  received_at: string;
  parse_status: string;
  parse_error: string | null;
  extracted: Record<string, any> | null;
}

interface ExtractedPreview {
  booking_id: string | null;
  status: string;
  check_in_date: string | null;
  check_out_date: string | null;
  guest_name: string | null;
  room_type: string | null;
  total_price: number | null;
}

export function EmailImportSettings() {
  const { selectedProperty } = useProperty();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testSubject, setTestSubject] = useState('');
  const [testBody, setTestBody] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    extracted?: ExtractedPreview;
    error?: string;
    usedAI?: boolean;
    logId?: string;
  } | null>(null);
  const [confirmingCreate, setConfirmingCreate] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-email-inbound`;

  useEffect(() => {
    if (selectedProperty?.id) {
      fetchLogs();
    }
  }, [selectedProperty?.id]);

  const fetchLogs = async () => {
    if (!selectedProperty?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('email_ingest_logs')
        .select('*')
        .eq('property_id', selectedProperty.id)
        .order('received_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs((data as EmailLog[]) || []);
    } catch (error) {
      console.error('Error fetching email logs:', error);
      toast.error('Failed to load email logs');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleTestParse = async () => {
    if (!testSubject && !testBody) {
      toast.error('Please enter email content to test');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testMode: true,
          propertyId: selectedProperty?.id,
          subject: testSubject,
          body: testBody,
        }),
      });

      const result = await response.json();
      setTestResult(result);
      
      if (result.success) {
        toast.success('Email parsed successfully');
      } else {
        toast.error(result.error || 'Failed to parse email');
      }
    } catch (error: any) {
      console.error('Test parse error:', error);
      toast.error('Failed to test parser');
      setTestResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const handleConfirmCreate = async () => {
    if (!testResult?.extracted?.booking_id) {
      toast.error('No booking ID extracted');
      return;
    }

    setConfirmingCreate(true);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testMode: true,
          confirmCreate: true,
          propertyId: selectedProperty?.id,
          subject: testSubject,
          body: testBody,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Booking ${result.action}: ${result.bookingId}`);
        setShowTestDialog(false);
        setTestSubject('');
        setTestBody('');
        setTestResult(null);
        fetchLogs();
      } else {
        toast.error(result.error || 'Failed to create booking');
      }
    } catch (error: any) {
      console.error('Create booking error:', error);
      toast.error('Failed to create booking');
    } finally {
      setConfirmingCreate(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'needs_review':
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Review
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a property first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Booking.com Email Import</CardTitle>
              <CardDescription>
                Automatically import bookings from Booking.com confirmation emails
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <h4 className="font-medium">Setup Instructions</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Configure your email provider (Mailgun, SendGrid, or Postmark) to forward
                Booking.com emails to the webhook URL below
              </li>
              <li>
                Add the inbound secret header <code className="bg-background px-1 rounded">X-Inbound-Secret</code> 
                with your configured secret
              </li>
              <li>
                Add <code className="bg-background px-1 rounded">property_id={selectedProperty.id}</code> as 
                a query parameter or form field
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Property ID (for forwarding config)</Label>
            <div className="flex gap-2">
              <Input
                value={selectedProperty.id}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(selectedProperty.id)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button variant="outline" onClick={() => setShowTestDialog(true)}>
            <TestTube2 className="h-4 w-4 mr-2" />
            Test Email Parser
          </Button>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Email Imports</CardTitle>
              <CardDescription>Last 20 email processing attempts</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-foreground">No emails processed yet</p>
              <p className="text-sm mt-1">
                Configure your email forwarding to start importing bookings
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{getStatusBadge(log.parse_status)}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={log.subject || undefined}>
                        {log.subject || 'No subject'}
                      </div>
                      {log.parse_error && (
                        <p className="text-xs text-destructive truncate">{log.parse_error}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.from_email || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.provider}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(log.received_at), 'MMM d, HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Test Parser Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube2 className="h-5 w-5" />
              Test Email Parser
            </DialogTitle>
            <DialogDescription>
              Paste a Booking.com confirmation email to test the parser
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-subject">Subject Line</Label>
              <Input
                id="test-subject"
                placeholder="New booking confirmation #1234567890"
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-body">Email Body (plain text)</Label>
              <Textarea
                id="test-body"
                placeholder="Paste the email content here..."
                className="min-h-[200px] font-mono text-sm"
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
              />
            </div>

            {testResult && (
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-success/10 border border-success/20' : 'bg-destructive/10 border border-destructive/20'}`}>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  {testResult.success ? 'Parsing Successful' : 'Parsing Failed'}
                  {testResult.usedAI && (
                    <Badge variant="secondary" className="ml-2">AI Assisted</Badge>
                  )}
                </h4>
                
                {testResult.error && (
                  <p className="text-sm text-destructive">{testResult.error}</p>
                )}

                {testResult.extracted && (
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <div>
                      <span className="text-muted-foreground">Booking ID:</span>{' '}
                      <span className="font-medium">{testResult.extracted.booking_id || 'Not found'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      <span className="font-medium capitalize">{testResult.extracted.status || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Check-in:</span>{' '}
                      <span className="font-medium">{testResult.extracted.check_in_date || 'Not found'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Check-out:</span>{' '}
                      <span className="font-medium">{testResult.extracted.check_out_date || 'Not found'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Guest:</span>{' '}
                      <span className="font-medium">{testResult.extracted.guest_name || 'Not found'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Room:</span>{' '}
                      <span className="font-medium">{testResult.extracted.room_type || 'Not found'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total:</span>{' '}
                      <span className="font-medium">
                        {testResult.extracted.total_price 
                          ? `Rs. ${testResult.extracted.total_price.toLocaleString()}` 
                          : 'Not found'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleTestParse} disabled={testing}>
              {testing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Parse Email
            </Button>
            {testResult?.success && testResult?.extracted?.booking_id && (
              <Button 
                onClick={handleConfirmCreate} 
                disabled={confirmingCreate}
                className="bg-success hover:bg-success/90"
              >
                {confirmingCreate ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Create Booking
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
