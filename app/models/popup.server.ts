import prisma from "../db.server";

// Type definitions for popup data
export type PopupData = {
  shop: string;
  title: string;
  isActive: boolean;
  triggerType: string;
  triggerValue: number;
  heading: string;
  description: string | null;
  buttonText: string;
  discountCode: string | null;
};

export type PopupCreateData = Omit<PopupData, 'shop'> & {
  shop: string;
};

export type PopupUpdateData = Partial<PopupData>;

export type AnalyticsEvent = {
  popupId: string;
  event: 'view' | 'conversion' | 'close';
  sessionId: string;
  userAgent?: string;
  referrer?: string;
};

// === POPUP CRUD OPERATIONS ===

export async function createPopup(data: PopupData) {
  try {
    return await prisma.popup.create({
      data: {
        ...data,
        views: 0,
        conversions: 0,
      },
    });
  } catch (error) {
    console.error('Error creating popup:', error);
    throw new Error('Failed to create popup');
  }
}

export async function getAllPopups(shop: string, search?: string) {
  try {
    const where = {
      shop,
      ...(search && {
        title: {
          contains: search,
          mode: "insensitive" as const,
        },
      }),
    };

    return await prisma.popup.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            analytics: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error fetching popups:', error);
    throw new Error('Failed to fetch popups');
  }
}

export async function getPopupById(id: string, shop: string) {
  try {
    return await prisma.popup.findFirst({
      where: {
        id,
        shop,
      },
      include: {
        analytics: {
          orderBy: {
            timestamp: 'desc',
          },
          take: 100, // Last 100 events
        },
      },
    });
  } catch (error) {
    console.error('Error fetching popup by ID:', error);
    throw new Error('Failed to fetch popup');
  }
}

export async function updatePopup(id: string, data: PopupUpdateData) {
  try {
    return await prisma.popup.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error updating popup:', error);
    throw new Error('Failed to update popup');
  }
}

export async function deletePopup(id: string, shop: string) {
  try {
    // First verify the popup belongs to this shop
    const popup = await getPopupById(id, shop);
    if (!popup) {
      throw new Error('Popup not found');
    }

    // Delete will cascade to analytics due to foreign key constraint
    return await prisma.popup.delete({
      where: {
        id,
      },
    });
  } catch (error) {
    console.error('Error deleting popup:', error);
    throw new Error('Failed to delete popup');
  }
}

export async function togglePopupActive(id: string, shop: string) {
  try {
    const popup = await getPopupById(id, shop);
    if (!popup) {
      throw new Error("Popup not found");
    }

    return await prisma.popup.update({
      where: { id },
      data: {
        isActive: !popup.isActive,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error toggling popup status:', error);
    throw new Error('Failed to toggle popup status');
  }
}

// === ANALYTICS FUNCTIONS ===

export async function trackPopupEvent(data: AnalyticsEvent) {
  try {
    // Verify popup exists
    const popup = await prisma.popup.findUnique({
      where: { id: data.popupId },
    });

    if (!popup) {
      throw new Error('Popup not found');
    }

    // Create analytics record
    const analyticsRecord = await prisma.popupAnalytics.create({
      data: {
        popupId: data.popupId,
        event: data.event,
        sessionId: data.sessionId,
        userAgent: data.userAgent,
        referrer: data.referrer,
        timestamp: new Date(),
      },
    });

    // Update popup counters
    if (data.event === 'view') {
      await prisma.popup.update({
        where: { id: data.popupId },
        data: {
          views: {
            increment: 1,
          },
        },
      });
    } else if (data.event === 'conversion') {
      await prisma.popup.update({
        where: { id: data.popupId },
        data: {
          conversions: {
            increment: 1,
          },
        },
      });
    }

    return analyticsRecord;
  } catch (error) {
    console.error('Error tracking popup event:', error);
    throw new Error('Failed to track popup event');
  }
}

export async function getPopupStats(shop: string) {
  try {
    // Get total active popups
    const activePopups = await prisma.popup.count({
      where: {
        shop,
        isActive: true,
      },
    });

    // Get total views and conversions from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const analytics = await prisma.popupAnalytics.groupBy({
      by: ['event'],
      where: {
        popup: {
          shop,
        },
        timestamp: {
          gte: thirtyDaysAgo,
        },
      },
      _count: {
        event: true,
      },
    });

    const totalViews = analytics.find(a => a.event === 'view')?._count.event || 0;
    const totalConversions = analytics.find(a => a.event === 'conversion')?._count.event || 0;

    return {
      activePopups,
      totalViews,
      totalConversions,
    };
  } catch (error) {
    console.error('Error getting popup stats:', error);
    throw new Error('Failed to get popup statistics');
  }
}

export async function getRecentActivity(shop: string, limit: number = 10) {
  try {
    const activities = await prisma.popupAnalytics.findMany({
      where: {
        popup: {
          shop,
        },
      },
      include: {
        popup: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
    });

    return activities.map(activity => ({
      popupTitle: activity.popup.title,
      event: activity.event,
      timestamp: activity.timestamp,
    }));
  } catch (error) {
    console.error('Error getting recent activity:', error);
    throw new Error('Failed to get recent activity');
  }
}

export async function getPopupAnalytics(popupId: string, shop: string) {
  try {
    // Verify popup belongs to shop
    const popup = await prisma.popup.findFirst({
      where: {
        id: popupId,
        shop,
      },
    });

    if (!popup) {
      throw new Error('Popup not found');
    }

    // Get daily breakdown for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const analytics = await prisma.popupAnalytics.findMany({
      where: {
        popupId,
        timestamp: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    // Group by date
    const dailyStats = new Map<string, { views: number; conversions: number; closes: number }>();
    
    analytics.forEach(record => {
      const date = record.timestamp.toISOString().split('T')[0];
      if (!dailyStats.has(date)) {
        dailyStats.set(date, { views: 0, conversions: 0, closes: 0 });
      }
      
      const stats = dailyStats.get(date)!;
      if (record.event === 'view') {
        stats.views++;
      } else if (record.event === 'conversion') {
        stats.conversions++;
      } else if (record.event === 'close') {
        stats.closes++;
      }
    });

    const dailyBreakdown = Array.from(dailyStats.entries())
      .map(([date, stats]) => ({
        date,
        views: stats.views,
        conversions: stats.conversions,
        closes: stats.closes,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate totals
    const totalViews = analytics.filter(a => a.event === 'view').length;
    const totalConversions = analytics.filter(a => a.event === 'conversion').length;
    const totalCloses = analytics.filter(a => a.event === 'close').length;

    return {
      dailyBreakdown,
      totalEvents: analytics.length,
      totalViews,
      totalConversions,
      totalCloses,
      conversionRate: totalViews > 0 ? (totalConversions / totalViews) * 100 : 0,
    };
  } catch (error) {
    console.error('Error getting popup analytics:', error);
    throw new Error('Failed to get popup analytics');
  }
}

// === CONFIGURATION FUNCTIONS ===

export async function getActivePopupsForShop(shop: string) {
  try {
    return await prisma.popup.findMany({
      where: {
        shop,
        isActive: true,
      },
      select: {
        id: true,
        triggerType: true,
        triggerValue: true,
        heading: true,
        description: true,
        buttonText: true,
        discountCode: true,
      },
    });
  } catch (error) {
    console.error('Error getting active popups:', error);
    throw new Error('Failed to get active popups');
  }
}

// === BATCH OPERATIONS ===

export async function bulkTogglePopups(popupIds: string[], shop: string, isActive: boolean) {
  try {
    // Verify all popups belong to this shop
    const popups = await prisma.popup.findMany({
      where: {
        id: {
          in: popupIds,
        },
        shop,
      },
    });

    if (popups.length !== popupIds.length) {
      throw new Error('Some popups not found or do not belong to this shop');
    }

    return await prisma.popup.updateMany({
      where: {
        id: {
          in: popupIds,
        },
        shop,
      },
      data: {
        isActive,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error bulk toggling popups:', error);
    throw new Error('Failed to bulk toggle popups');
  }
}

export async function bulkDeletePopups(popupIds: string[], shop: string) {
  try {
    // Verify all popups belong to this shop
    const popups = await prisma.popup.findMany({
      where: {
        id: {
          in: popupIds,
        },
        shop,
      },
    });

    if (popups.length !== popupIds.length) {
      throw new Error('Some popups not found or do not belong to this shop');
    }

    return await prisma.popup.deleteMany({
      where: {
        id: {
          in: popupIds,
        },
        shop,
      },
    });
  } catch (error) {
    console.error('Error bulk deleting popups:', error);
    throw new Error('Failed to bulk delete popups');
  }
}

// === ANALYTICS REPORTING ===

export async function getPopupPerformanceReport(shop: string, dateRange?: { start: Date; end: Date }) {
  try {
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = dateRange?.end || new Date();

    const popups = await prisma.popup.findMany({
      where: {
        shop,
      },
      include: {
        analytics: {
          where: {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
    });

    return popups.map(popup => {
      const views = popup.analytics.filter(a => a.event === 'view').length;
      const conversions = popup.analytics.filter(a => a.event === 'conversion').length;
      const closes = popup.analytics.filter(a => a.event === 'close').length;

      return {
        id: popup.id,
        title: popup.title,
        isActive: popup.isActive,
        triggerType: popup.triggerType,
        triggerValue: popup.triggerValue,
        views,
        conversions,
        closes,
        conversionRate: views > 0 ? (conversions / views) * 100 : 0,
        closeRate: views > 0 ? (closes / views) * 100 : 0,
      };
    });
  } catch (error) {
    console.error('Error generating performance report:', error);
    throw new Error('Failed to generate performance report');
  }
}

// === CLEANUP FUNCTIONS ===

export async function cleanupOldAnalytics(daysToKeep: number = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return await prisma.popupAnalytics.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });
  } catch (error) {
    console.error('Error cleaning up old analytics:', error);
    throw new Error('Failed to cleanup old analytics');
  }
}

export async function cleanupShopData(shop: string) {
  try {
    console.log(`Starting cleanup for shop: ${shop}`);
    
    // Delete all analytics for this shop's popups
    const analyticsResult = await prisma.popupAnalytics.deleteMany({
      where: {
        popup: {
          shop,
        },
      },
    });
    
    console.log(`Deleted ${analyticsResult.count} analytics records for shop: ${shop}`);
    
    // Delete all popups for this shop
    const popupsResult = await prisma.popup.deleteMany({
      where: {
        shop,
      },
    });
    
    console.log(`Deleted ${popupsResult.count} popups for shop: ${shop}`);
    
    // Delete session data for this shop
    const sessionsResult = await prisma.session.deleteMany({
      where: {
        shop,
      },
    });
    
    console.log(`Deleted ${sessionsResult.count} sessions for shop: ${shop}`);
    
    console.log(`Cleanup completed for shop: ${shop}`);
    
    return {
      analyticsDeleted: analyticsResult.count,
      popupsDeleted: popupsResult.count,
      sessionsDeleted: sessionsResult.count,
    };
  } catch (error) {
    console.error('Error cleaning up shop data:', error);
    throw new Error('Failed to cleanup shop data');
  }
}

export async function hasActivePopups(shop: string) {
  try {
    const count = await prisma.popup.count({
      where: {
        shop,
        isActive: true,
      },
    });
    return count > 0;
  } catch (error) {
    console.error('Error checking for active popups:', error);
    throw new Error('Failed to check for active popups');
  }
}