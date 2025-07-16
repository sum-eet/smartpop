import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

console.log("🔍 Database connection:", {
  nodeEnv: process.env.NODE_ENV,
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  databaseUrl: process.env.DATABASE_URL?.substring(0, 30) + "..."
});

const prisma = global.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ['query', 'info', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV === "development") {
  global.__prisma = prisma;
}

// Test database connection
prisma.$connect().then(() => {
  console.log("✅ Database connected successfully");
}).catch((error) => {
  console.error("💥 Database connection failed:", error);
});

export default prisma;
