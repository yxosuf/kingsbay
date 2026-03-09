import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface QRCodeDisplayProps {
  bookingId: string;
  guestName?: string;
}

export function QRCodeDisplay({ bookingId, guestName }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const checkinUrl = `${window.location.origin}/guest/checkin/${bookingId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(checkinUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <QrCode className="h-4 w-4" />
          QR Check-In
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Guest Self Check-In</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {guestName && (
            <p className="text-sm text-muted-foreground">For: <span className="font-medium text-foreground">{guestName}</span></p>
          )}
          <div className="p-4 bg-white rounded-xl shadow-sm">
            <QRCodeSVG
              value={checkinUrl}
              size={200}
              level="M"
              includeMargin
            />
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Guest scans this QR code to fill in their details and complete check-in.
          </p>
          <div className="flex items-center gap-2 w-full">
            <code className="flex-1 text-xs bg-muted p-2 rounded-lg truncate">{checkinUrl}</code>
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
