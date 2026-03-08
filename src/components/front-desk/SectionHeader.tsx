import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  count: number;
  color: string;
}

export function SectionHeader({ icon: Icon, title, count, color }: SectionHeaderProps) {
  return (
    <div className="text-base flex items-center gap-2 font-semibold">
      <Icon className={`h-4 w-4 ${color}`} />
      {title}
      <Badge variant="secondary" className="ml-auto">{count}</Badge>
    </div>
  );
}
