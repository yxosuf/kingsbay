import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HousekeepingBoard } from '@/components/housekeeping/HousekeepingBoard';

export default function Housekeeping() {
  return (
    <DashboardLayout title="Housekeeping Board">
      <HousekeepingBoard />
    </DashboardLayout>
  );
}
