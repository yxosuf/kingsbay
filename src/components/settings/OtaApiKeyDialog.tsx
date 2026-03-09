import { useState } from 'react';
import { Eye, EyeOff, Copy, Loader2, Wifi, WifiOff, Save, Trash2, FlaskConical, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChannelIcon } from '@/components/channels/ChannelIcon';
import type { OtaIntegration } from '@/hooks/useOtaSync';

interface OtaApiKeyDialogProps {
  integration: OtaIntegration;
  open: boolean;
  onClose: () => void;
  onSave: (apiKey: string, sandboxMode: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  onTest: () => Promise<void>;
  isSaving?: boolean;
  isDeleting?: boolean;
  isTesting?: boolean;
}

export function OtaApiKeyDialog({
  integration,
  open,
  onClose,
  onSave,
  onDelete,
  onTest,
  isSaving = false,
  isDeleting = false,
  isTesting = false,
}: OtaApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [sandboxMode, setSandboxMode] = useState(integration.sandbox_mode ?? true);
  const [showKey, setShowKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasExistingKey = !!integration.api_key;

  const handleSave = async () => {
    if (!apiKey.trim() && !hasExistingKey) return;
    const keyToSave = apiKey.trim() || integration.api_key || '';
    await onSave(keyToSave, sandboxMode);
    setApiKey('');
    onClose();
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete();
    setConfirmDelete(false);
    onClose();
  };

  const handleCopy = () => {
    if (integration.api_key) {
      navigator.clipboard.writeText(integration.api_key);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <ChannelIcon type={integration.ota_name} size="md" />
            <DialogTitle>{integration.display_name} API Key</DialogTitle>
          </div>
          <DialogDescription>
            Configure the API credentials for {integration.display_name} integration. Keys are stored securely and never exposed in plain text.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Environment Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              {sandboxMode ? (
                <FlaskConical className="h-4 w-4 text-amber-500" />
              ) : (
                <Shield className="h-4 w-4 text-success" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {sandboxMode ? 'Sandbox Mode' : 'Production Mode'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sandboxMode
                    ? 'Safe for testing — uses test OTA endpoints'
                    : 'Live mode — pushes to real OTA listings'}
                </p>
              </div>
            </div>
            <Switch
              checked={!sandboxMode}
              onCheckedChange={(val) => setSandboxMode(!val)}
            />
          </div>

          <Separator />

          {/* API Key Field */}
          <div className="space-y-2">
            <Label htmlFor="api-key">
              API Key {hasExistingKey && <Badge variant="outline" className="ml-2 text-xs">Configured</Badge>}
            </Label>

            {hasExistingKey && !apiKey && (
              <div className="flex items-center gap-2">
                <Input
                  value="••••••••••••••••••••••••••••••••"
                  readOnly
                  className="font-mono text-muted-foreground bg-muted"
                />
                <Button variant="outline" size="icon" onClick={handleCopy} title="Copy key">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  placeholder={hasExistingKey ? 'Enter new key to replace existing' : 'Paste your API key here'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Contact {integration.display_name} partner support to obtain your API credentials.
            </p>
          </div>

          {/* Test Connection */}
          {hasExistingKey && (
            <Button
              variant="outline"
              className="w-full"
              onClick={onTest}
              disabled={isTesting}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {hasExistingKey && (
              <Button
                variant={confirmDelete ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-shrink-0"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                {confirmDelete ? 'Confirm Remove' : 'Remove Key'}
              </Button>
            )}

            <div className="flex-1 flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || (!apiKey.trim() && !hasExistingKey)}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
