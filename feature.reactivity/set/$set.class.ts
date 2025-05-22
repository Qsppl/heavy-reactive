import { IObservable } from "../_common/observable.interface.js"
import { ISetChanges, TInputSetChanges } from "../_common/set-changes.interface.js"
import { ReactivityDisabledError } from "../reactivity-disabled.error.js"
import { ReadonlyAccessError } from "../readonly-access.error.js"
import { difference } from "/feature.javascript/feature.set/set.prototype.difference.polyfill.js"
import { intersection } from "/feature.javascript/feature.set/set.prototype.intersection.polyfill.js"
import { union } from "/feature.javascript/feature.set/set.prototype.union.polyfill.js"
import { Signal } from "/feature.javascript/feature.signals/signal.class.js"

/**
 * Options used to initialize a reactive set.
 *
 * @template TValue The type of items stored in the set.
 */
export interface ISetOptions<TValue> {
    /**
     * Optional iterable of initial values to populate the set.
     *
     * These values will be added silently — without triggering `onChange`.
     */
    values?: Iterable<TValue>

    /**
     * Optional label for debugging, logging, or introspection.
     *
     * This can be used to identify the reactive set in developer tools.
     */
    label?: string
}

/**
 * Reactive wrapper around JavaScript's native `Set<T>`.
 *
 * `$Set<T>` tracks mutations and notifies subscribers via `onChange` whenever the contents change.
 * All common `Set` operations are supported (`add`, `delete`, `clear`, etc.), but with reactive semantics.
 *
 * You can subscribe to changes using `.onChange.addSignalListener(...)`, which emits change objects
 * describing the items that were added or removed.
 *
 * This class is not intended for direct use. Use the `$set()` helper function to create instances.
 *
 * #### Reactivity control
 *
 * - If reactivity is fully disabled (`immutable`), all mutating operations will throw `ReactivityDisabledError`.
 * - If the set is `readonly`, mutation attempts will throw `ReadonlyAccessError`.
 *
 * Use `onSwitchReactivity` to listen for reactivity mode changes.
 *
 * @template T The type of items stored in the set.
 *
 * @example
 * ```ts
 * const tags = $set<string>()
 *
 * tags.onChange.addSignalListener(({ increment }) => {
 *   if (increment) {
 *     console.log('Added tags:', [...increment])
 *   }
 * })
 *
 * tags.add('reactive') // Logs: "Added tags: ['reactive']"
 * ```
 *
 * @internal
 */
export class $Set<TValue> extends Set<TValue> implements IObservable<ISetChanges<TValue>> {
    /**
     * Optional debug label associated with this reactive set.
     *
     * Used for introspection, logging, or developer tooling.
     * Set during construction and not intended for runtime mutation.
     *
     * @private
     */
    readonly #label: string

    /**
     * Creates a new reactive set.
     *
     * A reactive set extends the native `Set<T>` by adding reactive change tracking.
     * It emits `onChange` signals when the contents are modified via `add`, `delete`, `clear`, etc.
     *
     * Initial elements (if provided) are added silently — no signal is emitted during construction.
     *
     * @param options Configuration object for initialization.
     *
     * @example
     * ```ts
     * const $numbers = $set({ values: [1, 2, 3], label: "initial-numbers" })
     *
     * $numbers.onChange.addSignalListener(() => {
     *   console.log("Updated:", [...$numbers])
     * })
     * ```
     */
    constructor(options: ISetOptions<TValue> = {}) {
        const { values = [], label = "" } = options

        super()

        this.#label = label

        for (const value of values) super.add(value)
    }

    // ################ SWITCH

    /**
     * Signal triggered when the reactivity of this set is toggled (enabled or disabled).
     *
     * This signal is emitted:
     * - when `disableReactivity()` is called;
     * - when `enableReactivity()` is called;
     *
     * It can be used to coordinate reactivity state across multiple linked containers (e.g. cascading).
     *
     * The signal does **not** include a payload — use `.isReactivityEnabled` to inspect the current state.
     *
     * @example
     * ```ts
     * $set.onSwitchReactivity.addSignalListener(() => {
     *   console.log("Reactivity was toggled:", $set.isReactivityEnabled)
     * })
     * ```
     */
    public readonly onSwitchReactivity = new Signal()

    /**
     * Internal flag indicating whether reactivity is enabled.
     *
     * When `false`, all mutation methods throw an error and no signals are emitted.
     * Intended to mark the set as immutable or disconnected from the reactive graph.
     *
     * Modified only via `#enableReactivity()` / `#disableReactivity()`.
     *
     * @private
     */
    #isReactivityEnabled: boolean = true

    /**
     * Disables reactivity and clears the set.
     *
     * - Sets `#isReactivityEnabled = false`
     * - Cancels any active transaction
     * - Clears the underlying set without dispatching `onChange`
     * - Emits `onSwitchReactivity`
     *
     * @private
     */
    #disableReactivity() {
        this.#isReactivityEnabled = false
        this.#cancelTransaction()
        super.clear()
        this.onSwitchReactivity.dispatchSignal()
    }

    /**
     * Re-enables reactivity for this set.
     *
     * - Sets `#isReactivityEnabled = true`
     * - Emits `onSwitchReactivity`
     *
     * Does **not** restore previous contents — the set remains empty.
     *
     * @private
     */
    #enableReactivity() {
        this.#isReactivityEnabled = false
        this.onSwitchReactivity.dispatchSignal()
    }

    /**
     * Protected wrapper around `#disableReactivity()` for use by derived classes or systems.
     *
     * @protected
     */
    protected _disableReactivity() {
        return this.#disableReactivity()
    }

    /**
     * Protected wrapper around `#enableReactivity()` for use by derived classes or systems.
     *
     * @protected
     */
    protected _enableReactivity() {
        return this.#enableReactivity()
    }

    // ################ TRANSACTIONS

    /**
     * Temporary set of values to be added when a transaction is committed.
     *
     * During a transaction, calls to `.add()` or related methods populate this set.
     * When `#closeTransaction()` is called, values from here are applied to the actual set.
     *
     * @private
     */
    #transactionIncrement = new Set<TValue>()

    /**
     * Temporary set of values to be removed when a transaction is committed.
     *
     * During a transaction, calls to `.delete()` or `.clear()` populate this set.
     * When `#closeTransaction()` is called, values from here are removed from the actual set.
     *
     * @private
     */
    #transactionDecrement = new Set<TValue>()

    /**
     * Indicates whether a transaction is currently active.
     *
     * Used internally to determine if changes should be staged
     * or applied immediately.
     *
     * @private
     */
    #transactionIsOpen = false

    /**
     * Starts a new transaction for batching updates.
     *
     * Clears any previous staged changes and marks the transaction as open.
     * If a transaction is already active, does nothing.
     *
     * @private
     */
    #openTransaction() {
        if (this.#transactionIsOpen) return
        this.#transactionIncrement.clear()
        this.#transactionDecrement.clear()
        this.#transactionIsOpen = true
    }

    /**
     * Commits all staged changes collected during the transaction.
     *
     * - Adds all items from `#transactionIncrement` (that are not already present).
     * - Removes all items from `#transactionDecrement` (that still exist).
     * - Emits a single `onChange` signal summarizing the net result.
     *
     * Clears all internal buffers and marks the transaction as closed.
     *
     * @private
     */
    #closeTransaction() {
        if (!this.#transactionIsOpen) return
        this.#transactionIsOpen = false

        const increment: Set<TValue> = difference(this.#transactionIncrement, this)
        this.#transactionIncrement.clear()
        for (const value of increment) super.add(value)

        const decrement: Set<TValue> = intersection(this.#transactionDecrement, this)
        this.#transactionDecrement.clear()
        for (const value of decrement) super.delete(value)

        if (increment.size || decrement.size) {
            this.onChange.dispatchSignal({
                increment: increment.size ? increment : undefined,
                decrement: decrement.size ? decrement : undefined,
            })
        }
    }

    /**
     * Cancels the current transaction and discards all staged changes.
     *
     * Resets internal buffers without applying any changes or dispatching a signal.
     *
     * @private
     */
    #cancelTransaction() {
        this.#transactionIncrement.clear()
        this.#transactionDecrement.clear()
        this.#transactionIsOpen = false
    }

    // TRANSACTIONS (SEMI-PUBLIC)

    /**
     * Starts a transaction, enforcing immutability rules.
     *
     * Throws an error if the set is immutable.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @protected
     */
    protected _openTransaction() {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#openTransaction()
    }

    /**
     * Commits the current transaction if active, enforcing immutability rules.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @protected
     */
    protected _closeTransaction() {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#closeTransaction()
    }

    /**
     * Cancels the current transaction without applying changes.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @protected
     */
    protected _cancelTransaction() {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#cancelTransaction()
    }

    // TRANSACTIONS (PUBLIC)

    /**
     * Opens a transaction for batching updates to the set.
     *
     * While a transaction is open, calls to `add`, `delete`, `clear`, etc.
     * do not emit change signals immediately.
     * Instead, changes are staged and only applied after calling `closeTransaction()`.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @example
     * ```ts
     * $set.openTransaction()
     * $set.add("a")
     * $set.add("b")
     * $set.closeTransaction() // Signal emitted once with added values: ['a', 'b']
     * ```
     */
    public openTransaction() {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#openTransaction()
    }

    /**
     * Closes the active transaction and applies all staged changes.
     *
     * If there were any additions or deletions, a single `onChange` signal is dispatched.
     * If no transaction is open, this is a no-op.
     *
     * @throws {ReactivityDisabledError} If the set is immutable.
     */
    public closeTransaction() {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#closeTransaction()
    }

    /**
     * Cancels any active transaction and discards all pending changes.
     *
     * No signal is dispatched. If no transaction is open, does nothing.
     *
     * @throws {ReactivityDisabledError} If the set is immutable.
     */
    public cancelTransaction() {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#cancelTransaction()
    }

    // ################ EDIT

    /**
     * Signal that notifies subscribers when the set changes.
     *
     * Any mutation of the set — adding, deleting, or clearing items — triggers this signal.
     * Subscribers receive a payload of type `ISetChanges<TValue>`, describing what was added or removed.
     *
     * Use `.addSignalListener(...)` to react to changes.
     *
     * @example
     * ```ts
     * $users.onChange.addSignalListener(({ increment, decrement }) => {
     *   if (increment) console.log('Added:', [...increment])
     *   if (decrement) console.log('Removed:', [...decrement])
     * });
     * ```
     */
    public readonly onChange = new Signal<ISetChanges<TValue>>()

    // ################ EDIT - ADD

    /**
     * Adds a single value to the set, with reactivity.
     *
     * If a transaction is open, the value is staged in `#transactionIncrement`,
     * and removed from `#transactionDecrement`. No signal is dispatched until `closeTransaction()`.
     *
     * If not in a transaction and the value is not already in the set,
     * it is added immediately and `onChange` is dispatched.
     *
     * @param value The value to add.
     * @returns The current set instance.
     *
     * @private
     */
    #reactiveAdd(value: TValue) {
        if (this.#transactionIsOpen) {
            this.#transactionIncrement.add(value)
            this.#transactionDecrement.delete(value)
        } else {
            if (!super.has(value)) {
                super.add(value)
                this.onChange.dispatchSignal({ increment: new Set([value]), decrement: undefined })
            }
        }

        return this
    }

    /**
     * Adds multiple values to the set, with reactivity and optional batching.
     *
     * If a transaction is open, all values are staged into `#transactionIncrement`
     * and removed from `#transactionDecrement`.
     *
     * Otherwise, each value is added immediately if it does not already exist in the set.
     * A single `onChange` signal is dispatched with all added values (if any).
     *
     * @param values A collection of values to add.
     *
     * @private
     */
    #batchReactiveAdd(values: Iterable<TValue>) {
        if (this.#transactionIsOpen) {
            if (values instanceof Set) {
                this.#transactionIncrement = union(this.#transactionIncrement, values)
                this.#transactionDecrement = difference(this.#transactionDecrement, values)
            } else {
                for (const value of values) {
                    this.#transactionIncrement.add(value)
                    this.#transactionDecrement.delete(value)
                }
            }
        } else {
            if (values instanceof Set) {
                const increment: Set<TValue> = difference(values, this)

                for (const value of increment) super.add(value)

                if (increment.size) this.onChange.dispatchSignal({ increment, decrement: undefined })
            } else {
                const increment = new Set<TValue>()

                for (const value of values) {
                    if (super.has(value)) continue
                    super.add(value)
                    increment.add(value)
                }

                if (increment.size) this.onChange.dispatchSignal({ increment, decrement: undefined })
            }
        }
    }

    /**
     * Safely adds a value to the set in reactive mode.
     *
     * Throws an error if reactivity is disabled.
     * Otherwise delegates to `#reactiveAdd`.
     *
     * @param value The value to add.
     * @returns The current set instance.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @protected
     */
    protected _reactiveAdd(value: TValue) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#reactiveAdd(value)
    }

    /**
     * Safely adds multiple values to the set in reactive mode.
     *
     * Throws an error if reactivity is disabled.
     * Otherwise delegates to `#batchReactiveAdd`.
     *
     * @param values Iterable of values to add.
     * @returns The current set instance.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @protected
     */
    protected _batchReactiveAdd(values: Iterable<TValue>) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#batchReactiveAdd(values)
    }

    /**
     * Adds a single value to the reactive set.
     *
     * Behaves like `Set.prototype.add`, but emits an `onChange` signal if the value was not already present.
     * If the value already exists in the set, nothing happens and no signal is emitted.
     *
     * @param value The value to add.
     * @returns The current set instance (for chaining).
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @example
     * ```ts
     * const $items = $set<string>()
     *
     * $items.onChange.addSignalListener(() => {
     *   console.log('Changed:', [...$items])
     * })
     *
     * $items.add('apple') // Logs: ['apple']
     * $items.add('apple') // No log — no change
     * ```
     */
    public add(value: TValue) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#reactiveAdd(value)
    }

    /**
     * Adds multiple values to the reactive set at once.
     *
     * Works like `add()`, but for many values. A single `onChange` signal
     * is dispatched with all newly added values (if any).
     *
     * If reactivity is disabled, throws an error.
     *
     * @param values A collection of values to add.
     * @returns The current set instance (for chaining).
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     */
    public batchAdd(values: Iterable<TValue>) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#batchReactiveAdd(values)
    }

    // ################ EDIT - DELETE

    /**
     * Removes a single value from the set with reactivity.
     *
     * - If a transaction is open, the removal is staged: the value is added to `#transactionDecrement`
     *   and removed from `#transactionIncrement`.
     * - If not in a transaction, the value is removed immediately using `Set.prototype.delete`,
     *   and a signal is dispatched if the set was actually changed.
     *
     * @param value The value to remove.
     * @returns `true` (always), for compatibility with `Set.prototype.delete`.
     *
     * @private
     */
    #reactiveDelete(value: TValue) {
        // Если множество в транзакции — запоминаем удаление, но не применяем сразу
        if (this.#transactionIsOpen) {
            this.#transactionIncrement.delete(value)
            this.#transactionDecrement.add(value)
        } else {
            // Пытаемся удалить - Если удаление было успешным — уведомляем подписчиков
            if (super.delete(value)) this.onChange.dispatchSignal({ increment: undefined, decrement: new Set([value]) })
        }

        return true
    }

    /**
     * Removes multiple values from the set with reactivity.
     *
     * - If a transaction is open, all values are staged for removal:
     *   they are added to `#transactionDecrement` and removed from `#transactionIncrement`.
     *
     * - If not in a transaction:
     *   - A `Set` intersection is used to compute what will actually be removed.
     *   - If any items were removed, `onChange` is dispatched with a `decrement` set.
     *
     * @param values The values to remove.
     *
     * @private
     */
    #batchReactiveDelete(values: Iterable<TValue>) {
        if (this.#transactionIsOpen) {
            if (values instanceof Set) {
                this.#transactionIncrement = difference(this.#transactionIncrement, values)
                this.#transactionDecrement = union(this.#transactionDecrement, values)
            } else {
                for (const value of values) {
                    this.#transactionIncrement.delete(value)
                    this.#transactionDecrement.add(value)
                }
            }
        } else {
            if (values instanceof Set) {
                const decrement: Set<TValue> = intersection(this, values)

                for (const value of decrement) super.delete(value)

                if (decrement.size) this.onChange.dispatchSignal({ increment: undefined, decrement })
            } else {
                const decrement = new Set<TValue>()

                for (const value of values) if (super.delete(value)) decrement.add(value)

                if (decrement.size) this.onChange.dispatchSignal({ increment: undefined, decrement })
            }
        }
    }

    /**
     * Protected wrapper around `#reactiveDelete()` that enforces immutability.
     *
     * @param value The value to remove.
     * @returns `true` (always), for compatibility with `Set.prototype.delete`.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @protected
     */
    protected _reactiveDelete(value: TValue) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#reactiveDelete(value)
    }

    /**
     * Protected wrapper around `#batchReactiveDelete()` that enforces immutability.
     *
     * @param values The values to remove.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @protected
     */
    protected _batchReactiveDelete(values: Iterable<TValue>) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#batchReactiveDelete(values)
    }

    /**
     * Removes a single value from the reactive set.
     *
     * Behaves like `Set.prototype.delete`, but triggers the `onChange` signal
     * only if the element was actually present and removed.
     *
     * If a transaction is active, the removal is staged and the signal will be emitted only after `closeTransaction()`.
     *
     * @param value The value to remove.
     * @returns `true` if the value was removed; `false` if it was not found.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @example
     * ```ts
     * const $tags = $set<string>({ values: ["a", "b", "c"] })
     *
     * $tags.onChange.addSignalListener(({ decrement }) => {
     *   console.log("Removed:", [...(decrement ?? [])])
     * })
     *
     * $tags.delete("b") // Logs: "Removed: ['b']"
     * $tags.delete("z") // No effect
     * ```
     */
    public delete(value: TValue) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#reactiveDelete(value)
    }

    /**
     * Removes multiple values from the reactive set.
     *
     * Behaves like a batch version of `delete()`. A single `onChange` signal
     * is emitted (if any items were actually removed).
     *
     * If a transaction is active, the removals are staged and the signal is dispatched after `closeTransaction()`.
     *
     * @param values The values to remove.
     * @returns The set instance (for chaining).
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     */
    public batchDelete(values: Iterable<TValue>) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#batchReactiveDelete(values)
    }

    // ################ EDIT - CLEAR

    /**
     * Clears all elements from the set with reactivity support.
     *
     * - If a transaction is active, the full contents of the set are marked for removal
     *   by assigning them to `#transactionDecrement`, and staged additions are discarded.
     *
     * - If not in a transaction, the set is cleared immediately via `super.clear()`.
     *   If the set was non-empty, a signal is dispatched listing all removed elements.
     *
     * @private
     */
    #reactiveClear() {
        if (this.#transactionIsOpen) {
            this.#transactionIncrement.clear()
            this.#transactionDecrement = new Set(this)
        } else {
            const decrement = new Set(this)
            super.clear()
            if (decrement.size) this.onChange.dispatchSignal({ increment: undefined, decrement })
        }
    }

    /**
     * Protected version of `#reactiveClear()` that checks immutability.
     *
     * Throws an error if the set is marked as immutable.
     * Otherwise, clears the set reactively.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @protected
     */
    protected _reactiveClear() {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#reactiveClear()
    }

    /**
     * Removes all elements from the reactive set.
     *
     * Behaves like `Set.prototype.clear`, but emits a single `onChange` signal
     * containing all removed items — if the set was not empty.
     *
     * If a transaction is active, the operation is delayed and applied only when `closeTransaction()` is called.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @example
     * ```ts
     * const $tags = $set({ values: ["a", "b", "c"] })
     *
     * $tags.onChange.addSignalListener(({ decrement }) => {
     *   console.log("Cleared:", [...(decrement ?? [])])
     * })
     *
     * $tags.clear() // Logs: Cleared: ['a', 'b', 'c']
     * ```
     */
    public clear() {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#reactiveClear()
    }

    // ################ EDIT - OVERWRITE

    /**
     * Replaces the entire contents of the set with a new set of values, with reactive change detection.
     *
     * - If a transaction is open, changes are staged using `#transactionIncrement` and `#transactionDecrement`.
     * - If no transaction is open:
     *   - Determines the `increment` (values to add) and `decrement` (values to remove).
     *   - Mutates the underlying set and dispatches a signal only if changes are detected.
     *
     * Works efficiently whether the incoming values are a `Set` or a generic iterable.
     *
     * @param values New values that should entirely replace the current set.
     *
     * @private
     */
    #reactiveOverwrite(values: Iterable<TValue>) {
        if (this.#transactionIsOpen) {
            if (values instanceof Set) {
                this.#transactionIncrement = new Set(values)
                this.#transactionDecrement = difference(this, values)
            } else {
                this.#transactionIncrement = new Set(values)
                this.#transactionDecrement = new Set(this)
                for (const value of values) this.#transactionDecrement.delete(value)
            }
        } else {
            if (values instanceof Set) {
                const increment: Set<TValue> = difference(values, this)
                const decrement: Set<TValue> = difference(this, values)

                for (const value of increment) super.add(value)
                for (const value of decrement) super.delete(value)

                if (increment.size || decrement.size) {
                    this.onChange.dispatchSignal({
                        decrement: decrement.size ? decrement : undefined,
                        increment: increment.size ? increment : undefined,
                    })
                }
            } else {
                const increment = new Set<TValue>()
                const decrement = new Set(this)

                for (const value of values) {
                    if (super.has(value)) decrement.delete(value)
                    else increment.add(value)
                }

                for (const value of increment) super.add(value)
                for (const value of decrement) super.delete(value)

                if (increment.size || decrement.size) {
                    this.onChange.dispatchSignal({
                        decrement: decrement.size ? decrement : undefined,
                        increment: increment.size ? increment : undefined,
                    })
                }
            }
        }
    }

    /**
     * Protected wrapper around `#reactiveOverwrite()` that enforces immutability.
     *
     * @param values New values to overwrite the current set.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @protected
     */
    protected _reactiveOverwrite(values: Iterable<TValue>) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#reactiveOverwrite(values)
    }

    /**
     * Fully replaces the contents of the reactive set with a new collection of values.
     *
     * - Removes all values that are no longer present.
     * - Adds all values that are new.
     * - Emits a single `onChange` signal with both `increment` and `decrement` sets (if any).
     *
     * If a transaction is active, the changes are staged and emitted later via `closeTransaction()`.
     *
     * @param values Iterable of new values to assign.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @example
     * ```ts
     * const $ids = $set({ values: [1, 2, 3] })
     *
     * $ids.onChange.addSignalListener(({ increment, decrement }) => {
     *   console.log("Added:", [...(increment ?? [])])
     *   console.log("Removed:", [...(decrement ?? [])])
     * })
     *
     * $ids.overwrite([3, 4, 5])
     * // Added: [4, 5]
     * // Removed: [1, 2]
     * ```
     */
    public overwrite(values: Iterable<TValue>) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#reactiveOverwrite(values)
    }

    // ################ EDIT - APPLY CHANGES

    /**
     * Internally applies a structured change object to the set.
     *
     * - If `overwrite` is specified, replaces the entire set using `#reactiveOverwrite`.
     * - Otherwise applies `increment` and `decrement` via a transactional batch update.
     *
     * Emits a single `onChange` signal with the net result.
     *
     * @param changes Object containing either:
     * - `overwrite`: full replacement values.
     * - or `increment`/`decrement`: differential updates.
     *
     * @private
     */
    #reactiveApplyChanges(changes?: TInputSetChanges<TValue>) {
        if (!changes) return

        if ("overwrite" in changes) {
            if (changes.overwrite) this.#reactiveOverwrite(changes.overwrite)
        } else if (changes.increment || changes.decrement) {
            this.#openTransaction()
            if (changes.increment) this.#batchReactiveAdd(changes.increment)
            if (changes.decrement) this.#batchReactiveDelete(changes.decrement)
            this.#closeTransaction()
        }
    }

    /**
     * Protected wrapper around `#reactiveApplyChanges()` that enforces immutability.
     *
     * @param changes Change instructions to apply.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @protected
     */
    protected _reactiveApplyChanges(changes?: TInputSetChanges<TValue>) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#reactiveApplyChanges(changes)
    }

    /**
     * Applies a set of changes to the reactive set.
     *
     * Supports two modes:
     * - Differential updates via `increment` and/or `decrement`.
     * - Full replacement via `overwrite`.
     *
     * Emits a single `onChange` signal only if there were actual changes.
     * Automatically wraps incremental changes in a transaction for batching.
     *
     * @param changes Object describing the change operation.
     *
     * @throws {ReactivityDisabledError} If the set is marked as immutable.
     *
     * @example
     * ```ts
     * $users.applyChanges({
     *   increment: new Set([4, 5]),
     *   decrement: new Set([1, 2])
     * })
     *
     * $users.applyChanges({
     *   overwrite: new Set([7, 8])
     * })
     * ```
     */
    public applyChanges(changes?: TInputSetChanges<TValue>) {
        if (!this.#isReactivityEnabled) throw new ReactivityDisabledError(`${this} is immutable!`)
        return this.#reactiveApplyChanges(changes)
    }
}

/**
 * A reactive set that is strictly immutable — any mutation attempt will throw an error.
 *
 * This class is typically used as the result of computed transformations (e.g. merge, intersection)
 * of other reactive sets. While it exposes the same read and subscription API as `$Set<T>`,
 * all mutation methods (`add`, `delete`, `clear`, etc.) are overridden to throw.
 *
 * Useful for derived state where mutability must be prohibited to ensure consistency and performance.
 *
 * @template TValue The type of items stored in the set.
 *
 * @example
 * ```ts
 * const merged = $mergeSets([$setA, $setB])
 *
 * merged.onChange.addSignalListener(...) // ✅ allowed
 * merged.add('x')                        // ❌ throws Error: is readonly!
 * ```
 *
 * @internal
 */
export class $ReadonlySet<TValue> extends $Set<TValue> {
    /** @throws {ReadonlyAccessError} Always throws an error, because this set is read-only. */
    public openTransaction(...parameters: Parameters<$Set<TValue>["openTransaction"]>) {
        throw new ReadonlyAccessError(`${this} is readonly!`)
        return super.openTransaction(...parameters)
    }

    /** @throws {ReadonlyAccessError} Always throws an error, because this set is read-only. */
    public closeTransaction(...parameters: Parameters<$Set<TValue>["closeTransaction"]>) {
        throw new ReadonlyAccessError(`${this} is readonly!`)
        return super.closeTransaction(...parameters)
    }

    /** @throws {ReadonlyAccessError} Always throws an error, because this set is read-only. */
    public cancelTransaction(...parameters: Parameters<$Set<TValue>["cancelTransaction"]>) {
        throw new ReadonlyAccessError(`${this} is readonly!`)
        return super.cancelTransaction(...parameters)
    }

    /** @throws {ReadonlyAccessError} Always throws an error, because this set is read-only. */
    public add(...parameters: Parameters<$Set<TValue>["add"]>) {
        throw new ReadonlyAccessError(`${this} is readonly!`)
        return super.add(...parameters)
    }

    /** @throws {ReadonlyAccessError} Always throws an error, because this set is read-only. */
    public batchAdd(...parameters: Parameters<$Set<TValue>["batchAdd"]>) {
        throw new ReadonlyAccessError(`${this} is readonly!`)
        return super.batchAdd(...parameters)
    }

    /** @throws {ReadonlyAccessError} Always throws an error, because this set is read-only. */
    public delete(...parameters: Parameters<$Set<TValue>["delete"]>) {
        throw new ReadonlyAccessError(`${this} is readonly!`)
        return super.delete(...parameters)
    }

    /** @throws {ReadonlyAccessError} Always throws an error, because this set is read-only. */
    public batchDelete(...parameters: Parameters<$Set<TValue>["batchDelete"]>) {
        throw new ReadonlyAccessError(`${this} is readonly!`)
        return super.batchDelete(...parameters)
    }

    /** @throws {ReadonlyAccessError} Always throws an error, because this set is read-only. */
    public clear(...parameters: Parameters<$Set<TValue>["clear"]>) {
        throw new ReadonlyAccessError(`${this} is readonly!`)
        return super.clear(...parameters)
    }

    /** @throws {ReadonlyAccessError} Always throws an error, because this set is read-only. */
    public overwrite(...parameters: Parameters<$Set<TValue>["overwrite"]>) {
        throw new ReadonlyAccessError(`${this} is readonly!`)
        return super.overwrite(...parameters)
    }

    /** @throws {ReadonlyAccessError} Always throws an error, because this set is read-only. */
    public applyChanges(...parameters: Parameters<$Set<TValue>["applyChanges"]>) {
        throw new ReadonlyAccessError(`${this} is readonly!`)
        return super.applyChanges(...parameters)
    }
}
