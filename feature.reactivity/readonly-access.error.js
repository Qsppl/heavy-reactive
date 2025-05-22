/**
 * Thrown when a reactive value or collection is marked as `readonly`
 * and a user attempts to mutate it directly.
 *
 * This typically happens when the data is derived from computed state
 * and must not be altered externally.
 */
export class ReadonlyAccessError extends Error {
    constructor(message = "This reactive value is readonly and cannot be modified.") {
        super(message);
        this.name = "ReadonlyAccessError";
    }
}
