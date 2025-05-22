import { ISetChanges } from "../_common/set-changes.interface.js"
import { $VariadicCombination } from "./_combination/$variadic-combination.class.js"

/**
 * Reactive set representing the union of multiple source sets.
 *
 * `$Union<T>` tracks a dynamic collection of input `$Set<T>` instances
 * and computes their union — that is, the result contains all values
 * that are present in **at least one** of the source sets.
 *
 * This class extends `$VariadicCombination<T>` and is designed to maintain
 * a live, reactive aggregation of elements from all its inputs.
 *
 * The resulting set is:
 * - **readonly** — user-level mutations are forbidden and will throw;
 * - **reactive** — emits `onChange` when any included value is added or removed;
 * - **fully derived** — its content reflects only the union of source sets.
 *
 * @template TValue The type of values in the sets.
 *
 * @example
 * ```ts
 * const $a = $set(['x', 'y'])
 * const $b = $set(['y', 'z'])
 *
 * const $combined = new $Union([$a, $b])
 *
 * console.log([...$combined]) // ['x', 'y', 'z']
 *
 * $a.delete('x')
 * console.log([...$combined]) // ['y', 'z']
 * ```
 */
export class $Union<TValue> extends $VariadicCombination<TValue> {
    /**
     * Recalculates the union result when a change occurs in one of the source sets.
     *
     * The union contains all values present in at least one subset.
     * This method updates the internal occurrence map and emits a change signal
     * if any values were newly introduced (added to union) or fully removed (removed from all subsets).
     *
     * @param param0 A change object from a source set's `onChange` event.
     */
    protected recalculateOnSubsetChange({ increment: addedToSubset, decrement: removedFromSubset }: ISetChanges<TValue>) {
        const addedToUnion = new Set<TValue>()
        const removedFromUnion = new Set<TValue>()

        for (const item of addedToSubset ?? []) {
            const prevCount = this.valueOccurrences.get(item) ?? 0

            const nextCount = prevCount + 1

            this.valueOccurrences.set(item, prevCount + 1)

            if (nextCount === 1) addedToUnion.add(item)
        }

        for (const item of removedFromSubset ?? []) {
            const prevCount = this.valueOccurrences.get(item)
            if (!prevCount) throw new Error(`Cannot decrement item "${item}" that is not currently tracked in the union occurrence map.`)

            const nextCount = prevCount - 1

            if (nextCount === 0) {
                this.valueOccurrences.delete(item)
                removedFromUnion.add(item)
            } else {
                this.valueOccurrences.set(item, nextCount)
            }
        }

        this.applyChanges({ increment: addedToUnion, decrement: removedFromUnion })
    }
}
