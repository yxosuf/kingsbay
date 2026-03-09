import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OtaIntegration {
  id: string;
  property_id: string;
  ota_name: string;
  display_name: string;
  api_key: string | null;
  is_enabled: boolean;
  status: string;
  last_rate_push_at: string | null;
  last_availability_push_at: string | null;
  sandbox_mode: boolean;
  auto_retry_enabled: boolean;
  max_retries: number;
}

export interface OtaSyncLog {
  id: string;
  property_id: string;
  integration_id: string;
  ota_name: string;
  action_type: 'rate_push' | 'availability_push' | 'test_connection';
  status: 'success' | 'failure' | 'pending';
  request_payload: any;
  response_message: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

export function useOtaSync(propertyId?: string) {
  const queryClient = useQueryClient();

  const { data: integrations, isLoading: integrationsLoading } = useQuery({
    queryKey: ['ota-integrations', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];

      const { data, error } = await supabase
        .from('ota_integrations')
        .select('*')
        .eq('property_id', propertyId)
        .order('display_name');

      if (error) throw error;
      return (data || []) as OtaIntegration[];
    },
    enabled: !!propertyId,
  });

  const { data: syncLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['ota-sync-logs', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];

      const { data, error } = await supabase
        .from('ota_sync_logs')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as OtaSyncLog[];
    },
    enabled: !!propertyId,
  });

  const saveApiKey = useMutation({
    mutationFn: async ({
      integrationId,
      apiKey,
      sandboxMode,
    }: {
      integrationId: string;
      apiKey: string;
      sandboxMode: boolean;
    }) => {
      const { error } = await supabase
        .from('ota_integrations')
        .update({
          api_key: apiKey,
          sandbox_mode: sandboxMode,
          status: 'disabled', // Will be activated after test connection
        })
        .eq('id', integrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ota-integrations', propertyId] });
      toast.success('API key saved successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to save API key: ' + error.message);
    },
  });

  const deleteApiKey = useMutation({
    mutationFn: async (integrationId: string) => {
      const { error } = await supabase
        .from('ota_integrations')
        .update({
          api_key: null,
          is_enabled: false,
          status: 'coming_soon',
        })
        .eq('id', integrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ota-integrations', propertyId] });
      toast.success('API key removed');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove API key: ' + error.message);
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({
      integrationId,
      enabled,
    }: {
      integrationId: string;
      enabled: boolean;
    }) => {
      const { error } = await supabase
        .from('ota_integrations')
        .update({ is_enabled: enabled })
        .eq('id', integrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ota-integrations', propertyId] });
    },
    onError: (error: Error) => {
      toast.error('Failed to update integration: ' + error.message);
    },
  });

  const updateRetrySettings = useMutation({
    mutationFn: async ({
      integrationId,
      autoRetryEnabled,
      maxRetries,
    }: {
      integrationId: string;
      autoRetryEnabled: boolean;
      maxRetries: number;
    }) => {
      const { error } = await supabase
        .from('ota_integrations')
        .update({
          auto_retry_enabled: autoRetryEnabled,
          max_retries: maxRetries,
        })
        .eq('id', integrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ota-integrations', propertyId] });
      toast.success('Retry settings updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update retry settings: ' + error.message);
    },
  });

  const testConnection = useMutation({
    mutationFn: async (integrationId: string) => {
      const { OtaIntegrationFactory } = await import('@/lib/channelIntegration');
      return await OtaIntegrationFactory.testConnection(integrationId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ota-sync-logs', propertyId] });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    },
    onError: (error: Error) => {
      toast.error('Test failed: ' + error.message);
    },
  });

  return {
    integrations: integrations || [],
    syncLogs: syncLogs || [],
    integrationsLoading,
    logsLoading,
    saveApiKey,
    deleteApiKey,
    toggleEnabled,
    updateRetrySettings,
    testConnection,
  };
}
