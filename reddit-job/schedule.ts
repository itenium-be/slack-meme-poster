import { CronExpressionParser } from 'cron-parser'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// The previous scheduled fire before the current run.
// `now` is at (or just after) a fire, so the first prev() is the current
// fire and the second prev() is the previous run's fire.
export function previousRun(cronExpr: string | undefined, now: Date = new Date(), tz: string = 'UTC'): Date {
  try {
    if (!cronExpr) throw new Error('no cron expr')
    const it = CronExpressionParser.parse(cronExpr, { currentDate: now, tz })
    it.prev() // current fire
    return it.prev().toDate() // previous fire
  } catch {
    return new Date(now.getTime() - SEVEN_DAYS_MS)
  }
}

// Smallest reddit "t" window that covers the gap since the last run.
export function redditWindow(sinceUtc: Date, now: Date = new Date()): string {
  const gapHours = (now.getTime() - sinceUtc.getTime()) / 3600000
  if (gapHours <= 1) return 'hour'
  if (gapHours <= 24) return 'day'
  if (gapHours <= 24 * 7) return 'week'
  if (gapHours <= 24 * 31) return 'month'
  return 'year'
}
