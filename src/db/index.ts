import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema";

type Database = ReturnType<typeof createDb>;

// Netlify Database configures the connection automatically — no connection string needed.
function createDb() {
  return drizzle({ schema });
}

const globalForDb = globalThis as typeof globalThis & {
  __netlifyDb?: Database;
};

function getDb(): Database {
  globalForDb.__netlifyDb ??= createDb();
  return globalForDb.__netlifyDb;
}

// Connect lazily so importing this module during `next build` (page data
// collection) doesn't require database credentials.
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
