import { Signal } from "class-signals"
import { IObservable } from "../_common/observable.interface.js"
import { IValueChange } from "../_common/value-change.interface.js"
import { IValueContainer } from "../_common/value-container.interface.js"
import equal from "@wry/equality"

/**
 * Options for creating a reactive value container.
 *
 * Used internally by the `$Value` class constructor.
 *
 * @template T Type of the stored value.
 */
export interface IValueOptions<T> {
    /**
     * Initial value to assign to the container.
     */
    value: T

    /**
     * Optional label for debugging, logging, or introspection.
     * Useful in developer tools or when tracing reactive updates.
     */
    label?: string
}

/**
 * Internal class representing a reactive primitive value.
 *
 * `$Value<T>` is the internal implementation behind the `$value()` helper function.
 * It stores a mutable value of type `T` and provides a `.value` getter/setter for reactive access.
 *
 * This class is not intended to be used directly. Use the `$value()` factory to create reactive values.
 *
 * You can observe changes using the `.onChange` signal, which emits objects conforming to `IValueChange<T>`:
 *
 * - `increment`: the new value container (if added or updated)
 * - `decrement`: the previous value container (if removed or updated)
 *
 * @template T The type of the stored value.
 *
 * @example
 * ```ts
 * const flag = $value(false)
 *
 * flag.onChange.subscribe(({ increment, decrement }) => {
 *   if (increment) console.log(`Flag changed to: ${increment.value}`)
 * })
 *
 * flag.value = true // Logs: "Flag changed to: true"
 * ```
 *
 * @internal
 */
export class $Value<TValue> implements IValueContainer<TValue>, IObservable<IValueChange<TValue>> {
    /**
     * Creates a new reactive value container.
     *
     * This constructor is used internally by the `$value()` helper function.
     * It sets the initial value and optionally assigns a debug label.
     *
     * @param options Configuration object for initial state and debugging.
     */
    constructor(options: IValueOptions<TValue>) {
        this.#value = options.value
        this.label = options?.label
    }

    /**
     * Optional label for debugging, logging, or developer tools.
     *
     * Can be used to identify this value container in complex reactive graphs.
     *
     * This field is read-only and defined during construction.
     *
     * @example
     * ```ts
     * const debugValue = $value(42, { label: 'answer' })
     * console.log(debugValue.label) // 'answer'
     * ```
     */
    readonly label?: string

    /**
     * The current raw value stored in this reactive primitive.
     *
     * This is the internal backing field for the `.value` getter and setter.
     * It is updated when `.value` is assigned a new value, and read when `.value` is accessed.
     *
     * Only direct mutation through `.value` is allowed — this field should never be accessed directly.
     *
     * @private
     */
    #value: TValue

    // ##################### REACTIVE #####################

    /**
     * Signal that notifies subscribers whenever the value changes.
     *
     * Emits an `IValueChange<T>` object that describes the change:
     * - `increment`: the new value container (if added or updated)
     * - `decrement`: the previous value container (if removed or updated)
     *
     * Use `.subscribe(...)` to react to changes.
     *
     * @example
     * ```ts
     * const counter = $value(0)
     *
     * counter.onChange.subscribe(({ increment }) => {
     *   console.log(`Counter updated: ${increment?.value}`)
     * })
     *
     * counter.value = 1 // Logs: "Counter updated: 1"
     * ```
     */
    readonly onChange = new Signal<IValueChange<TValue>>()

    // ##################### TRANSACTION #####################

    /**
     * Stores a temporary value during an open transaction.
     *
     * This field is used internally to hold a staged value when `openTransaction()` is called.
     * It is committed to `.value` only when `closeTransaction()` is invoked.
     *
     * @private
     */
    #transactionState?: IValueContainer<TValue>

    /**
     * Tracks whether a transaction is currently active.
     *
     * If true, value updates are staged but not emitted until `closeTransaction()` is called.
     *
     * @private
     */
    #transactionIsOpen = false

    /**
     * Opens a transaction to batch updates and delay `onChange` emissions.
     *
     * When a transaction is active, value updates do not trigger listeners immediately.
     * Instead, the final value is stored and emitted only when `closeTransaction()` is called.
     *
     * Calling this method multiple times has no effect.
     *
     * @example
     * ```ts
     * counter.openTransaction()
     * counter.value = counter.value + 1
     * counter.value = counter.value + 1
     * counter.closeTransaction() // `onChange` triggered only once with final value
     * ```
     */
    openTransaction() {
        if (this.#transactionIsOpen) return
        this.#transactionIsOpen = true

        this.#transactionState = undefined
    }

    /**
     * Closes the active transaction and commits the final staged value.
     *
     * If any changes were made during the transaction, the final value is assigned to `.value`
     * and listeners are notified via `onChange`.
     *
     * If no transaction was active, this method does nothing.
     */
    closeTransaction() {
        if (!this.#transactionIsOpen) return
        this.#transactionIsOpen = false

        if (this.#transactionState) {
            this.value = this.#transactionState.value
            this.#transactionState = undefined
        }
    }

    // ##################### EDIT #####################

    /**
     * Updates the value stored in this reactive primitive.
     *
     * If the new value is different from the current one, the change is applied and a signal is dispatched.
     * This notifies all listeners via `.onChange` with the corresponding `IValueChange<T>` payload.
     *
     * If the new value is strictly equal (`===`) to the current one, no update or signal is triggered.
     *
     * @param next The new value to assign.
     *
     * @example
     * ```ts
     * const count = $value(0)
     *
     * count.value = 5 // Triggers .onChange
     * count.value = 5 // No change, signal not triggered
     * ```
     */
    set value(next: TValue) {
        if (this.#transactionIsOpen) {
            this.#transactionState = { value: next }
        } else {
            if (equal(this.#value, next)) return

            const lastState = { value: this.#value }

            this.#value = next

            const nextState = { value: this.#value }

            this.onChange.activate({ decrement: lastState, increment: nextState })
        }
    }

    /**
     * Gets the current value stored in this reactive primitive.
     *
     * Reading `.value` registers the access as a dependency, so if this is done within a reactive context
     * (e.g. inside a signal listener or another observable), it will automatically re-run when the value changes.
     *
     * @returns The current value of type `T`.
     *
     * @example
     * ```ts
     * const username = $value('guest')
     *
     * // Accessing the value
     * console.log(username.value) // 'guest'
     * ```
     */
    get value(): TValue {
        return this.#value
    }
}
