export interface SignalListenerObject<T> {
    handleSignal(detail: T): void
}
