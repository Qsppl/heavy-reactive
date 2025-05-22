import { $VariadicCombination } from "./_combination/$variadic-combination.class.js";
import { difference } from "/feature.javascript/feature.set/set.prototype.difference.polyfill.js";
/**
 * Reactive set that computes the intersection of multiple source sets.
 *
 * `$Intersection<T>` tracks a dynamic list of reactive sets (inputs),
 * and continuously computes their intersection — i.e., only values
 * that are present in **every** source set are included in the result.
 *
 * This class is a specialized form of `$VariadicCombination<T>` and `$Combination<T>`,
 * and is useful for deriving consistent shared state between multiple inputs.
 *
 * The resulting set is:
 * - read-only: all mutation methods throw `ReadonlyAccessError`;
 * - reactive: emits `onChange` when the intersection result changes;
 * - derived: changes automatically as inputs change.
 *
 * @template TValue The type of values stored in each source set.
 *
 * @example
 * ```ts
 * const $setA = $set(['a', 'b', 'c'])
 * const $setB = $set(['b', 'c', 'd'])
 *
 * const $common = new $Intersection([$setA, $setB])
 *
 * console.log([...$common]) // ['b', 'c']
 *
 * $setA.delete('b')
 * console.log([...$common]) // ['c']
 * ```
 *
 * @remarks
 * This class is not intended for direct mutation.
 * Use the source sets to control the state.
 */
export class $Intersection extends $VariadicCombination {
    /**
     * Handles a change event from one of the input sets and updates the intersection accordingly.
     *
     * The method updates the internal `occurrences` map — a counter of how many input sets
     * currently contain each value. When a value reaches the full count of subsets,
     * it is considered part of the intersection and added to the result.
     *
     * - If an added item now exists in all subsets, it is added to the intersection.
     * - Removed items reduce their count; if the count drops below the total, the item is removed.
     *
     * @param param0 The change object from a subset's `onChange` event.
     */
    recalculateOnSubsetChange({ increment: addedToSubset, decrement: removedFromSubset }) {
        const addedToIntersection = new Set();
        const removedFromIntersection = removedFromSubset;
        for (const item of addedToSubset ?? []) {
            const prevCount = this.valueOccurrences.get(item) ?? 0;
            const nextCount = prevCount + 1;
            this.valueOccurrences.set(item, nextCount);
            if (nextCount === this.includedSubsets.size)
                addedToIntersection.add(item);
        }
        for (const item of removedFromSubset ?? []) {
            const prevCount = this.valueOccurrences.get(item) ?? 0;
            const nextOccurrencesNumber = prevCount - 1;
            this.valueOccurrences.set(item, nextOccurrencesNumber);
            if (nextOccurrencesNumber === 0)
                this.valueOccurrences.delete(item);
            else
                this.valueOccurrences.set(item, nextOccurrencesNumber);
        }
        this.applyChanges({ increment: addedToIntersection, decrement: removedFromIntersection });
    }
    /**
     * Mounts a new subset into the intersection and updates internal tracking.
     *
     * - All values in the new subset are counted in `occurrences`.
     * - Any values currently in the intersection but missing from the new subset
     *   are removed, since they no longer appear in all subsets.
     *
     * This method is typically called by `$VariadicCombination` when a new source is added.
     *
     * @param subset A new `$Set<TValue>` to include in the intersection.
     */
    mountSubset(subset) {
        this.listenSubsetChanges(subset);
        for (const item of subset) {
            const prevCount = this.valueOccurrences.get(item) ?? 0;
            const nextCount = prevCount + 1;
            this.valueOccurrences.set(item, nextCount);
        }
        const decrement = difference(this, subset);
        if (decrement.size)
            this.applyChanges({ increment: undefined, decrement });
    }
    /**
     * Unmounts a subset from the intersection.
     *
     * - Removes its contributions from `occurrences`.
     * - For any values that were previously excluded because this subset was missing them,
     *   re-checks whether they now qualify for the intersection.
     *
     * If the intersection is currently disabled (e.g. in `immutable` state), this method is inert.
     *
     * @param subset The subset to remove from participation.
     */
    unmountSubset(subset) {
        this.subsetChangeControllers.get(subset)?.abort();
        if (this.enabled) {
            const increment = new Set();
            for (const item of subset) {
                const prevCount = this.valueOccurrences.get(item) ?? 0;
                const nextCount = prevCount - 1;
                if (nextCount === 0)
                    this.valueOccurrences.delete(item);
                else
                    this.valueOccurrences.set(item, nextCount);
            }
            for (const item of difference(new Set(this.valueOccurrences.keys()), subset)) {
                const prevCount = this.valueOccurrences.get(item) ?? 0;
                if (prevCount === this.includedSubsets.size)
                    increment.add(item);
            }
            if (increment.size)
                this.applyChanges({ increment, decrement: undefined });
        }
    }
}
