import { CustomEventListener } from "./custom-event-listener.interface.js"
import { MonoCustomEventTarget } from "./mono-custom-event-target.class.js"
import { SignalListenerObject } from "./signal-listener-object.interface.js"
import { SignalListener } from "./signal-listener.interface.js"

type SignalListenerOrSignalListenerObject<T> = SignalListener<T> | SignalListenerObject<T>

export class ListenonlySignal<T> {
    #internalEventProvider
    #signalListenerToEventListener = new WeakMap<SignalListenerOrSignalListenerObject<any>, CustomEventListener<any>>()

    constructor(eventProvider: MonoCustomEventTarget<T>) {
        this.#internalEventProvider = eventProvider
    }

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

    removeSignalListener(callback: SignalListenerOrSignalListenerObject<T> | null, options?: EventListenerOptions | boolean): void {
        if (callback === null) return this.#internalEventProvider.removeEventListener(callback, options)

        const savedWrapper = this.#signalListenerToEventListener.get(callback)
        if (savedWrapper !== undefined) this.#internalEventProvider.addEventListener(savedWrapper, options)
    }
}
