import { $SetFromAny } from "./$set-from-any.class.js";
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
export class $SubsetViaVal extends $SetFromAny {
    constructor(options) {
        const { label, enabled = true, superset, relation, resolver } = options;
        super({
            label,
            enabled,
            dependencies: { superset, relation },
            resolvers: {
                superset: async ({ relation: currentRelation }, { increment: addedToSuperset, decrement: removedFromSuperset }) => {
                    if (!currentRelation)
                        return { increment: undefined, decrement: undefined };
                    let addedToSubset;
                    if (addedToSuperset?.size)
                        addedToSubset = new Set(await resolver(addedToSuperset, currentRelation));
                    return {
                        increment: addedToSubset,
                        decrement: removedFromSuperset,
                    };
                },
                relation: async ({ superset: currentSuperset }, { increment: nextRelation }) => {
                    if (!currentSuperset?.size || !nextRelation)
                        return { increment: undefined, decrement: undefined };
                    const newSubset = new Set(await resolver(currentSuperset, nextRelation));
                    return { overwrite: newSubset };
                },
            },
        });
    }
}
