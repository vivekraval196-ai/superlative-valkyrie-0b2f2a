import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 254 }).unique(),
    passwordHash: varchar("password_hash", { length: 256 }),
    isGuest: boolean("is_guest").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("users_email_idx").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const loanCalculations = pgTable(
  "loan_calculations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    vehicle: varchar("vehicle", { length: 120 }).notNull(),
    vehiclePrice: numeric("vehicle_price", { precision: 12, scale: 2 }).notNull(),
    downPayment: numeric("down_payment", { precision: 12, scale: 2 }).notNull(),
    termMonths: integer("term_months").notNull(),
    interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
    annualInsurance: numeric("annual_insurance", { precision: 12, scale: 2 }).notNull(),
    annualMaintenance: numeric("annual_maintenance", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("loan_calculations_user_created_idx").on(table.userId, table.createdAt),
  ],
);
