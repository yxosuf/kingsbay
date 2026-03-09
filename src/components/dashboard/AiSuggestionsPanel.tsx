import { useEffect } from 'react';
import { useAiSuggestions } from '@/hooks/useAiSuggestions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, ShoppingBag, BedDouble, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiSuggestionsPanelProps {
  type: 'room_allocation' | 'occupancy_forecast' | 'cross_sell';
  context: Record<string, any>;
  className?: string;
}

const ICONS: Record<string, typeof Sparkles> = {
  room: BedDouble,
  upgrade: TrendingUp,
  forecast: TrendingUp,
  upsell: ShoppingBag,
  service: ShoppingBag,
};

export function AiSuggestionsPanel({ type, context, className }: AiSuggestionsPanelProps) {
  const { suggestions, loading, source, fetchSuggestions } = useAiSuggestions();

  useEffect(() => {
    if (Object.keys(context).length > 0) {
      fetchSuggestions(type, context);
    }
  }, [type, JSON.stringify(context)]);

  if (loading) {
    return (
      <Card className={cn('border-primary/20', className)}>
        <CardContent className="py-4 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Getting suggestions...</span>
        </CardContent>
      </Card>
    );
  }

  if (!suggestions.length) return null;

  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Suggestions
          {source && (
            <Badge variant="outline" className="text-[10px] ml-auto">
              {source === 'ai' ? 'AI' : 'Smart Rules'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {suggestions.map((s, i) => {
          const Icon = ICONS[s.type] || Sparkles;
          return (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-background/80">
              <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                {s.name && <p className="text-sm font-medium">{s.name}</p>}
                {s.room_number && <p className="text-sm font-medium">Room {s.room_number}</p>}
                {s.reason && <p className="text-xs text-muted-foreground">{s.reason}</p>}
                {s.recommendation && <p className="text-xs text-muted-foreground">{s.recommendation}</p>}
                {s.price != null && (
                  <p className="text-xs font-medium text-primary mt-0.5">
                    LKR {Number(s.price).toLocaleString()}
                  </p>
                )}
                {s.extra_cost != null && (
                  <p className="text-xs font-medium text-success mt-0.5">
                    +LKR {Number(s.extra_cost).toLocaleString()} upgrade
                  </p>
                )}
                {s.predicted_occupancy != null && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={s.risk === 'high' ? 'destructive' : s.risk === 'medium' ? 'warning' : 'success'} className="text-[10px]">
                      {s.risk} demand
                    </Badge>
                    <span className="text-xs">{s.predicted_occupancy}% predicted</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
