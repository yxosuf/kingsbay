import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HousekeepingBoard } from '@/components/housekeeping/HousekeepingBoard';
import { HousekeepingChecklist } from '@/components/housekeeping/HousekeepingChecklist';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function Housekeeping() {
  const [tab, setTab] = useState('rooms');

  return (
    <DashboardLayout title="Housekeeping">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="rooms">Room Status</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
        </TabsList>
        <TabsContent value="rooms">
          <HousekeepingBoard />
        </TabsContent>
        <TabsContent value="checklists">
          <HousekeepingChecklist />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
