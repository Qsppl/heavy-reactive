import { IIncrementalChanges, IOverwriteChange } from "./changes.interface.js"

/**
 * Describes a differential change in a reactive dictionary-like structure.
 *
 * - Keys in `increment` represent entries that were added or updated.
 * - Keys in `decrement` represent entries that were removed.
 *
 * All keys and values are plain objects (`Record`) — no `Map` or `Set` is used.
 *
 * @template TKey Key type (typically `string`, `number`, or `symbol`)
 * @template TValue Value type
 */
export interface IDictionaryChanges<TKey extends string | number | symbol = string, TValue = unknown> extends IIncrementalChanges<Record<TKey, TValue>> {
    /**
     * Dictionary entries that were added or updated.
     * If undefined, no insertions occurred.
     */
    increment: Record<TKey, TValue> | undefined

    /**
     * Dictionary entries that were removed.
     * Keys are included with their last known values.
     * If undefined, no deletions occurred.
     */
    decrement: Record<TKey, TValue> | undefined
}

/**
 * Describes a full replacement of a reactive dictionary’s contents.
 *
 * When applied, this replaces the entire internal state with a new object.
 *
 * @template TKey Key type (typically `string`, `number`, or `symbol`)
 * @template TValue Value type
 */
export interface IOverwritingDictionaryChanges<TKey extends string | number | symbol = string, TValue = unknown>
    extends IOverwriteChange<Record<TKey, TValue>> {
    /** The new dictionary object that fully replaces the current contents. */
    overwrite: Record<TKey, TValue>
}

/**
 * Union type representing a dictionary change input.
 *
 * Accepts either:
 * - a differential change (`increment` / `decrement`), via `IDictionaryChanges`;
 * - or a full overwrite, via `IOverwritingDictionaryChanges`.
 *
 * Used in `.applyChanges(...)` methods of dictionary-like reactive structures.
 */
export type TInputDictionaryChanges<TKey extends string | number | symbol = string, TValue = unknown> =
    | IDictionaryChanges<TKey, TValue>
    | IOverwritingDictionaryChanges<TKey, TValue>
