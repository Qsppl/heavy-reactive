export class ListenonlySignal {
    #internalEventProvider;
    #signalListenerToEventListener = new WeakMap();
    constructor(eventProvider) {
        this.#internalEventProvider = eventProvider;
    }
    addSignalListener(callback, options) {
        if (callback === null)
            return this.#internalEventProvider.addEventListener(callback, options);
        const savedWrapper = this.#signalListenerToEventListener.get(callback);
        if (savedWrapper !== undefined)
            this.#internalEventProvider.addEventListener(savedWrapper, options);
        let wrapper;
        if (typeof callback === "function")
            wrapper = (event) => callback(event.detail);
        else
            wrapper = (event) => callback.handleSignal(event.detail);
        this.#signalListenerToEventListener.set(callback, wrapper);
        this.#internalEventProvider.addEventListener(wrapper, options);
    }
    removeSignalListener(callback, options) {
        if (callback === null)
            return this.#internalEventProvider.removeEventListener(callback, options);
        const savedWrapper = this.#signalListenerToEventListener.get(callback);
        if (savedWrapper !== undefined)
            this.#internalEventProvider.addEventListener(savedWrapper, options);
    }
}
