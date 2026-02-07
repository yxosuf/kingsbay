import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useProperty } from '@/hooks/useProperty';

interface PropertyRequiredAlertProps {
  message?: string;
}

export function PropertyRequiredAlert({ message }: PropertyRequiredAlertProps) {
  const { selectedProperty, properties } = useProperty();

  // Don't show if property is selected or no properties exist
  if (selectedProperty || properties.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>No Property Selected</AlertTitle>
      <AlertDescription>
        {message || 'Please select a property from the header dropdown to view and manage data.'}
      </AlertDescription>
    </Alert>
  );
}
