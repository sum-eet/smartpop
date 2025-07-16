/// <reference types="vite/client" />
/// <reference types="@remix-run/node" />

declare global {
  var __prisma: PrismaClient | undefined;
}

export {};
