import { $SetFromAny } from "./$set-from-any.class.js";
import { difference } from "/feature.javascript/feature.set/set.prototype.difference.polyfill.js";
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
export class $ComplementViaVal extends $SetFromAny {
    constructor(options) {
        const { label, enabled = true, superset, relation, resolver } = options;
        super({
            label,
            enabled,
            dependencies: {
                superset,
                relation,
            },
            resolvers: {
                superset: async ({ relation: currentRelation }, { increment: addedToSuperset, decrement: removedFromSuperset }) => {
                    if (!currentRelation)
                        return { increment: undefined, decrement: undefined };
                    let addedToComplement;
                    if (addedToSuperset?.size) {
                        const matched = new Set(await resolver(addedToSuperset, currentRelation));
                        addedToComplement = difference(addedToSuperset, matched);
                    }
                    return {
                        increment: addedToComplement,
                        decrement: removedFromSuperset,
                    };
                },
                relation: async ({ superset: currentSuperset }, { increment: nextRelation }) => {
                    if (!currentSuperset?.size || !nextRelation)
                        return { increment: undefined, decrement: undefined };
                    const matched = new Set(await resolver(currentSuperset, nextRelation));
                    const newComplement = difference(currentSuperset, matched);
                    return { overwrite: newComplement };
                },
            },
        });
    }
}
