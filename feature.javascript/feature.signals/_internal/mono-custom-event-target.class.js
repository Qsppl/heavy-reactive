export class MonoCustomEventTarget {
    #internalEventTarget = new EventTarget();
    #eventType;
    constructor(label = "") {
        this.#eventType = label;
    }
    addEventListener(callback, options) {
        /// @ts-expect-error idk how typing this(
        this.#internalEventTarget.addEventListener(this.#eventType, callback, options);
    }
    dispatchEvent(eventInitDict) {
        return this.#internalEventTarget.dispatchEvent(new CustomEvent(this.#eventType, eventInitDict));
    }
    removeEventListener(callback, options) {
        /// @ts-expect-error idk how typing this(
        this.#internalEventTarget.removeEventListener(this.#eventType, callback, options);
    }
}
