import { CustomEventListener } from "./_internal/custom-event-listener.interface.js"
import { MonoCustomEventTarget } from "./_internal/mono-custom-event-target.class.js"
import { SignalListenerObject } from "./_internal/signal-listener-object.interface.js"
import { SignalListener } from "./_internal/signal-listener.interface.js"

type SignalListenerOrSignalListenerObject<T> = SignalListener<T> | SignalListenerObject<T>

/**
 * Signal may be activated and may have listeners.
 *
 * @example
 *  class MyUserModel {
 *      public readonly onChange = new Signal()
 *
 *      public set name(value: string) {
 *          this.#name = value
 *          this.onChange.dispatchSignal()
 *      }
 *  }
 *
 *  class MyViewModel {
 *      #user?: MyUserModel
 *
 *      public set user(value: MyUserModel | string) {
 *          const model = value instanceof MyUserModel ? value : new MyUserModel(value)
 *          model.addSignalListener(() => this.#render())
 *          this.#user = model
 *          this.#render()
 *      }
 *
 *      #render() {
 *          // ...
 *      }
 *  }
 */
export class Signal<T = never> {
    #internalEventProvider = new MonoCustomEventTarget<T>()
    #signalListenerToEventListener = new WeakMap<SignalListenerOrSignalListenerObject<any>, CustomEventListener<any>>()

    /** Activates signal and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise. */
    dispatchSignal(detail?: T): boolean {
        return this.#internalEventProvider.dispatchEvent({ detail, cancelable: false })
    }

    /**
     * Appends an signal listener. The callback argument sets the callback that will be invoked when the signal is activated.
     *
     * The options argument sets listener-specific options. For compatibility this can be a boolean, in which case the method behaves exactly as if the value was specified as options's capture.
     *
     * When set to true, options's capture prevents callback from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE. When false (or not present), callback will not be invoked when event's eventPhase attribute value is CAPTURING_PHASE. Either way, callback will be invoked if event's eventPhase attribute value is AT_TARGET.
     *
     * When set to true, options's passive indicates that the callback will not cancel the event by invoking preventDefault().
     *
     * When set to true, options's once indicates that the callback will only be invoked once after which the event listener will be removed.
     *
     * If an AbortSignal is passed for options's signal, then the event listener will be removed when signal is aborted.
     *
     * The event listener is appended to target's event listener list and is not appended if it has the same callback and capture.
     */
    addSignalListener(callback: SignalListenerOrSignalListenerObject<T> | null, options?: AddEventListenerOptions | boolean): void {
        if (callback === null) return this.#internalEventProvider.addEventListener(callback, options)

        const savedWrapper = this.#signalListenerToEventListener.get(callback)
        if (savedWrapper !== undefined) this.#internalEventProvider.addEventListener(savedWrapper, options)

        let wrapper: CustomEventListener<T>

        if (typeof callback === "function") wrapper = (event) => callback(event.detail)
        else wrapper = (event) => callback.handleSignal(event.detail)

        this.#signalListenerToEventListener.set(callback, wrapper)

        this.#internalEventProvider.addEventListener(wrapper, options)
    }

    /** Removes the signal listener in signal listener list with the same callback and options. */
    removeSignalListener(callback: SignalListenerOrSignalListenerObject<T> | null, options?: EventListenerOptions | boolean): void {
        if (callback === null) return this.#internalEventProvider.removeEventListener(callback, options)

        const savedWrapper = this.#signalListenerToEventListener.get(callback)
        if (savedWrapper !== undefined) this.#internalEventProvider.addEventListener(savedWrapper, options)
    }
}
