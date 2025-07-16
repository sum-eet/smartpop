import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient;
}

console.log("🔍 Database connection:", {
  nodeEnv: process.env.NODE_ENV,
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  databaseUrl: process.env.DATABASE_URL?.substring(0, 30) + "..."
});

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    console.log("🔍 Creating new Prisma client for development");
    global.prismaGlobal = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Test database connection
prisma.$connect().then(() => {
  console.log("✅ Database connected successfully");
}).catch((error) => {
  console.error("💥 Database connection failed:", error);
});

export default prisma;
