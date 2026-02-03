import { z } from 'zod';

export const AuthenticateInputSchema = z.object({
  url: z.string().url().describe('Odoo server URL (e.g., http://localhost:8069)'),
  database: z.string().min(1).describe('Database name'),
  username: z.string().min(1).describe('Username (typically email)'),
  password: z.string().min(1).describe('User password or API key'),
});

export type AuthenticateInput = z.infer<typeof AuthenticateInputSchema>;

export interface AuthenticateOutput {
  success: boolean;
  uid?: number;
  database?: string;
  message: string;
}

export interface LogoutOutput {
  success: boolean;
  message: string;
}

export interface ConnectionStatusOutput {
  success: boolean;
  connected: boolean;
  authenticated: boolean;
  url?: string;
  database?: string;
  uid?: number;
  connectedAt?: string;
  message: string;
}
