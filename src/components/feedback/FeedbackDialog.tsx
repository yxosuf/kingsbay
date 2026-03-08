import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useGuestFeedback } from '@/hooks/useGuestFeedback';

const FEEDBACK_CATEGORIES = [
  { key: 'cleanliness', label: 'Cleanliness' },
  { key: 'comfort', label: 'Comfort' },
  { key: 'service', label: 'Service' },
  { key: 'location', label: 'Location' },
  { key: 'value', label: 'Value for Money' },
];

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  guestId: string;
  guestName: string;
  propertyId: string | null;
  onSuccess?: () => void;
}

function StarRating({
  value,
  onChange,
  size = 'lg',
}: {
  value: number;
  onChange: (v: number) => void;
  size?: 'sm' | 'lg';
}) {
  const [hovered, setHovered] = useState(0);
  const iconSize = size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="focus:outline-none transition-transform hover:scale-110"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
        >
          <Star
            className={cn(
              iconSize,
              'transition-colors',
              (hovered || value) >= star
                ? 'fill-warning text-warning'
                : 'text-muted-foreground/30'
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function FeedbackDialog({
  open,
  onOpenChange,
  bookingId,
  guestId,
  guestName,
  propertyId,
  onSuccess,
}: FeedbackDialogProps) {
  const { user } = useAuth();
  const { submitFeedback } = useGuestFeedback();
  const [overallRating, setOverallRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCategoryRating = (key: string, value: number) => {
    setCategoryRatings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (overallRating === 0) {
      toast.error('Please provide an overall rating');
      return;
    }
    if (!user?.id) return;

    setSubmitting(true);
    try {
      await submitFeedback({
        booking_id: bookingId,
        guest_id: guestId,
        property_id: propertyId,
        rating: overallRating,
        comment: comment.trim() || '',
        categories: categoryRatings,
        created_by: user.id,
      });
      toast.success('Feedback submitted successfully');
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      if (error?.code === '23505') {
        toast.error('Feedback has already been submitted for this booking');
      } else {
        console.error('Error submitting feedback:', error);
        toast.error('Failed to submit feedback');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setOverallRating(0);
    setCategoryRatings({});
    setComment('');
  };

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-warning" />
            Guest Feedback
          </DialogTitle>
          <DialogDescription>
            Record feedback from <strong>{guestName}</strong> for this stay
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Overall Rating */}
          <div className="space-y-2 text-center">
            <Label className="text-sm font-medium">Overall Rating</Label>
            <div className="flex justify-center">
              <StarRating value={overallRating} onChange={setOverallRating} size="lg" />
            </div>
            {overallRating > 0 && (
              <p className="text-sm font-medium text-warning">
                {ratingLabels[overallRating]}
              </p>
            )}
          </div>

          {/* Category Ratings */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Category Ratings (Optional)</Label>
            <div className="grid gap-3">
              {FEEDBACK_CATEGORIES.map((cat) => (
                <div
                  key={cat.key}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40"
                >
                  <span className="text-sm font-medium">{cat.label}</span>
                  <StarRating
                    value={categoryRatings[cat.key] || 0}
                    onChange={(v) => handleCategoryRating(cat.key, v)}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Guest Comments (Optional)</Label>
            <Textarea
              placeholder="Any comments from the guest about their stay..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/1000
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || overallRating === 0}>
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { StarRating };
