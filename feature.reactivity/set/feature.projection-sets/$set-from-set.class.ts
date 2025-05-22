import { $Set } from "../$set.class.js"
import { ISetChanges } from "../../_common/set-changes.interface.js"
import { $SetFromAny } from "./$set-from-any.class.js"
import { MayBePromise } from "../../../feature.typescript/may-be-promise.type.js"
import { ICombinationOptions } from "../_combination/$combination.class.js"

/**
 * Configuration options for creating a `$SetFromSet<TTarget, TSource>` instance.
 *
 * This derived set reacts to changes in a source `$Set<TSource>` and computes
 * a corresponding set of changes to apply to the target set.
 *
 * Each update is handled via a `resolver` function that receives a delta
 * and returns a projected delta in the target domain.
 *
 * This enables many-to-many reactive projections, not just 1:1 mappings.
 */
export interface ISetFromSetOptions<TTarget, TSource> extends ICombinationOptions {
    /** Reactive source set to observe. */
    source: $Set<TSource>

    /**
     * Resolves a source delta (`ISetChanges<TSource>`) into a change
     * that should be applied to the target set.
     *
     * This function can implement any projection logic, such as:
     * - transforming raw data → enriched data;
     * - resolving foreign keys → related models;
     * - grouping, expanding, or filtering incoming changes.
     *
     * @remarks
     * Each value in the source set may project to:
     * - zero target values (filtered);
     * - one value (mapped);
     * - multiple values (expanded).
     *
     * The resolver is called for each incremental change (`increment` / `decrement`)
     * and must return a valid `ISetChanges<TTarget>` object.
     */
    resolver: (changes: ISetChanges<TSource>) => MayBePromise<ISetChanges<TTarget>>
}

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
export class $SetFromSet<TTarget, TSource> extends $SetFromAny<TTarget, { source: $Set<TSource> }> {
    constructor(options: ISetFromSetOptions<TTarget, TSource>) {
        const { source, resolver, enabled = true, label } = options

        super({
            dependencies: {
                source,
            },
            resolvers: {
                source: (_, changes) => resolver(changes),
            },
            enabled,
            label,
        })
    }
}
