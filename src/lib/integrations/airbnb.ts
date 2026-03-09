/**
 * Airbnb OTA Integration
 * 
 * Handles rate and availability synchronization with Airbnb
 * Uses Airbnb's Host API
 */

import { supabase } from '@/integrations/supabase/client';

export interface OtaConnectionResult {
  success: boolean;
  message: string;
  errorCode?: string;
}

export interface OtaPushResult {
  success: boolean;
  message: string;
  syncLogId?: string;
}

export class AirbnbIntegration {
  private apiKey: string;
  private sandboxMode: boolean;
  private integrationId: string;
  private propertyId: string;

  constructor(apiKey: string, integrationId: string, propertyId: string, sandboxMode: boolean = true) {
    this.apiKey = apiKey;
    this.sandboxMode = sandboxMode;
    this.integrationId = integrationId;
    this.propertyId = propertyId;
  }

  private getBaseUrl(): string {
    return this.sandboxMode
      ? 'https://api.airbnb.sandbox.com/v2'
      : 'https://api.airbnb.com/v2';
  }

  async testConnection(): Promise<OtaConnectionResult> {
    const logId = await this.createSyncLog('test_connection', 'pending');

    try {
      const response = await fetch(`${this.getBaseUrl()}/listings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await this.updateSyncLog(logId, 'success', 'Connection successful');
        return {
          success: true,
          message: 'Successfully connected to Airbnb API',
        };
      } else {
        const error = await response.text();
        await this.updateSyncLog(logId, 'failure', undefined, `HTTP ${response.status}: ${error}`);
        return {
          success: false,
          message: `Failed to connect: ${response.status} ${response.statusText}`,
          errorCode: `HTTP_${response.status}`,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.updateSyncLog(logId, 'failure', undefined, errorMsg);
      return {
        success: false,
        message: `Connection error: ${errorMsg}`,
        errorCode: 'NETWORK_ERROR',
      };
    }
  }

  async pushRates(listingId: string, dates: string[], rates: number[]): Promise<OtaPushResult> {
    const logId = await this.createSyncLog('rate_push', 'pending', {
      listingId,
      dates,
      rates,
    });

    try {
      const payload = {
        listing_id: listingId,
        daily_prices: dates.map((date, idx) => ({
          date,
          price: rates[idx],
          currency: 'LKR',
        })),
      };

      const response = await fetch(`${this.getBaseUrl()}/calendar_pricing`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        await this.updateSyncLog(logId, 'success', JSON.stringify(result));
        return {
          success: true,
          message: `Rates pushed successfully for ${dates.length} dates`,
          syncLogId: logId,
        };
      } else {
        const error = await response.text();
        await this.updateSyncLog(logId, 'failure', undefined, `HTTP ${response.status}: ${error}`);
        return {
          success: false,
          message: `Failed to push rates: ${response.status}`,
          syncLogId: logId,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.updateSyncLog(logId, 'failure', undefined, errorMsg);
      return {
        success: false,
        message: `Error pushing rates: ${errorMsg}`,
        syncLogId: logId,
      };
    }
  }

  async pushAvailability(listingId: string, date: string, available: boolean): Promise<OtaPushResult> {
    const logId = await this.createSyncLog('availability_push', 'pending', {
      listingId,
      date,
      available,
    });

    try {
      const payload = {
        listing_id: listingId,
        availability_rules: [
          {
            date,
            availability: available ? 'available' : 'unavailable',
          },
        ],
      };

      const response = await fetch(`${this.getBaseUrl()}/calendar_availability`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        await this.updateSyncLog(logId, 'success', JSON.stringify(result));
        return {
          success: true,
          message: `Availability updated for ${date}`,
          syncLogId: logId,
        };
      } else {
        const error = await response.text();
        await this.updateSyncLog(logId, 'failure', undefined, `HTTP ${response.status}: ${error}`);
        return {
          success: false,
          message: `Failed to update availability: ${response.status}`,
          syncLogId: logId,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.updateSyncLog(logId, 'failure', undefined, errorMsg);
      return {
        success: false,
        message: `Error updating availability: ${errorMsg}`,
        syncLogId: logId,
      };
    }
  }

  private async createSyncLog(
    actionType: 'rate_push' | 'availability_push' | 'test_connection',
    status: 'pending' | 'success' | 'failure',
    requestPayload?: any
  ): Promise<string> {
    const { data, error } = await supabase
      .from('ota_sync_logs')
      .insert({
        property_id: this.propertyId,
        integration_id: this.integrationId,
        ota_name: 'airbnb',
        action_type: actionType,
        status,
        request_payload: requestPayload,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create sync log:', error);
      throw new Error('Failed to create sync log');
    }

    return data.id;
  }

  private async updateSyncLog(
    logId: string,
    status: 'success' | 'failure',
    responseMessage?: string,
    errorMessage?: string
  ): Promise<void> {
    // Get current retry count
    const { data: logData } = await supabase
      .from('ota_sync_logs')
      .select('retry_count')
      .eq('id', logId)
      .single();

    const retryCount = logData?.retry_count || 0;

    const { error } = await supabase
      .from('ota_sync_logs')
      .update({
        status,
        response_message: responseMessage,
        error_message: errorMessage,
      })
      .eq('id', logId);

    if (error) {
      console.error('Failed to update sync log:', error);
    }

    // Send notification after 3+ failures
    if (status === 'failure' && retryCount >= 3) {
      await this.sendFailureNotification(errorMessage || 'Unknown error');
    }
  }

  private async sendFailureNotification(errorMessage: string): Promise<void> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            property_id: this.propertyId,
            type: 'channel_sync',
            category: 'channel_sync',
            priority: 'high',
            title: 'OTA Sync Failed',
            message: `Airbnb sync failed after multiple retries: ${errorMessage}`,
            target_roles: ['admin', 'manager'],
          }),
        }
      );

      if (!response.ok) {
        console.error('Failed to send notification:', await response.text());
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }
}
