/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reloading creates a new module instance on every
 * reload. Without this pattern we'd exhaust database connections quickly.
 * We attach the client to the global object so it persists across HMR cycles.
 * In production, the module is instantiated once and this guard is irrelevant.
 */
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
