# Contributing

This project uses a modular and declarative approach to reactive state modeling. Contributions should follow the existing architectural principles and naming conventions.

## Guidelines

* **Favor composability**: use primitives that compose cleanly (e.g. `$Set`, `$Value`, `$Intersection`).
* **Use explicit projection**: all transformation logic should be placed inside `resolver()` functions, not inline.
* **Respect read-only boundaries**: all derived sets must be immutable from the outside.
* **Avoid entanglement**: prefer isolated reactive nodes and explicit connections between them.

## Internal Structure

The system is composed of core reactive types:

* `$Value<T>`: reactive container for a single value
* `$Set<T>`: reactive observable Set<T>
* `$Combination<T>`: abstract base for derived reactive sets

The system also supports composition tools like:

* `$Intersection`
* `$Union`
* `$Difference`
* Projection-based operators (see below)

---

## 🧭 Projection-Based Derived Sets

Projection sets derive their contents from a **superset** and a set of **relation keys**, using a custom `resolver()` function.

These keys are not filtered against the superset directly. Instead, each key is **projected** into one or more values from the superset via the resolver. This enables reactive relationships such as:

* tags → items
* roles → permissions
* categories → associated content

### Core concepts:

| Concept         | Meaning                                                               |
| --------------- | --------------------------------------------------------------------- |
| Superset        | The source set of all possible values                                 |
| Relation keys   | Keys that drive projection; can be a `$Value<T>` or `$Set<T>`         |
| Resolver        | Function mapping relation keys to projected values                    |
| Mask (optional) | If used (`complement`), excludes the projected values from the result |
| Result          | `$Set<TResult>` that includes or excludes projected values reactively |

### Supported patterns:

| Class               | Description                            | Projection Source | Masking |
| ------------------- | -------------------------------------- | ----------------- | ------- |
| `$SubsetViaVal`     | one key → values to include            | `$Value<T>`       | No      |
| `$SubsetViaSet`     | many keys → union of values to include | `$Set<T>`         | No      |
| `$ComplementViaVal` | one key → values to exclude            | `$Value<T>`       | Yes     |
| `$ComplementViaSet` | many keys → union of values to exclude | `$Set<T>`         | Yes     |
| `$SetFromSet`       | delta → transformed delta              | `$Set<T>`         | No      |

Resolvers must handle changes incrementally and support projection semantics. Values in the relation input are **not** result values — they are *keys to compute with*.

---

## 🔁 Synchronization and Delta Buffers

Reactive projection sets use internal delta buffers to accumulate uncommitted changes from their dependencies. These are represented by `DeltaBufferForSet` and `DeltaBufferForValue`.

Each buffer tracks:

* The last committed state
* The current uncommitted (pending) changes
* Emits `.onChange` when pending state changes

A `synchronize()` loop iterates over all active buffers, resolves the next pending delta via the `resolver()`, commits the result, and repeats until no further deltas are detected.

This model ensures:

* Asynchronous-safe updates
* Deterministic reactivity
* Efficient batching

---

## 🧩 Architectural Roadmap

The current architecture relies on specialized subclasses like `$SubsetViaSet`, `$ComplementViaVal`, etc.
We plan to:

* **Generalize projection logic** across value- and set-based dependencies.
* **Extract cascade propagation** into a dedicated coordination layer to allow priority control.
* **Modularize node activation/deactivation**, allowing better lifecycle tracking and isolation.
* **Split user-side effects** from core propagation to optimize dependency traversal.

All contributors are encouraged to keep these directions in mind and submit helpers or refactors that support this direction.

## 📐 Architectural References

This reactive model borrows from:

* **Projectional transformation** (graph queries, RDB joins)
* **Incremental computation** (dataflow graphs, spreadsheet logic)
* **Observer pattern** via `Signal`
* **CRDT-style overwrite propagation** in overwrite mode

All combinators must be:

* Pull-based from source
* Push-updated via `applyChanges()`
* Isolation-tolerant (able to disable/re-enable cleanly)

---

## 🧪 Testing

All changes must be accompanied by unit tests for new logic, and regression tests for fixed bugs.

Use the existing test harness under `/test` and add specs per feature/module.
