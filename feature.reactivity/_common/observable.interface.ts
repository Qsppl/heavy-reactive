import { IIncrementalChanges } from "./changes.interface.js"
import { Signal } from "/feature.javascript/feature.signals/signal.class.js"

/**
 * Contract for reactive data sources that can emit change notifications.
 *
 * Any object implementing this interface exposes an `onChange` signal,
 * which allows listeners to subscribe to structural or value changes.
 *
 * @template TChanges The shape of the emitted change payload.
 */
export interface IObservable<TChanges = IIncrementalChanges> {
    /**
     * Reactive signal that emits changes.
     *
     * The emitted value must conform to the generic type `TChanges`,
     * and is typically an object describing the difference (e.g. increment/decrement).
     *
     * Use `.addSignalListener(...)` to subscribe.
     */
    onChange: Signal<TChanges>
}
