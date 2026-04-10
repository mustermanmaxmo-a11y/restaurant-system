import type { RestaurantPlan } from '@/types/database'

export interface PlanLimits {
  maxTables: number
  maxStaff: number
  hasKiChat: boolean
  hasReservations: boolean
  hasBranding: boolean
  hasFullAnalytics: boolean
  hasMultiLocation: boolean
  hasPosIntegration: boolean
  analyticsRangeDays: number
}

const PLAN_LIMITS: Record<RestaurantPlan, PlanLimits> = {
  trial: {
    maxTables: Infinity,
    maxStaff: Infinity,
    hasKiChat: true,
    hasReservations: true,
    hasBranding: true,
    hasFullAnalytics: true,
    hasMultiLocation: false,
    hasPosIntegration: false,
    analyticsRangeDays: 30,
  },
  starter: {
    maxTables: 15,
    maxStaff: 3,
    hasKiChat: false,
    hasReservations: false,
    hasBranding: false,
    hasFullAnalytics: false,
    hasMultiLocation: false,
    hasPosIntegration: false,
    analyticsRangeDays: 7,
  },
  pro: {
    maxTables: Infinity,
    maxStaff: Infinity,
    hasKiChat: true,
    hasReservations: true,
    hasBranding: true,
    hasFullAnalytics: true,
    hasMultiLocation: false,
    hasPosIntegration: false,
    analyticsRangeDays: 365,
  },
  enterprise: {
    maxTables: Infinity,
    maxStaff: Infinity,
    hasKiChat: true,
    hasReservations: true,
    hasBranding: true,
    hasFullAnalytics: true,
    hasMultiLocation: true,
    hasPosIntegration: true,
    analyticsRangeDays: 365,
  },
  expired: {
    maxTables: 0,
    maxStaff: 0,
    hasKiChat: false,
    hasReservations: false,
    hasBranding: false,
    hasFullAnalytics: false,
    hasMultiLocation: false,
    hasPosIntegration: false,
    analyticsRangeDays: 0,
  },
}

export function getPlanLimits(plan: RestaurantPlan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.expired
}

export function isTrialExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt) < new Date()
}

export function getTrialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function isRestaurantActive(plan: RestaurantPlan, trialEndsAt: string | null): boolean {
  if (plan === 'expired') return false
  if (plan === 'trial') return !isTrialExpired(trialEndsAt)
  return true
}

export const PLAN_DISPLAY_NAMES: Record<RestaurantPlan, string> = {
  trial: 'Testphase',
  starter: 'Starter',
  pro: 'Professional',
  enterprise: 'Enterprise',
  expired: 'Abgelaufen',
}
