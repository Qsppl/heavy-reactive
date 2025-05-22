/**
 * Container that holds a single value in a reactive context.
 *
 * Used to represent values that may appear in incremental or overwrite change payloads.
 * Helps distinguish between “value containers” and raw values, especially when tracking changes.
 *
 * @template TValue The type of the contained value.
 */
export interface IValueContainer<TValue> {
    /** Contained value. */
    value: TValue
}
