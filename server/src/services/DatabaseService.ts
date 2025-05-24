import { PrismaClient } from '@prisma/client'

export class DatabaseService {
  private static instance: DatabaseService
  private prisma: PrismaClient

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    })
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  public getClient(): PrismaClient {
    return this.prisma
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect()
      console.log('✅ Database connected successfully')
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      throw error
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect()
      console.log('📡 Database disconnected')
    } catch (error) {
      console.error('❌ Database disconnection failed:', error)
      throw error
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('❌ Database health check failed:', error)
      return false
    }
  }

  // Cleanup method for graceful shutdown
  public async cleanup(): Promise<void> {
    // Delete inactive sessions older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    try {
      const result = await this.prisma.session.deleteMany({
        where: {
          OR: [{ isActive: false }, { createdAt: { lt: twentyFourHoursAgo } }],
        },
      })

      if (result.count > 0) {
        console.log(`🧹 Cleaned up ${result.count} inactive sessions`)
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error)
    }
  }
}
