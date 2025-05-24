import { PrismaClient } from '@prisma/client'
import { Route, RoutePoint } from '../types'
import { DatabaseService } from './DatabaseService'

export class RouteService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = DatabaseService.getInstance().getClient()
  }

  async createRoute(
    name: string,
    points: RoutePoint[],
    createdBy: string,
    description?: string,
    isTemplate: boolean = true,
    distance?: number
  ): Promise<Route> {
    const routeData = await this.prisma.route.create({
      data: {
        name,
        description,
        points: points as any, // Prisma Json type
        createdBy,
        isTemplate,
        distance,
      },
    })

    return this.mapPrismaRouteToRoute(routeData)
  }

  async updateRoute(
    routeId: string,
    updatedBy: string,
    updates: {
      name?: string
      description?: string
      points?: RoutePoint[]
      distance?: number
    }
  ): Promise<Route | null> {
    try {
      // Verify the route exists and the user has permission to update it
      const existingRoute = await this.prisma.route.findUnique({
        where: { id: routeId },
      })

      if (!existingRoute) {
        return null
      }

      // For now, allow updates by creator or any user
      // In the future, you might want to add more sophisticated permission checks

      const routeData = await this.prisma.route.update({
        where: { id: routeId },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.points && { points: updates.points as any }),
          ...(updates.distance !== undefined && { distance: updates.distance }),
        },
      })

      return this.mapPrismaRouteToRoute(routeData)
    } catch (error) {
      console.error('Error updating route:', error)
      return null
    }
  }

  async deleteRoute(routeId: string, deletedBy: string): Promise<boolean> {
    try {
      // Verify the route exists
      const existingRoute = await this.prisma.route.findUnique({
        where: { id: routeId },
      })

      if (!existingRoute) {
        return false
      }

      // Check if route is being used in any active sessions
      const activeSessions = await this.prisma.session.count({
        where: {
          routeId: routeId,
          isActive: true,
        },
      })

      if (activeSessions > 0) {
        throw new Error('Cannot delete route that is being used in active sessions')
      }

      await this.prisma.route.delete({
        where: { id: routeId },
      })

      return true
    } catch (error) {
      console.error('Error deleting route:', error)
      return false
    }
  }

  async getRoute(routeId: string): Promise<Route | null> {
    try {
      const routeData = await this.prisma.route.findUnique({
        where: { id: routeId },
      })

      return routeData ? this.mapPrismaRouteToRoute(routeData) : null
    } catch (error) {
      console.error('Error getting route:', error)
      return null
    }
  }

  async listRoutes(filters?: { createdBy?: string; templatesOnly?: boolean }): Promise<Route[]> {
    try {
      const where: any = {}

      if (filters?.createdBy) {
        where.createdBy = filters.createdBy
      }

      if (filters?.templatesOnly) {
        where.isTemplate = true
      }

      const routesData = await this.prisma.route.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
      })

      return routesData.map(this.mapPrismaRouteToRoute)
    } catch (error) {
      console.error('Error listing routes:', error)
      return []
    }
  }

  async duplicateRoute(
    routeId: string,
    newName: string,
    createdBy: string,
    isTemplate: boolean = false
  ): Promise<Route | null> {
    try {
      const originalRoute = await this.getRoute(routeId)
      if (!originalRoute) {
        return null
      }

      return await this.createRoute(
        newName,
        originalRoute.points,
        createdBy,
        originalRoute.description,
        isTemplate
      )
    } catch (error) {
      console.error('Error duplicating route:', error)
      return null
    }
  }

  private mapPrismaRouteToRoute(prismaRoute: any): Route {
    return {
      id: prismaRoute.id,
      name: prismaRoute.name,
      description: prismaRoute.description,
      points: prismaRoute.points as RoutePoint[],
      distance: prismaRoute.distance,
      createdBy: prismaRoute.createdBy,
      createdAt: prismaRoute.createdAt.getTime(),
      updatedAt: prismaRoute.updatedAt.getTime(),
      isTemplate: prismaRoute.isTemplate,
    }
  }
}
