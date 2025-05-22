import { IIncrementalChanges, IOverwriteChange } from "./changes.interface.js"
import { IValueContainer } from "./value-container.interface.js"

/**
 * Describes a differential change in a reactive `$Value<T>`.
 *
 * This structure is emitted by `.onChange` of a `$Value`, representing a value update
 * where both the old and new values are tracked via `IValueContainer<T>`.
 *
 * It extends the `IIncrementalChanges` interface with a concrete type for containers.
 *
 * @template TValue The inner value type stored in the container.
 */
export interface IValueChange<TValue> extends IIncrementalChanges<IValueContainer<TValue>> {
    /**
     * The new value container (after assignment).
     * `undefined` means no addition occurred.
     */
    increment: IValueContainer<TValue> | undefined

    /**
     * The previous value container (before update).
     * `undefined` means no removal occurred.
     */
    decrement: IValueContainer<TValue> | undefined
}

/**
 * Describes a full replacement of a `$Value<T>`’s content.
 *
 * This structure is used when the value is not updated incrementally,
 * but completely overwritten with a new container.
 *
 * Used in methods like `overwrite()` or `applyChanges({ overwrite })`.
 *
 * @template TValue The inner value type stored in the container.
 */
export interface IOverwritingValueChange<TValue> extends IOverwriteChange<IValueContainer<TValue>> {
    /** The new value container to fully replace the old one. */
    overwrite: IValueContainer<TValue>
}

/**
 * Union type representing a reactive value change input.
 *
 * Accepts either:
 * - a differential change (`increment` / `decrement`), via `IValueChange<TValue>`;
 * - or a full overwrite (`overwrite`), via `IOverwritingValueChange<TValue>`.
 *
 * Used in APIs like `$value.applyChanges(...)`, where both styles are supported.
 *
 * @template TValue The inner value type managed by the container.
 */
export type TInputValueChange<TValue> = IValueChange<TValue> | IOverwritingValueChange<TValue>
