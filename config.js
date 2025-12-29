// Supabase Configuration
// Credentials are provided via GitHub Secrets (in CI/CD environment)
// or from environment variables if available

const SUPABASE_CONFIG = {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
};
