import { IValueContainer } from "../../_common/value-container.interface.js"
import { $Value } from "../../value/$value.class.js"
import { $Set } from "../$set.class.js"
import { $SetFromAny } from "./$set-from-any.class.js"
import { MayBePromise } from "../../../feature.typescript/may-be-promise.type.js"
import { ICombinationOptions } from "../_combination/$combination.class.js"

/**
 * Configuration options for `$SubsetViaVal<TItem, TRelation>`.
 *
 * Defines a derived subset based on a single **relation key** stored in a reactive `$Value`.
 *
 * The key is passed to a `resolver()` function that selects values from the `superset`.
 * The resulting subset consists of all values that are currently **related** to the active key.
 */
export interface ISubsetViaValOptions<TItem, TRelation> extends ICombinationOptions {
    /** The source set from which result values are selected. */
    superset: $Set<TItem>

    /**
     * A reactive value representing a projection key.
     *
     * This key is used to project values from the `superset` using the `resolver`.
     */
    relation: $Value<TRelation>

    /**
     * Resolves the current relation key into values drawn from the `superset`.
     *
     * This function defines the projection logic — such as:
     * - category → items
     * - role → permissions
     * - current route → visible menu entries
     *
     * @param superset The current contents of the superset.
     * @param relation A reactive container holding the current relation key.
     * @returns A set of values from the superset to include in the result.
     */
    resolver: (superset: Set<NoInfer<TItem>>, relation: IValueContainer<NoInfer<TRelation>>) => MayBePromise<Iterable<NoInfer<TItem>>>
}

/**
 * Reactive subset derived from a source set based on a dynamic projection key.
 *
 * `$SubsetViaVal<TItem, TRelation>` builds a derived, readonly `$Set<TItem>` by projecting
 * a single reactive `relation` key into related values from the `superset`.
 *
 * The projection is defined using a custom `resolver()` function.
 * It maps the current `relation` value to the set of items in the `superset`
 * that should be included in the result.
 *
 * This allows expressing state-dependent subsets such as:
 * - current category → products,
 * - selected tag → matching entries,
 * - current role → accessible features.
 *
 * Reacts to:
 * - changes in the `superset` (added/removed values),
 * - updates to the `relation` key.
 *
 * @template TItem The type of elements in the superset and resulting subset.
 * @template TRelation The type of the relation key used for projection.
 *
 * @remarks
 * This set is `readonly`: all mutating operations like `.add()` or `.clear()` will throw.
 *
 * @example Project visible items based on even/odd mode:
 * ```ts
 * const $numbers = $set({ values: [1, 2, 3, 4, 5, 6] })
 * const $mode = $value<'even' | 'odd'>({ value: 'even' })
 *
 * const $visible = new $SubsetViaVal({
 *   superset: $numbers,
 *   relation: $mode,
 *   resolver: (numbers, mode) =>
 *     [...numbers].filter(n => (mode.value === 'even' ? n % 2 === 0 : n % 2 !== 0)),
 * })
 *
 * console.log([...$visible]) // → [2, 4, 6]
 * $mode.value = 'odd'
 * console.log([...$visible]) // → [1, 3, 5]
 * ```
 */
export class $SubsetViaVal<TItem, TRelation> extends $SetFromAny<TItem, { superset: $Set<TItem>; relation: $Value<TRelation> }> {
    constructor(options: ISubsetViaValOptions<TItem, TRelation>) {
        const { label, enabled = true, superset, relation, resolver } = options

        super({
            label,
            enabled,
            dependencies: { superset, relation },
            resolvers: {
                superset: async ({ relation: currentRelation }, { increment: addedToSuperset, decrement: removedFromSuperset }) => {
                    if (!currentRelation) return { increment: undefined, decrement: undefined }

                    let addedToSubset: Set<TItem> | undefined
                    if (addedToSuperset?.size) addedToSubset = new Set(await resolver(addedToSuperset, currentRelation))

                    return {
                        increment: addedToSubset,
                        decrement: removedFromSuperset,
                    }
                },
                relation: async ({ superset: currentSuperset }, { increment: nextRelation }) => {
                    if (!currentSuperset?.size || !nextRelation) return { increment: undefined, decrement: undefined }

                    const newSubset = new Set(await resolver(currentSuperset, nextRelation))

                    return { overwrite: newSubset }
                },
            },
        })
    }
}
