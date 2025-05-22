import { IIncrementalChanges, IOverwriteChange } from "./changes.interface.js"

/**
 * Describes a differential change in a reactive Set.
 *
 * This type is used when individual items are added or removed,
 * without replacing the entire set.
 *
 * - Emitted by signals such as `$set.onChange`.
 * - Passed into methods like `applyChanges({ increment, decrement })`.
 *
 * @template TValue The type of values in the set.
 */
export interface ISetChanges<TValue> extends IIncrementalChanges<Set<TValue>> {
    /**
     * Items that were added to the set.
     * If undefined, no additions occurred.
     */
    increment: Set<TValue> | undefined

    /**
     * Items that were removed from the set.
     * If undefined, no deletions occurred.
     */
    decrement: Set<TValue> | undefined
}

/**
 * Describes a full replacement of a reactive Set's contents.
 *
 * This type is used when replacing the entire set with a new one.
 * All previous items are considered removed, and all new items are considered added.
 *
 * @template TValue The type of values in the set.
 */
export interface IOverwritingSetChanges<TValue> extends IOverwriteChange<Set<TValue>> {
    /** The new set that completely replaces the previous contents. */
    overwrite: Set<TValue>
}

/**
 * Union type describing either:
 * - a differential change (`increment` / `decrement`),
 * - or a full overwrite (`overwrite`).
 *
 * Used as input to APIs like `$set.applyChanges(...)`.
 *
 * @template TValue The type of values in the set.
 */
export type TInputSetChanges<TValue> = ISetChanges<TValue> | IOverwritingSetChanges<TValue>
