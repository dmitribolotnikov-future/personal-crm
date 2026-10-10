// Connection settings come from the same POSTGRES_* variables in .env that
// compose.yaml uses to create the database, so the password lives in one place.
// Shared by the app (src/db/index.ts) and drizzle-kit (drizzle.config.ts).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}: set it in .env`);
  }
  return value;
}

export function getConnectionConfig() {
  return {
    // compose.yaml publishes Postgres on 127.0.0.1 only
    host: "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: requireEnv("POSTGRES_USER"),
    password: requireEnv("POSTGRES_PASSWORD"),
    database: requireEnv("POSTGRES_DB"),
    ssl: false,
  };
}
