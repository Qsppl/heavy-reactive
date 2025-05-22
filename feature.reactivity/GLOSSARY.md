# 🧠 Reactive Glossary

This document defines the core concepts and terms used throughout the reactive value system. It serves as a shared vocabulary for library users and contributors.

---

## 📦 Reactive Value (`$value()`)

A reactive scalar wrapper for a single value. Useful when tracking primitive state, object references, or lightweight computed values.

- Holds a single `value`.
- Emits structured change payloads via `.onChange`.
- Supports transactional batching (`openTransaction`, `closeTransaction`).
- Exposes `IValueChange<T>`: `{ increment?, decrement? }` where each side is a `IValueContainer<T>`.

```ts
const counter = $value({ value: 0 })
counter.value = 5 // Triggers onChange if changed
```

---

## 🧺 Reactive Set (`$set()`)

A reactive collection of unique items with fine-grained change tracking.

- Wraps standard `Set<T>` behavior.
- Emits reactive diffs via `.onChange`.
- Supports batch methods: `batchAdd`, `batchDelete`, `applyChanges`.
- Supports transactions: `openTransaction`, `closeTransaction`.
- Emits `ISetChanges<T>` payloads: `{ increment?: Set<T>, decrement?: Set<T> }`

```ts
const $tags = $set({ values: ["a", "b"] })
$tags.add("c") // Emits increment: Set { 'c' }
```

**Batching options:**

- `batchAdd()`, `batchDelete()`, `applyChanges()` — apply changes immediately.
- `openTransaction()` / `closeTransaction()` — delay signaling until complete.

---

## 🧩 Reactive Combinations (`$intersectionSets`, `$unionSets`, `$differenceSets`)

Derived sets that compute dynamic relationships between multiple reactive sets.

### `Intersection`

Includes only values present in **all** subsets.

```ts
$intersectionSets({ subsets: [$a, $b] })
```

### `Union`

Includes all values present in **any** subset.

```ts
$unionSets({ subsets: [$a, $b] })
```

### `Difference`

Includes values from `superset` that are **not present in any** of the subsets.

```ts
$differenceSets({ superset: $a, subsets: [$b] })
```

Combination sets:

- Extend the `$Set<T>` interface.
- Are automatically updated on any input change.
- Are strictly `readonly`: they reflect upstream state.
- Can be enabled or disabled (reactively toggled).

They are implemented using the abstract base classes `$Combination<T>` and `$VariadicCombination<T>`.

---

## 🧭 Projection-Based Sets

Projection-based sets are derived sets whose contents are computed by applying a user-defined projection function (`resolver`) to one or more **relation keys**.

- These keys can come from either a `$Value<T>` (one key) or a `$Set<T>` (many keys).
- The `resolver()` maps keys to values in the `superset`.
- The `superset` always acts as a **mask**, ensuring the final result remains a subset of it.
- Optionally, the projection can be **excluded** (masked out) from the result — forming a complement.

These sets include:

| Class               | Keys from       | Projection to        | Result type            | Masked? |
| ------------------- | --------------- | -------------------- | ---------------------- | ------- |
| `$SubsetViaVal`     | `$Value<T>`     | included values      | subset of superset     | Yes     |
| `$SubsetViaSet`     | `$Set<T>`       | union of projections | subset of superset     | Yes     |
| `$ComplementViaVal` | `$Value<T>`     | values to exclude    | complement of superset | Yes     |
| `$ComplementViaSet` | `$Set<T>`       | values to exclude    | complement of superset | Yes     |
| `$SetFromSet`       | `$Set<TSource>` | delta-mapped values  | arbitrary projection   | No      |

### Glossary terms

- **Superset** — The source of all candidate values.
- **Relation key** — An input value used to drive projection.
- **Resolver** — A function that projects relation keys into result values.
- **Projection** — The mapping from key(s) to included or excluded values.
- **Mask** — A filtering constraint applied over the superset; ensures result ⊆ superset.
- **Complement** — A projection that removes its result from the superset.

Projection-based sets are fully reactive, readonly, and synchronized using internal delta buffers.

---

## 🔁 Signals & Reactivity

All reactive entities emit events through signals.

- Signals are exposed via `.onChange`, `.onSwitch`, etc.
- Subscriptions are registered using `.addSignalListener(handler, { signal })`.
- Subscriptions can be cancelled via `AbortController`.

```ts
const controller = new AbortController()
$set.onChange.addSignalListener(
    ({ increment }) => {
        console.log(increment)
    },
    { signal: controller.signal },
)
```

---

## 📘 Core Change Payload Types

| Type                  | Description                                                          |
| --------------------- | -------------------------------------------------------------------- |
| `ISetChanges<T>`      | `{ increment?: Set<T>, decrement?: Set<T> }`                         |
| `IValueChange<T>`     | `{ increment?: IValueContainer<T>, decrement?: IValueContainer<T> }` |
| `IOverwriteChange<T>` | `{ overwrite: T }`                                                   |

These are used across `.onChange` signals and `applyChanges()` methods.
