import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChecklistPhotoUploadProps {
  taskInstanceId: string;
  existingPhotoPath: string | null;
  onUploaded: (path: string) => void;
  disabled?: boolean;
}

export function ChecklistPhotoUpload({ taskInstanceId, existingPhotoPath, onUploaded, disabled }: ChecklistPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${taskInstanceId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('housekeeping-photos')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('housekeeping_task_instances')
        .update({ photo_path: path })
        .eq('id', taskInstanceId);

      if (updateError) throw updateError;

      onUploaded(path);
      toast.success('Photo uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
        }}
      />
      <Button
        variant={existingPhotoPath ? 'secondary' : 'outline'}
        size="sm"
        className="h-7 text-xs gap-1"
        disabled={disabled || uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : existingPhotoPath ? <Check className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
        {uploading ? 'Uploading…' : existingPhotoPath ? 'Photo ✓' : 'Photo'}
      </Button>
    </div>
  );
}
