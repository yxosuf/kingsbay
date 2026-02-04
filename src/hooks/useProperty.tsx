import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Property {
  id: string;
  name: string;
  property_type: 'hotel' | 'villa' | 'resort' | 'apartment' | 'guesthouse';
  location: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  total_rooms: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PropertyContextType {
  properties: Property[];
  selectedProperty: Property | null;
  setSelectedProperty: (property: Property | null) => void;
  loading: boolean;
  refetchProperties: () => Promise<void>;
  showAllProperties: boolean;
  setShowAllProperties: (show: boolean) => void;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

const SELECTED_PROPERTY_KEY = 'selectedPropertyId';

export function PropertyProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedPropertyState] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllProperties, setShowAllProperties] = useState(false);

  const fetchProperties = async () => {
    if (!user) {
      setProperties([]);
      setSelectedPropertyState(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const fetchedProperties = (data as Property[]) || [];
      setProperties(fetchedProperties);

      // Restore selected property from localStorage or select first one
      const savedPropertyId = localStorage.getItem(SELECTED_PROPERTY_KEY);
      const savedProperty = fetchedProperties.find((p) => p.id === savedPropertyId);

      if (savedProperty) {
        setSelectedPropertyState(savedProperty);
      } else if (fetchedProperties.length > 0) {
        setSelectedPropertyState(fetchedProperties[0]);
        localStorage.setItem(SELECTED_PROPERTY_KEY, fetchedProperties[0].id);
      } else {
        setSelectedPropertyState(null);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchProperties();
    }
  }, [user, authLoading]);

  const setSelectedProperty = (property: Property | null) => {
    setSelectedPropertyState(property);
    if (property) {
      localStorage.setItem(SELECTED_PROPERTY_KEY, property.id);
      setShowAllProperties(false);
    } else {
      localStorage.removeItem(SELECTED_PROPERTY_KEY);
    }
  };

  return (
    <PropertyContext.Provider
      value={{
        properties,
        selectedProperty,
        setSelectedProperty,
        loading,
        refetchProperties: fetchProperties,
        showAllProperties,
        setShowAllProperties,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
}
