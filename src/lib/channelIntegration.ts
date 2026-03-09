/**
 * Channel Integration Service
 * 
 * This module provides a standardized interface for pushing rates and availability
 * to external OTA channels (Booking.com, Airbnb, Expedia, Agoda).
 * 
 * Factory pattern implementation routes requests to the correct OTA provider.
 */

import { supabase } from '@/integrations/supabase/client';
import { BookingComIntegration } from './integrations/bookingCom';
import { AirbnbIntegration } from './integrations/airbnb';
import { ExpediaIntegration } from './integrations/expedia';
import { AgodaIntegration } from './integrations/agoda';

export interface IChannelIntegration {
  /**
   * Test API connection to the OTA
   * @returns Promise with connection result
   */
  testConnection(): Promise<{ success: boolean; message: string }>;

  /**
   * Push rate updates to OTA channel
   * Note: Implementation details vary by OTA provider
   */
  pushRates(...args: any[]): Promise<any>;

  /**
   * Push availability updates to OTA channel
   * Note: Implementation details vary by OTA provider
   */
  pushAvailability(...args: any[]): Promise<any>;
}

/**
 * OTA Integration Factory
 * Routes API calls to the appropriate OTA provider based on integration configuration
 */
class OtaIntegrationFactory {
  /**
   * Get configured OTA integrations for a property
   */
  static async getIntegrations(propertyId: string) {
    const { data, error } = await supabase
      .from('ota_integrations')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_enabled', true);

    if (error) {
      console.error('Failed to fetch OTA integrations:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Create an instance of the appropriate OTA integration class
   */
  static createIntegration(
    otaName: string,
    apiKey: string,
    integrationId: string,
    propertyId: string,
    sandboxMode: boolean
  ): IChannelIntegration | null {
    switch (otaName) {
      case 'booking_com':
        return new BookingComIntegration(apiKey, integrationId, propertyId, sandboxMode);
      case 'airbnb':
        return new AirbnbIntegration(apiKey, integrationId, propertyId, sandboxMode);
      case 'expedia':
        return new ExpediaIntegration(apiKey, integrationId, propertyId, sandboxMode);
      case 'agoda':
        return new AgodaIntegration(apiKey, integrationId, propertyId, sandboxMode);
      default:
        console.warn(`Unknown OTA type: ${otaName}`);
        return null;
    }
  }

  /**
   * Test connection for a specific integration
   */
  static async testConnection(integrationId: string): Promise<{ success: boolean; message: string }> {
    const { data: integration, error } = await supabase
      .from('ota_integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (error || !integration) {
      return { success: false, message: 'Integration not found' };
    }

    if (!integration.api_key) {
      return { success: false, message: 'API key not configured' };
    }

    const otaClient = this.createIntegration(
      integration.ota_name,
      integration.api_key,
      integration.id,
      integration.property_id,
      integration.sandbox_mode ?? true
    );

    if (!otaClient) {
      return { success: false, message: 'Unsupported OTA type' };
    }

    return await otaClient.testConnection();
  }
}

/**
 * Export factory for creating OTA integrations
 */
export { OtaIntegrationFactory };

/**
 * Helper function to push rates to all enabled OTA integrations
 * Call this after rate overrides, seasonal rules, or rate plan updates
 */
export async function syncRateChange(
  propertyId: string,
  roomTypeId: string,
  ratePlanId: string
): Promise<void> {
  try {
    const integrations = await OtaIntegrationFactory.getIntegrations(propertyId);

    // For now, just log - real implementation would calculate dates and rates
    console.log('[Channel Integration] Rate sync triggered for', {
      propertyId,
      roomTypeId,
      ratePlanId,
      integrationCount: integrations.length,
    });

    // TODO: Implement actual rate calculation and batch push
    // Each OTA has different API signature requirements
  } catch (error) {
    console.error('[Channel Integration] Rate sync failed:', error);
    // Don't throw - continue operation even if OTA sync fails
  }
}

/**
 * Helper function to push availability to all enabled OTA integrations
 * Call this after bookings are created, modified, or cancelled
 */
export async function syncAvailabilityChange(
  propertyId: string,
  roomTypeId: string,
  date: string,
  status: 'available' | 'blocked'
): Promise<void> {
  try {
    const integrations = await OtaIntegrationFactory.getIntegrations(propertyId);

    for (const integration of integrations) {
      if (!integration.api_key) continue;

      const otaClient = OtaIntegrationFactory.createIntegration(
        integration.ota_name,
        integration.api_key,
        integration.id,
        propertyId,
        integration.sandbox_mode ?? true
      );

      if (otaClient) {
        await otaClient.pushAvailability(propertyId, roomTypeId, date, status);
      }
    }
  } catch (error) {
    console.error('[Channel Integration] Availability sync failed:', error);
    // Don't throw - continue operation even if OTA sync fails
  }
}
