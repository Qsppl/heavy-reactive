# Reactive State Library

This library provides lightweight, composable primitives for building reactive data flows in TypeScript applications. It is designed to be explicit, subscription-based, and interoperable with existing architectures — without introducing virtual DOMs, schedulers, or global state systems.

## 🚀 Getting Started

Install the library:

```bash
npm install @your-scope/reactive-state
```

Import the reactive primitives:

```ts
import { $value, $set, $intersectionSets, $unionSets, $differenceSets } from "@your-scope/reactive-state"
```

## ✨ Core Concepts

### `$value()` – Reactive Value

Wraps a single value in a reactive container:

```ts
const count = $value({ value: 0 })
count.onChange.addSignalListener(({ increment }) => {
    console.log("New value:", increment?.value)
})
count.value = 1
```

### `$set()` – Reactive Set

Reactive equivalent of `Set<T>`:

```ts
const $tags = $set({ values: ["a", "b"] })
$tags.add("c")
$tags.delete("a")
```

Supports:

- `.onChange` with `{ increment?, decrement? }`
- `batchAdd`, `batchDelete`, `applyChanges`
- Transactions via `openTransaction` / `closeTransaction`

### Combinations

Use derived sets to represent computed relationships:

```ts
const $admin = $set({ values: ["alice", "bob"] })
const $online = $set({ values: ["bob", "carol"] })

const $onlineAdmins = $intersectionSets({ subsets: [$admin, $online] })
```

Available combinators:

- `$intersectionSets()` — only values present in all
- `$unionSets()` — all values from any
- `$differenceSets()` — values in one but not others

All combination sets:

- Are strictly readonly — you cannot call `add()` or `delete()` on them.
- Automatically update when their source sets change.
- Can be toggled on/off via the `enabled` flag to reduce reactivity and resource usage.

### 🏗 Factory Functions

Factory functions provide named creation helpers for all key reactive types.

#### Base factories

- `$value(...)` – Create a reactive value container
- `$set(...)` – Create a reactive set container

#### Projection-based set factories

- `$subsetViaVal(...)` – Build a projected subset using a relation stored in a `$Value`
- `$subsetViaSet(...)` – Build a projected subset using a set of relation keys in a `$Set`
- `$complementViaVal(...)` – Build a complement set by excluding a projection from a single relation value
- `$complementViaSet(...)` – Build a complement set by excluding projected values from multiple relation keys
- `$setFromSet(...)` – Build a projected set that maps source deltas into custom results

Each factory returns a `$Combination<T>` instance.

Projection factories enable expressive modeling such as:

```ts
const $roles = $value({ value: "admin" })
const $allPermissions = $set({ values: ["read", "write", "delete"] })

const $granted = $subsetViaVal({
    superset: $allPermissions,
    relation: $roles,
    resolver: (all, role) => (role.value === "admin" ? all : [...all].filter((p) => p !== "delete")),
})
```

For internal mechanics, see [CONTRIBUTING.md](./CONTRIBUTING.md#-projection-based-derived-sets).

## 🧠 Use Cases

### Cascade Filtering and Aggregation

```ts
const $allItems = $set({ values: ["a", "b", "c", "d"] })
const $archived = $set({ values: ["b"] })
const $selected = $set({ values: ["a", "b", "d"] })

const $visible = $differenceSets({ superset: $allItems, subsets: [$archived] })
const $visibleSelected = $intersectionSets({ subsets: [$selected, $visible] })

// → $visibleSelected contains ['a', 'd']

$archived.add("d")
// → $visible now excludes 'd'
// → $visibleSelected now becomes ['a']
```

This showcases how combinations compose:

- `$differenceSets` subtracts exclusions;
- `$intersectionSets` refines the view.

### ⚠️ Readonly Behavior of Combinations

All combination sets are readonly and cannot be modified directly.
Attempting to call mutating methods such as `.add()` or `.delete()` will throw a runtime error:

```ts
const $onlineAdmins = $intersectionSets({ subsets: [$admin, $online] })

$onlineAdmins.add("carol")
// ❌ RuntimeError: $Intersection is readonly and cannot be modified.
```

To update the contents, always mutate the source sets directly:

```ts
$online.add("carol")
// ✅ Triggers recomputation of $onlineAdmins
```

### Reactive Tag System

```ts
const $tagsA = $set({ values: ["x", "y"] })
const $tagsB = $set({ values: ["y", "z"] })
const $commonTags = $intersectionSets({ subsets: [$tagsA, $tagsB] })

$tagsA.delete("y")
// $commonTags → Set { } (now empty)
```

### Reducing Reactivity to Save Resources

All reactive combinations can be temporarily disabled:

```ts
$commonTags.disable() // stops responding to changes
$commonTags.enable() // resumes tracking intersection
```

This is useful for optimizing performance:

- Pause unused derived state during inactive UI screens.
- Avoid unnecessary recomputations when state is backgrounded.

## 🔁 Subscriptions and Signals

All reactive entities expose signals like `.onChange` or `.onSwitch`. These signals emit typed payloads and support cancellation:

```ts
const ctrl = new AbortController()
$tags.onChange.addSignalListener(
    ({ increment, decrement }) => {
        console.log("Updated:", increment, decrement)
    },
    { signal: ctrl.signal },
)
```

## 📚 Learn More

- See [GLOSSARY.md](./REACTIVE-GLOSSARY.md) for terminology
- See [CONTRIBUTING.md](./CONTRIBUTING.md) for internal architecture and projection mechanics

## 🛠 License

MIT
