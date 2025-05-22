import { $SetFromAny } from "./$set-from-any.class.js";
/**
 * Low-level reactive adapter between two sets with custom change mapping.
 *
 * `$SetFromSet<TTarget, TSource>` builds a derived `$Set<TTarget>` by listening
 * to a source `$Set<TSource>` and applying a transformation via a user-provided `associate()` function.
 *
 * This is the most flexible form of reactive projection — useful when:
 * - mapping one domain to another;
 * - synchronizing a subset or superset view;
 * - building observables from foreign representations.
 *
 * @template TTarget The type of values in the derived set.
 * @template TSource The type of values in the source set.
 *
 * @remarks
 * This set is readonly — you must mutate the source set to affect the output.
 *
 * @example
 * ```ts
 * const $ids = $set({ values: [1, 2, 3] })
 * const $labels = new $SetFromSet({
 *   source: $ids,
 *   associate: ({ increment, decrement }) => ({
 *     increment: increment && new Set([...increment].map(id => `#${id}`)),
 *     decrement: decrement && new Set([...decrement].map(id => `#${id}`)),
 *   }),
 * })
 *
 * $ids.add(4)
 * // $labels → Set { '#1', '#2', '#3', '#4' }
 * ```
 */
export class $SetFromSet extends $SetFromAny {
    constructor(options) {
        const { source, resolver, enabled = true, label } = options;
        super({
            dependencies: {
                source,
            },
            resolvers: {
                source: (_, changes) => resolver(changes),
            },
            enabled,
            label,
        });
    }
}
