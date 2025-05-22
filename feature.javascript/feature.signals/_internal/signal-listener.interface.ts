export interface SignalListener<T> {
    (detail: T): void
}
