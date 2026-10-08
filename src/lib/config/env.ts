// Centralised, validated access to environment variables. Anything read
// through this module fails fast and loudly at startup instead of quietly
// producing `undefined` deep inside a request handler.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  supabase: {
    url: () => required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  },
  ai: {
    provider: () => (process.env.AI_PROVIDER ?? "anthropic") as "anthropic" | "openai",
    apiKey: () => required("AI_API_KEY"),
    model: () => required("AI_MODEL"),
    fastModel: () => process.env.AI_MODEL_FAST || required("AI_MODEL"),
  },
  paystack: {
    secretKey: () => required("PAYSTACK_SECRET_KEY"),
    publicKey: () => required("NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY"),
    priceKobo: () => Number(process.env.CV_OPTIMIZATION_PRICE_KOBO ?? "500000"),
  },
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};
