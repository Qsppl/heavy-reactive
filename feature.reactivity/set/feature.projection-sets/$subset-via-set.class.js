import { $SetFromAny } from "./$set-from-any.class.js";
/**
 * Reactive subset derived from a base set using a set of dynamic relation keys.
 *
 * `$SubsetViaSet<TItem, TRelation>` creates a readonly, reactive set
 * by projecting each item in the `relation` set into values from the `superset`,
 * using a custom `resolver()` function.
 *
 * The result is the **union of all projected values** — one projection per relation key.
 *
 * Typical use cases include:
 * - filtering by selected tags,
 * - resolving parent → children,
 * - querying linked entities via references.
 *
 * Reacts to:
 * - changes in the `superset` (added/removed items);
 * - changes in the `relation` set (added/removed keys).
 *
 * @template TItem The type of values in the superset and result.
 * @template TRelation The type of relation keys used to drive projection.
 *
 * @remarks
 * This set is `readonly`: any attempt to modify it directly will throw.
 *
 * @example Show words that match selected prefixes:
 * ```ts
 * const $words = $set({ values: ['alpha', 'beta', 'gamma', 'delta'] })
 * const $prefixes = $set({ values: ['a', 'd'] })
 *
 * const $matching = new $SubsetViaSet({
 *   superset: $words,
 *   relation: $prefixes,
 *   resolver: (words, prefixes) =>
 *     [...words].filter(word =>
 *       [...prefixes].some(prefix => word.startsWith(prefix))
 *     ),
 * })
 *
 * console.log([...$matching]) // → ['alpha', 'delta']
 * $prefixes.add('b')
 * console.log([...$matching]) // → ['alpha', 'beta', 'delta']
 * ```
 */
export class $SubsetViaSet extends $SetFromAny {
    constructor(options) {
        const { label, enabled = true, superset, relation, resolver } = options;
        super({
            label,
            enabled,
            dependencies: { superset, relation },
            resolvers: {
                superset: async ({ relation: currentRelation }, { increment: addedToSuperset, decrement: removedFromSuperset }) => {
                    if (!currentRelation?.size)
                        return { increment: undefined, decrement: undefined };
                    let addedToSubset;
                    if (addedToSuperset?.size)
                        addedToSubset = new Set(await resolver(addedToSuperset, currentRelation));
                    return {
                        increment: addedToSubset,
                        decrement: removedFromSuperset,
                    };
                },
                relation: async ({ superset: currentSuperset }, { increment: addedToRelation, decrement: removedFromRelation }) => {
                    if (!currentSuperset?.size)
                        return { increment: undefined, decrement: undefined };
                    let addedToSubset;
                    let removedFromSubset;
                    if (addedToRelation?.size)
                        addedToSubset = new Set(await resolver(currentSuperset, addedToRelation));
                    if (removedFromRelation?.size)
                        removedFromSubset = new Set(await resolver(currentSuperset, removedFromRelation));
                    return {
                        increment: addedToSubset,
                        decrement: removedFromSubset,
                    };
                },
            },
        });
    }
}
