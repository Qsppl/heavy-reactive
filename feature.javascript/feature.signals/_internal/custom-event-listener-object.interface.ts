export interface CustomEventListenerObject<T> {
    handleEvent(object: CustomEvent<T>): void
}
