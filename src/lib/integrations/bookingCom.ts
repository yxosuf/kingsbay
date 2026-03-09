/**
 * Booking.com OTA Integration
 * 
 * Handles rate and availability synchronization with Booking.com
 * Uses Booking.com's Connectivity API
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

export class BookingComIntegration {
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
      ? 'https://sandbox.booking.com/api/v1'
      : 'https://connect.booking.com/api/v1';
  }

  async testConnection(): Promise<OtaConnectionResult> {
    const logId = await this.createSyncLog('test_connection', 'pending');

    try {
      // Test connection by fetching property details
      const response = await fetch(`${this.getBaseUrl()}/properties`, {
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
          message: 'Successfully connected to Booking.com API',
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

  async pushRates(roomTypeId: string, ratePlanId: string, dates: string[], rates: number[]): Promise<OtaPushResult> {
    const logId = await this.createSyncLog('rate_push', 'pending', {
      roomTypeId,
      ratePlanId,
      dates,
      rates,
    });

    try {
      const payload = {
        room_type_id: roomTypeId,
        rate_plan_id: ratePlanId,
        rates: dates.map((date, idx) => ({
          date,
          rate: rates[idx],
        })),
      };

      const response = await fetch(`${this.getBaseUrl()}/rates`, {
        method: 'POST',
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

  async pushAvailability(roomTypeId: string, date: string, available: boolean): Promise<OtaPushResult> {
    const logId = await this.createSyncLog('availability_push', 'pending', {
      roomTypeId,
      date,
      available,
    });

    try {
      const payload = {
        room_type_id: roomTypeId,
        date,
        availability: available ? 1 : 0,
      };

      const response = await fetch(`${this.getBaseUrl()}/availability`, {
        method: 'POST',
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
        ota_name: 'booking_com',
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
  }
}
