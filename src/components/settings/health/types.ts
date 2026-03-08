import { ReactNode } from 'react';

export interface HealthCheck {
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warn' | 'loading';
  detail?: string;
  icon: ReactNode;
}

export interface HealthCategory {
  id: string;
  label: string;
  icon: ReactNode;
  checks: HealthCheck[];
}
