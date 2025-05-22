export interface CustomEventListener<T> {
    (event: CustomEvent<T>): void
}
