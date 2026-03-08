import { Star, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { GuestFeedback } from '@/hooks/useGuestFeedback';

const CATEGORY_LABELS: Record<string, string> = {
  cleanliness: 'Cleanliness',
  comfort: 'Comfort',
  service: 'Service',
  location: 'Location',
  value: 'Value for Money',
};

function InlineStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'xs' }) {
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-3 w-3';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            iconSize,
            s <= rating ? 'fill-warning text-warning' : 'text-muted-foreground/20'
          )}
        />
      ))}
    </div>
  );
}

export function FeedbackCard({ feedback }: { feedback: GuestFeedback }) {
  const categoryEntries = Object.entries(feedback.categories || {}).filter(
    ([, v]) => v > 0
  );

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <InlineStars rating={feedback.rating} />
          <span className="text-xs text-muted-foreground">
            {format(new Date(feedback.created_at), 'PP')}
          </span>
        </div>

        {categoryEntries.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {categoryEntries.map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{CATEGORY_LABELS[key] || key}</span>
                <InlineStars rating={val} size="xs" />
              </div>
            ))}
          </div>
        )}

        {feedback.comment && (
          <div className="flex gap-2 pt-1">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground italic">"{feedback.comment}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FeedbackSummary({
  feedback,
  averageRating,
}: {
  feedback: GuestFeedback[];
  averageRating: number;
}) {
  if (feedback.length === 0) return null;

  // Aggregate category averages
  const categoryTotals: Record<string, { sum: number; count: number }> = {};
  feedback.forEach((f) => {
    Object.entries(f.categories || {}).forEach(([key, val]) => {
      if (val > 0) {
        if (!categoryTotals[key]) categoryTotals[key] = { sum: 0, count: 0 };
        categoryTotals[key].sum += val;
        categoryTotals[key].count += 1;
      }
    });
  });

  // Rating distribution
  const distribution = [0, 0, 0, 0, 0];
  feedback.forEach((f) => {
    distribution[f.rating - 1] += 1;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4 text-warning" />
          Feedback Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">{averageRating.toFixed(1)}</p>
            <InlineStars rating={Math.round(averageRating)} />
            <p className="text-xs text-muted-foreground mt-1">{feedback.length} review{feedback.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star - 1];
              const pct = feedback.length > 0 ? (count / feedback.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-muted-foreground">{star}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-warning rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-5 text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {Object.keys(categoryTotals).length > 0 && (
          <div className="pt-2 border-t grid grid-cols-2 gap-2">
            {Object.entries(categoryTotals).map(([key, { sum, count }]) => {
              const avg = sum / count;
              return (
                <div key={key} className="flex items-center justify-between text-xs p-2 rounded bg-muted/40">
                  <span className="text-muted-foreground">{CATEGORY_LABELS[key] || key}</span>
                  <span className="font-medium">{avg.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
