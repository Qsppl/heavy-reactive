import { CustomEventListenerObject } from "./custom-event-listener-object.interface.js"
import { CustomEventListener } from "./custom-event-listener.interface.js"

export class MonoCustomEventTarget<T> {
    #internalEventTarget = new EventTarget()

    #eventType

    constructor(label: string = "") {
        this.#eventType = label
    }

    public addEventListener(callback: CustomEventListener<T> | CustomEventListenerObject<T> | null, options?: AddEventListenerOptions | boolean): void {
        /// @ts-expect-error idk how typing this(
        this.#internalEventTarget.addEventListener(this.#eventType, callback, options)
    }

    public dispatchEvent(eventInitDict?: CustomEventInit<T> | undefined): boolean {
        return this.#internalEventTarget.dispatchEvent(new CustomEvent(this.#eventType, eventInitDict))
    }

    public removeEventListener(callback: CustomEventListener<T> | CustomEventListenerObject<T> | null, options?: EventListenerOptions | boolean): void {
        /// @ts-expect-error idk how typing this(
        this.#internalEventTarget.removeEventListener(this.#eventType, callback, options)
    }
}
