// Connection settings come from the same POSTGRES_* variables in .env that
// compose.yaml uses to create the database, so the password lives in one place.
// Shared by the app (src/db/index.ts), drizzle-kit (drizzle.config.ts) and scripts/.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}: set it in .env`);
  }
  return value;
}

export function getConnectionConfig() {
  return {
    // Locally compose.yaml publishes Postgres on 127.0.0.1 only;
    // on the server deploy/compose.yaml sets POSTGRES_HOST to the database container
    host: process.env.POSTGRES_HOST ?? "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: requireEnv("POSTGRES_USER"),
    password: requireEnv("POSTGRES_PASSWORD"),
    database: requireEnv("POSTGRES_DB"),
    ssl: false,
  };
}
