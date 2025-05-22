/**
 * Describes a differential change to a reactive value or collection.
 *
 * This form is used when applying partial updates (e.g. adding/removing items)
 * rather than fully replacing the state.
 *
 * @template T The type of the internal content (e.g. `Set<TValue>`, `IValueContainer<TValue>`)
 */
export interface IIncrementalChanges<T = unknown> {
    /**
     * The part that was added or introduced.
     * - In a set, this would be a `Set<T>` of added items.
     * - In a value, this would be the new `IValueContainer<T>`.
     */
    increment: T | undefined

    /**
     * The part that was removed or replaced.
     * - In a set, this would be a `Set<T>` of removed items.
     * - In a value, this would be the old `IValueContainer<T>`.
     */
    decrement: T | undefined
}

/**
 * Describes a full overwrite operation in a reactive context.
 *
 * Used when completely replacing a value or structure.
 *
 * @template T The type of the internal content (e.g. `Set<TValue>`, `IValueContainer<TValue>`)
 */
export interface IOverwriteChange<T = unknown> {
    /** The new value or structure that fully replaces the previous one. */
    overwrite: T
}

/**
 * Union type for reactive change payloads — either differential or full-replacement.
 *
 * This is used as input to functions like `.applyChanges()` which accept both styles.
 *
 * @template T The type of the internal content (e.g. `Set<TValue>`, `IValueContainer<TValue>`)
 */
export type TInputChanges<T = unknown> = IIncrementalChanges<T> | IOverwriteChange<T>
