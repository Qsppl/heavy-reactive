import { IValueContainer } from "../../_common/value-container.interface.js"
import { $Value } from "../../value/$value.class.js"
import { $Set } from "../$set.class.js"
import { $SetFromAny } from "./$set-from-any.class.js"
import { ICombinationOptions } from "../_combination/$combination.class.js"
import { MaybePromise } from "#typescript/maybe-promise.type.js"
import { difference } from "#set/index.js"

/**
 * Configuration options for `$ComplementViaVal<TItem, TRelation>`.
 *
 * Creates a reactive complement set by excluding values from a `superset`
 * based on a single dynamic **relation key** stored in a reactive `$Value`.
 *
 * The `resolver()` function defines how this key maps to items in the `superset`
 * that should be excluded from the result.
 */
export interface IComplementViaValOptions<TItem, TRelation> extends ICombinationOptions {
    /** The source set from which the complement is computed. */
    superset: $Set<TItem>

    /**
     * Reactive value representing a relation key.
     *
     * The current value is used to project which items in the `superset`
     * should be excluded from the result.
     */
    relation: $Value<TRelation>

    /**
     * Resolves the current relation key into the set of items to exclude.
     *
     * This function defines a projective exclusion:
     * the key may correspond to zero, one, or many values in the superset.
     *
     * @example
     * - a selected tag → items with that tag
     * - a current user role → restricted features
     * - a selected category → hidden content
     *
     * @param superset The current contents of the superset.
     * @param relation A reactive wrapper around the current relation key.
     * @returns The set of values to exclude from the final result.
     */
    resolver: (superset: Set<NoInfer<TItem>>, relation: IValueContainer<NoInfer<TRelation>>) => MaybePromise<Iterable<NoInfer<TItem>>>
}

/**
 * Reactive complement of a superset based on a dynamic projection key.
 *
 * `$ComplementViaVal<TItem, TRelation>` creates a readonly derived set
 * by projecting a single reactive `relation` value into items to **exclude**
 * from the `superset` using a custom `resolver()` function.
 *
 * The result is a reactive complement:
 * it includes all values from the superset that are **not** part of the projection.
 *
 * This is the inverse of `$SubsetViaVal`, and is useful for building
 * exclusion lists, inverse selections, or permission denials.
 *
 * Reacts to:
 * - changes in the `superset`;
 * - updates to the `relation` key.
 *
 * @template TItem The type of values in the superset and result.
 * @template TRelation The type of the relation key used for exclusion.
 *
 * @remarks
 * This set is `readonly`: any attempt to modify it directly will throw.
 *
 * @example Exclude items by even/odd projection:
 * ```ts
 * const $nums = $set({ values: [1, 2, 3, 4, 5, 6] })
 * const $mode = $value<'even' | 'odd'>({ value: 'even' })
 *
 * const $excluded = new $ComplementViaVal({
 *   superset: $nums,
 *   relation: $mode,
 *   resolver: (nums, mode) =>
 *     [...nums].filter(n => (mode.value === 'even' ? n % 2 === 0 : n % 2 !== 0)),
 * })
 *
 * console.log([...$excluded]) // → [1, 3, 5]
 * $mode.value = 'odd'
 * console.log([...$excluded]) // → [2, 4, 6]
 * ```
 */
export class $ComplementViaVal<TItem, TRelation> extends $SetFromAny<TItem, { superset: $Set<TItem>; relation: $Value<TRelation> }> {
    constructor(options: IComplementViaValOptions<TItem, TRelation>) {
        const { label, enabled = true, superset, relation, resolver } = options

        super({
            label,
            enabled,
            dependencies: {
                superset,
                relation,
            },
            resolvers: {
                superset: async ({ relation: currentRelation }, { increment: addedToSuperset, decrement: removedFromSuperset }) => {
                    if (!currentRelation) return { increment: undefined, decrement: undefined }

                    let addedToComplement: Set<TItem> | undefined

                    if (addedToSuperset?.size) {
                        const matched = new Set(await resolver(addedToSuperset, currentRelation))
                        addedToComplement = difference(addedToSuperset, matched)
                    }

                    return {
                        increment: addedToComplement,
                        decrement: removedFromSuperset,
                    }
                },
                relation: async ({ superset: currentSuperset }, { increment: nextRelation }) => {
                    if (!currentSuperset?.size || !nextRelation) return { increment: undefined, decrement: undefined }

                    const matched = new Set(await resolver(currentSuperset, nextRelation))
                    const newComplement = difference(currentSuperset, matched)

                    return { overwrite: newComplement }
                },
            },
        })
    }
}
