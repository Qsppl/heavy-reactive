import { $SetFromAny } from "./$set-from-any.class.js";
import { difference } from "/feature.javascript/feature.set/set.prototype.difference.polyfill.js";
/**
 * Reactive complement of a superset based on a dynamic set of projection keys.
 *
 * `$ComplementViaSet<TItem, TRelation>` creates a readonly derived set by projecting
 * each key from the `relation` set into values from the `superset` that should be excluded.
 * The result includes all items from the `superset` **except** those present in the projection.
 *
 * Each key is resolved via a custom `resolver()` function, which defines how the
 * relation keys map to exclusion targets in the superset.
 *
 * ### Use cases:
 * - exclude items by selected tags,
 * - hide objects by category or permission,
 * - suppress content by user roles or blocklist.
 *
 * ### Reactivity model:
 * - When values are added to the `superset`, they are checked against the current projection
 *   and only included if not excluded by any relation key;
 * - When `relation` keys are added/removed, their projections are added to or removed from the exclusion;
 * - On first relation update, a full projection is performed to initialize the result.
 *
 * @template TItem The type of elements in the superset and resulting set.
 * @template TRelation The type of relation keys used for exclusion.
 *
 * @remarks
 * - The result is **readonly** — calling `.add()` or `.delete()` will throw.
 * - The result is always **derived** from the superset — mutate the inputs to change the result.
 *
 * @example Exclude words by selected prefixes:
 * ```ts
 * const $words = $set({ values: ['alpha', 'beta', 'gamma', 'delta'] })
 * const $blocked = $set({ values: ['a', 'd'] })
 *
 * const $visible = new $ComplementViaSet({
 *   superset: $words,
 *   relation: $blocked,
 *   resolver: (words, prefixes) =>
 *     [...words].filter(word =>
 *       [...prefixes].some(prefix => word.startsWith(prefix))
 *     ),
 * })
 *
 * console.log([...$visible]) // → ['beta', 'gamma']
 * $blocked.add('b')
 * console.log([...$visible]) // → ['gamma']
 * ```
 */
export class $ComplementViaSet extends $SetFromAny {
    /**
     * Internal flag used to ensure that the initial complement is calculated only once.
     *
     * On first reactivity pass from the `relation` set, we compute a full initial
     * exclusion projection and treat it as an overwrite.
     *
     * In the future, this mechanism should be replaced with a standardized
     * `calculateInitialState()` hook from the base reactive class.
     */
    #complementWasExtracted = false;
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
                relation: async ({ superset: currentSuperset }, { increment: addedToRelation, decrement: removedFromRelation }) => {
                    if (!currentSuperset?.size)
                        return { increment: undefined, decrement: undefined };
                    let addedToComplement;
                    let incrementOfInner;
                    let decrementOfInner;
                    if (addedToRelation?.size)
                        incrementOfInner = new Set(await resolver(currentSuperset, addedToRelation));
                    if (removedFromRelation?.size)
                        decrementOfInner = new Set(await resolver(currentSuperset, removedFromRelation));
                    if (this.#complementWasExtracted) {
                        addedToComplement = decrementOfInner;
                    }
                    else {
                        addedToComplement = incrementOfInner && difference(currentSuperset, incrementOfInner);
                        this.#complementWasExtracted = true;
                    }
                    return {
                        increment: addedToComplement,
                        decrement: incrementOfInner,
                    };
                },
            },
        });
        this.onSwitch.addSignalListener(() => {
            if (!this.enabled)
                this.#complementWasExtracted = false;
        });
    }
}
