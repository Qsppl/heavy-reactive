/**
 * Thrown when a reactive entity is marked as `immutable` or
 * its reactivity has been disabled, making all operations invalid
 * until re-enabled.
 */
export class ReactivityDisabledError extends Error {
  constructor(message = 'Reactivity is disabled for this value or collection.') {
    super(message)
    this.name = 'ReactivityDisabledError'
  }
}