import { $ComplementViaSet } from "./set/feature.projection-sets/$complement-via-set.class.js"
import { $ComplementViaVal } from "./set/feature.projection-sets/$complement-via-val.class.js"
import { $SetFromAny, TDependenciesMap } from "./set/feature.projection-sets/$set-from-any.class.js"
import { $SetFromSet } from "./set/feature.projection-sets/$set-from-set.class.js"
import { $Set } from "./set/$set.class.js"
import { $Combination } from "./set/_combination/$combination.class.js"
import { $Value } from "./value/$value.class.js"
import { $VariadicCombination } from "./set/_combination/$variadic-combination.class.js"
import { $Difference } from "./set/$difference.class.js"
import { $Intersection } from "./set/$intersection.class.js"
import { $SubsetViaSet } from "./set/feature.projection-sets/$subset-via-set.class.js"
import { $Union } from "./set/$union.class.js"
import { $SubsetViaVal } from "./set/feature.projection-sets/$subset-via-val.class.js"

export { $Value } from "./value/$value.class.js"

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
export function $value<TValue>(...args: ConstructorParameters<typeof $Value<TValue>>): $Value<TValue> {
    return new $Value(...args)
}

export { $Set } from "./set/$set.class.js"

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
export function $set<TValue>(...args: ConstructorParameters<typeof $Set<TValue>>): $Set<TValue> {
    return new $Set<TValue>(...args)
}

export { $Combination } from "./set/_combination/$combination.class.js"

/**
 * Creates a `$ComplementViaSet` instance.
 *
 * This factory produces a derived reactive set that excludes values from the given `superset`
 * by projecting items from a `relation` set into the superset using a custom `resolver()` function.
 *
 * Each key in the `relation` set is mapped to values that should be excluded from the result.
 * The final result is `superset − projection`.
 *
 * @example
 * ```ts
 * const $all = $set({ values: ["a", "b", "c"] })
 * const $exclude = $set({ values: ["b"] })
 *
 * const $visible = $complementViaSet({
 *   superset: $all,
 *   relation: $exclude,
 *   resolver: (all, keys) => [...all].filter(x => keys.has(x)),
 * })
 * ```
 *
 * @returns A readonly reactive `$Combination<T>` representing the complement set.
 */
export function $complementViaSet<TSupersetValue, TRelationValue>(
    ...args: ConstructorParameters<typeof $ComplementViaSet<TSupersetValue, TRelationValue>>
): $Combination<TSupersetValue> {
    return new $ComplementViaSet(...args)
}

/**
 * Creates a `$ComplementViaVal` instance.
 *
 * Produces a derived reactive set that excludes projected values based on a single
 * reactive relation key stored in a `$Value`. The `resolver()` maps the relation
 * key to values in the superset that should be excluded.
 *
 * The result is `superset − projection(relation)`.
 *
 * @example
 * ```ts
 * const $all = $set({ values: ["a", "b", "c"] })
 * const $mode = $value({ value: "b" })
 *
 * const $visible = $complementViaVal({
 *   superset: $all,
 *   relation: $mode,
 *   resolver: (all, key) => [...all].filter(x => x === key.value),
 * })
 * ```
 *
 * @returns A readonly reactive `$Combination<T>` representing the complement set.
 */
export function $complementViaVal<TSupersetValue, TRelationValue>(
    ...args: ConstructorParameters<typeof $ComplementViaVal<TSupersetValue, TRelationValue>>
): $Combination<TSupersetValue> {
    return new $ComplementViaVal(...args)
}

/**
 * Creates a `$SubsetViaSet` instance.
 *
 * Produces a derived reactive set that includes values from the given `superset`
 * based on a set of relation keys. Each key is projected into the superset
 * using a custom `resolver()` function, and the result is the union of all projections.
 *
 * This is commonly used for:
 * - tag-based filtering,
 * - parent → children projections,
 * - resolving references dynamically.
 *
 * @example
 * ```ts
 * const $all = $set({ values: ["a", "b", "c", "d"] })
 * const $tags = $set({ values: ["a", "d"] })
 *
 * const $selected = $subsetViaSet({
 *   superset: $all,
 *   relation: $tags,
 *   resolver: (all, keys) => [...all].filter(x => keys.has(x)),
 * })
 * ```
 *
 * @returns A readonly reactive `$Combination<T>` representing the projected subset.
 */
export function $subsetViaSet<TSupersetValue, TRelationValue>(
    ...args: ConstructorParameters<typeof $SubsetViaSet<TSupersetValue, TRelationValue>>
): $Combination<TSupersetValue> {
    return new $SubsetViaSet(...args)
}

/**
 * Creates a `$SubsetViaVal` instance.
 *
 * Produces a derived reactive set by projecting a single reactive relation key
 * into a subset of values from the `superset`. The `resolver()` defines the
 * projection from the relation key to included superset values.
 *
 * The result is replaced (overwrite) when the key changes.
 *
 * @example
 * ```ts
 * const $all = $set({ values: ["a", "b", "c"] })
 * const $selectedTag = $value({ value: "b" })
 *
 * const $visible = $subsetViaVal({
 *   superset: $all,
 *   relation: $selectedTag,
 *   resolver: (all, key) => [...all].filter(x => x === key.value),
 * })
 * ```
 *
 * @returns A readonly reactive `$Combination<T>` representing the projected subset.
 */
export function $subsetViaVal<TSupersetValue, TRelationValue>(
    ...args: ConstructorParameters<typeof $SubsetViaVal<TSupersetValue, TRelationValue>>
): $Combination<TSupersetValue> {
    return new $SubsetViaVal(...args)
}

/**
 * Creates a highly customizable reactive derived set from arbitrary dependencies.
 *
 * `$deriveSetFromAny<T>()` returns a curried factory function that accepts a configuration
 * for constructing a `$SetFromAny<T, TDependencies>` instance — a general-purpose reactive
 * combinator that derives its content from multiple `$Set` and/or `$Value` sources.
 *
 * Each source is registered by name, and a corresponding `resolver()` must be provided
 * to transform changes in that source into incremental or overwrite-level changes in the result set.
 *
 * This low-level primitive powers all higher-order derived constructs such as:
 * - `$SubsetViaSet`
 * - `$ComplementViaVal`
 * - `$SetFromSet`
 *
 * @template TValue The type of values in the resulting derived set.
 *
 * @returns A factory function that creates a `$SetFromAny<T>` with typed dependencies.
 *
 * @example
 * ```ts
 * const $items = $set(["apple", "banana", "cherry"])
 * const $hide = $value("a")
 *
 * const $filtered = $deriveSetFromAny<string>()({
 *   label: "filteredItems",
 *   dependencies: { source: $items, mask: $hide },
 *   resolvers: {
 *     source: async ({ mask }, { increment, decrement }) => ({
 *       increment: new Set([...increment ?? []].filter(i => !i.startsWith(mask?.value ?? ""))),
 *       decrement,
 *     }),
 *     mask: async ({ source }, { increment }) => {
 *       const excluded = new Set([...source ?? []].filter(i => i.startsWith(increment?.value ?? "")))
 *       return { overwrite: new Set([...source ?? []].filter(i => !excluded.has(i))) }
 *     },
 *   },
 * })
 * ```
 */
export function $deriveSetFromAny<TValue>() {
    return <TDependencies extends TDependenciesMap>(...args: ConstructorParameters<typeof $SetFromAny<TValue, TDependencies>>): $Combination<TValue> =>
        new $SetFromAny(...args)
}

/**
 * Creates a `$SetFromSet` instance.
 *
 * Produces a reactive derived set by transforming incremental changes
 * from a source `$Set<TSource>` into corresponding changes in a target set.
 *
 * Unlike projection-based sets, this factory doesn't use relation keys or masking.
 * Instead, it applies a user-defined `resolver()` function to each incoming delta,
 * allowing for freeform transformation: filtering, remapping, expanding, etc.
 *
 * Useful for:
 * - mapping IDs to objects,
 * - type conversions (e.g. `Point → Zone`),
 * - building enriched views of a changing set.
 *
 * @example
 * ```ts
 * const $ids = $set({ values: [1, 2, 3] })
 *
 * const $objects = $deriveSetFromSet({
 *   source: $ids,
 *   resolver: async ({ increment, decrement }) => ({
 *     increment: new Set((increment ?? []).map(id => ({ id, label: `Item ${id}` }))),
 *     decrement: new Set((decrement ?? []).map(id => ({ id, label: `Item ${id}` }))),
 *   }),
 * })
 * ```
 *
 * @returns A readonly reactive `$Combination<T>` that reflects transformed deltas.
 */
export function $deriveSetFromSet<TValue, TSourceValue>(...args: ConstructorParameters<typeof $SetFromSet<TValue, TSourceValue>>): $Combination<TValue> {
    return new $SetFromSet(...args)
}
export { $VariadicCombination } from "./set/_combination/$variadic-combination.class.js"

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
export function $differenceSets<TValue>(...args: ConstructorParameters<typeof $Difference<TValue>>): $VariadicCombination<TValue> {
    return new $Difference(...args)
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
export function $intersectionSets<TValue>(...args: ConstructorParameters<typeof $Intersection<TValue>>): $VariadicCombination<TValue> {
    return new $Intersection(...args)
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
export function $unionSets<TValue>(...args: ConstructorParameters<typeof $Union<TValue>>): $VariadicCombination<TValue> {
    return new $Union(...args)
}
