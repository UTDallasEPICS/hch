/**
 * Hard cap on how many occurrences a single recurring-appointment series can
 * generate. ~260 ≈ five years of weekly sessions — a safety bound so a bad
 * recurrenceEndDate can never spin an unbounded insert loop. Shared by the
 * create (index.post) and update ([id].put) handlers so both stay in sync (#96).
 */
export const MAX_RECURRING_OCCURRENCES = 260
