import { $ComplementViaSet } from "./set/feature.projection-sets/$complement-via-set.class.js";
import { $ComplementViaVal } from "./set/feature.projection-sets/$complement-via-val.class.js";
import { $SetFromAny } from "./set/feature.projection-sets/$set-from-any.class.js";
import { $SetFromSet } from "./set/feature.projection-sets/$set-from-set.class.js";
import { $Set } from "./set/$set.class.js";
import { $Value } from "./value/$value.class.js";
import { $Difference } from "./set/$difference.class.js";
import { $Intersection } from "./set/$intersection.class.js";
import { $SubsetViaSet } from "./set/feature.projection-sets/$subset-via-set.class.js";
import { $Union } from "./set/$union.class.js";
import { $SubsetViaVal } from "./set/feature.projection-sets/$subset-via-val.class.js";
export { $Value } from "./value/$value.class.js";
/**
 * Creates a new reactive scalar value container.
 *
 * `$value()` is the primary entry point for working with simple reactive values.
 * It wraps a single value in a reactive container, exposing:
 * - `.value` for reading/writing the current value;
 * - `.onChange` for subscribing to updates (using signals);
 * - transaction support (`openTransaction`, `closeTransaction`) for batching changes.
 *
 * This function returns an instance of `$Value<T>`, and is typically used to track
 * reactive primitives or objects in a lightweight and observable manner.
 *
 * @template TValue The type of the stored value.
 *
 * @param args Constructor arguments matching `$Value<T>`:
 * - `{ value: TValue; label?: string }` — initial value and optional debug label.
 *
 * @returns A new `$Value<T>` instance.
 *
 * @example Reactive counter:
 * ```ts
 * const counter = $value({ value: 0 })
 * counter.onChange.addSignalListener(({ increment }) => {
 *   console.log('New value:', increment?.value)
 * })
 *
 * counter.value = counter.value + 1
 * ```
 *
 * @example Batching with transaction:
 * ```ts
 * const state = $value({ value: { count: 0 } })
 *
 * state.openTransaction()
 * state.value = { count: 1 }
 * state.value = { count: 2 }
 * state.closeTransaction() // onChange emitted once with final state
 * ```
 */
export function $value(...args) {
    return new $Value(...args);
}
export { $Set } from "./set/$set.class.js";
/**
 * Creates a new reactive set.
 *
 * `$set()` wraps a native `Set<T>` with a reactive interface:
 * - Emits `onChange` signals when the contents are updated;
 * - Supports granular mutations (`add`, `delete`, `clear`);
 * - Supports batch operations (`batchAdd`, `batchDelete`, `applyChanges`);
 * - Allows transactional grouping via `openTransaction` / `closeTransaction`;
 * - Enforces immutability when disabled.
 *
 * @remarks
 * ### Batching changes
 * The set provides multiple ways to apply changes in bulk:
 *
 * - Use `batchAdd(values)` or `batchDelete(values)` to efficiently add/remove multiple items.
 * - Use `applyChanges({ increment, decrement })` to apply both in a single call.
 * - Use transactions (`openTransaction()` / `closeTransaction()`) to delay signaling until all operations are complete.
 *
 * @template TValue The type of values held in the set.
 *
 * @param args Constructor arguments matching `$Set<T>`:
 * - `{ values?: Iterable<TValue>; label?: string }`
 *
 * @returns A new `$Set<T>` instance.
 *
 * @example Basic usage:
 * ```ts
 * const $tags = $set({ values: ['a', 'b'] })
 *
 * $tags.onChange.addSignalListener(({ increment, decrement }) => {
 *   console.log('Added:', [...(increment ?? [])])
 *   console.log('Removed:', [...(decrement ?? [])])
 * })
 *
 * $tags.add('c')     // emits: increment = Set { 'c' }
 * $tags.delete('a')  // emits: decrement = Set { 'a' }
 * ```
 *
 * @example Using batch methods:
 * ```ts
 * $tags.batchAdd(['x', 'y'])       // emits: increment = Set { 'x', 'y' }
 * $tags.batchDelete(['b'])         // emits: decrement = Set { 'b' }
 * ```
 *
 * @example Using applyChanges:
 * ```ts
 * $tags.applyChanges({
 *   increment: new Set(['m']),
 *   decrement: new Set(['a'])
 * }) // emits both additions and removals together
 * ```
 *
 * @example Transactional update:
 * ```ts
 * $tags.openTransaction()
 * $tags.add('p')
 * $tags.delete('y')
 * $tags.closeTransaction() // emits a single signal for all changes
 * ```
 */
export function $set(...args) {
    return new $Set(...args);
}
export { $Combination } from "./set/_combination/$combination.class.js";
export function $complementViaSet(...args) {
    return new $ComplementViaSet(...args);
}
export function $complementViaVal(...args) {
    return new $ComplementViaVal(...args);
}
export function $subsetViaSet(...args) {
    return new $SubsetViaSet(...args);
}
export function $subsetViaVal(...args) {
    return new $SubsetViaVal(...args);
}
export function $deriveSetFromAny() {
    return (...args) => new $SetFromAny(...args);
}
export function $deriveSetFromSet(...args) {
    return new $SetFromSet(...args);
}
export { $VariadicCombination } from "./set/_combination/$variadic-combination.class.js";
/**
 * Creates a reactive set that represents the difference between a superset and one or more subsets.
 *
 * `$differenceSets()` returns a reactive set that includes all items from the `superset`
 * that are **not** present in any of the provided `subsets`. It automatically reacts to changes
 * in both the superset and the subsets — updating its own contents accordingly.
 *
 * This is one of three core combination factories:
 * - `$unionSets()` – merges multiple sets into a single set of unique values;
 * - `$intersectionSets()` – includes only values present in *all* subsets;
 * - `$differenceSets()` – removes all values from the superset that appear in *any* subset.
 *
 * @template TValue The type of values within the sets.
 *
 * @param args Constructor arguments matching `$Difference<T>`:
 * - `{ superset: $Set<TValue>; subsets: Array<$Set<TValue>>; label?: string; enabled?: boolean }`
 *
 * @returns A reactive `$Set<T>` representing the dynamic difference.
 *
 * @example
 * ```ts
 * const $allUsers = $set({ values: [1, 2, 3, 4, 5] })
 * const $banned = $set({ values: [2, 4] })
 *
 * const $activeUsers = $differenceSets({
 *   superset: $allUsers,
 *   subsets: [$banned],
 *   label: 'Active users'
 * })
 *
 * console.log([...$activeUsers]) // → [1, 3, 5]
 *
 * $banned.add(5)
 * console.log([...$activeUsers]) // → [1, 3]
 *
 * $allUsers.delete(1)
 * console.log([...$activeUsers]) // → [3]
 * ```
 *
 * @see {@link $unionSets}
 * @see {@link $intersectionSets}
 */
export function $differenceSets(...args) {
    return new $Difference(...args);
}
/**
 * Creates a reactive set representing the intersection of multiple reactive sets.
 *
 * `$intersectionSets()` returns a derived `$Set<T>` that includes only those values
 * which are present in **every** of the provided subsets. Whenever any of the input sets
 * changes, the intersection is recalculated and updated automatically.
 *
 * This is one of three core combination factories:
 * - `$unionSets()` – merges all values from all subsets;
 * - `$intersectionSets()` – keeps only values shared by all subsets;
 * - `$differenceSets()` – removes values from a superset that exist in subsets.
 *
 * @template TValue The type of values within the sets.
 *
 * @param args Constructor arguments matching `$Intersection<T>`:
 * - `{ subsets: Array<$Set<TValue>>; label?: string; enabled?: boolean }`
 *
 * @returns A reactive set representing the dynamic intersection of all input sets.
 *
 * @example
 * ```ts
 * const $onlineUsers = $set({ values: [1, 2, 3] })
 * const $premiumUsers = $set({ values: [2, 3, 4] })
 *
 * const $onlinePremium = $intersectionSets({
 *   subsets: [$onlineUsers, $premiumUsers],
 *   label: 'Online + Premium'
 * })
 *
 * console.log([...$onlinePremium]) // → [2, 3]
 *
 * $onlineUsers.delete(2)
 * console.log([...$onlinePremium]) // → [3]
 *
 * $premiumUsers.delete(3)
 * console.log([...$onlinePremium]) // → []
 * ```
 *
 * @see {@link $unionSets}
 * @see {@link $differenceSets}
 */
export function $intersectionSets(...args) {
    return new $Intersection(...args);
}
/**
 * Creates a reactive set that represents the union of multiple reactive sets.
 *
 * `$unionSets()` returns a derived `$Set<T>` that includes **all unique values**
 * present in any of the provided subsets. Whenever any input set changes,
 * the union is automatically updated to reflect the current collective contents.
 *
 * This is one of three core combination factories:
 * - `$intersectionSets()` – keeps only values present in all subsets;
 * - `$unionSets()` – merges all values from all subsets;
 * - `$differenceSets()` – excludes values from a superset that appear in subsets.
 *
 * @template TValue The type of values within the sets.
 *
 * @param args Constructor arguments matching `$Union<T>`:
 * - `{ subsets: Array<$Set<TValue>>; label?: string; enabled?: boolean }`
 *
 * @returns A reactive set representing the dynamic union of all input sets.
 *
 * @example
 * ```ts
 * const $visibleToAdmin = $set({ values: ['a', 'b'] })
 * const $visibleToEditor = $set({ values: ['b', 'c'] })
 *
 * const $visibleToAnyone = $unionSets({
 *   subsets: [$visibleToAdmin, $visibleToEditor],
 *   label: 'Visible content'
 * })
 *
 * console.log([...$visibleToAnyone]) // → ['a', 'b', 'c']
 *
 * $visibleToEditor.add('d')
 * console.log([...$visibleToAnyone]) // → ['a', 'b', 'c', 'd']
 * ```
 *
 * @see {@link $intersectionSets}
 * @see {@link $differenceSets}
 */
export function $unionSets(...args) {
    return new $Union(...args);
}
