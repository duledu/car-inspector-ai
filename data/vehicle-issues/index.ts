// =============================================================================
// Vehicle Issues Index
// Re-exports all issue arrays and types for use by the matcher.
// To add a new make/model: create the file and add an export line here.
// =============================================================================

export type { VehicleIssue } from './_schema'

export { volkswagenGolfIssues }   from './volkswagen-golf'
export { bmw3SeriesIssues }       from './bmw-3series'
export { mercedesCClassIssues }   from './mercedes-c-class'
export { audiA4Issues }           from './audi-a4'

// Flat merged array for direct use in matcher
import { volkswagenGolfIssues }   from './volkswagen-golf'
import { bmw3SeriesIssues }       from './bmw-3series'
import { mercedesCClassIssues }   from './mercedes-c-class'
import { audiA4Issues }           from './audi-a4'
import type { VehicleIssue }      from './_schema'

export const allIssues: VehicleIssue[] = [
  ...volkswagenGolfIssues,
  ...bmw3SeriesIssues,
  ...mercedesCClassIssues,
  ...audiA4Issues,
]
