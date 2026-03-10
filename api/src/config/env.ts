import dotenv from 'dotenv';

dotenv.config();

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required. Please add it to your environment.`);
  }
  return value;
};

const parseOrigins = (origins?: string): string[] => {
  if (!origins) {
    return [];
  }
  return origins.split(',').map((origin) => origin.trim()).filter(Boolean);
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3001,
  frontendOrigins: parseOrigins(process.env.FRONTEND_URL),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
};
