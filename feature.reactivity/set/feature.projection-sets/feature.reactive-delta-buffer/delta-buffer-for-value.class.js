import deepEqual from "/feature.javascript/deep-equal.helper.js";
import { Signal } from "/feature.javascript/feature.signals/signal.class.js";
/**
 * Reactive delta buffer for a `$Value<T>`.
 *
 * `DeltaBufferForValue` tracks changes from a source `$Value<T>` and stores
 * an uncommitted delta until it is explicitly resolved via `.commit()`.
 *
 * This class implements a two-phase model:
 * 1. **Indexing phase** — changes are detected and stored in `#pending`;
 * 2. **Commit phase** — changes are acknowledged and flushed into `#committed`.
 *
 * It acts as a delta gate between a source reactive value and
 * a resolver that maps changes into a derived set.
 *
 * @remarks
 * - Signals are not data carriers — they only notify that something changed.
 * - The buffer exposes access to `getIndexedChange()` only when active.
 * - The buffer is disabled via `.disable()` and re-enabled via `.enable()`.
 *
 * @example
 * ```ts
 * const delta = new DeltaBufferForValue('mode', $mode, resolve, true)
 *
 * // on change signal
 * const deltaPayload = delta.getIndexedChange()
 * const resultDelta = await resolve(context, deltaPayload)
 * delta.commit()
 * applyChanges(resultDelta)
 * ```
 */
export class DeltaBufferForValue {
    name;
    source;
    resolver;
    /**
     * Signal emitted when new uncommitted changes are detected.
     * Consumers should call `.getIndexedChange()` and then `.commit()`.
     */
    onChange = new Signal();
    /**
     * The last committed value from the source.
     * Used for diffing and rollback logic.
     */
    #committedState = undefined;
    /**
     * The currently indexed (but not yet committed) value.
     * Will be returned by `.getIndexedChange()` if present.
     */
    #pendingChange = undefined;
    /** Whether the buffer is currently active. */
    #isLocallyEnabled;
    /** Subscription controller for source signal. */
    #changesSubscription;
    /**
     * Creates a new delta buffer for a `$Value`.
     *
     * @param name A logical name for this tracked dependency (used in context).
     * @param source The `$Value` instance to track.
     * @param resolver Function to map value changes into result set changes.
     * @param isInitiallyEnabled Whether this buffer should start active.
     */
    constructor(name, source, resolver, isInitiallyEnabled) {
        this.name = name;
        this.source = source;
        this.resolver = resolver;
        this.#isLocallyEnabled = isInitiallyEnabled;
        if (this.enabled) {
            this.subscribeToSource();
            this.bufferIncomingChange(this.source);
        }
    }
    // ################ ACTIVATION ################
    /**
     * Whether this delta buffer is currently active.
     * A disabled buffer ignores source changes and clears its internal state.
     */
    get enabled() {
        return this.#isLocallyEnabled;
    }
    /**
     * Enables this buffer, starts tracking changes again,
     * and re-indexes the current value.
     */
    enable() {
        if (this.#isLocallyEnabled)
            return;
        this.#isLocallyEnabled = true;
        this.subscribeToSource();
        this.bufferIncomingChange(this.source);
    }
    /**
     * Disables this buffer and clears all tracked state.
     * Future changes will be ignored until re-enabled.
     */
    disable() {
        if (!this.#isLocallyEnabled)
            return;
        this.#isLocallyEnabled = false;
        this.#changesSubscription?.abort();
        this.clear();
    }
    /**
     * Clears both the committed and uncommitted (pending) values.
     * Called when the buffer is disabled or reinitialized.
     */
    clear() {
        this.#pendingChange = undefined;
        this.#committedState = undefined;
    }
    // ################ TRACKING ################
    /**
     * Subscribes to the `$Value` source and routes incoming changes into the buffer.
     * Only `increment` values are tracked.
     */
    subscribeToSource() {
        const controller = new AbortController();
        this.#changesSubscription = controller;
        this.source.onChange.addSignalListener((change) => change.increment && this.bufferIncomingChange(change.increment), { signal: controller.signal });
    }
    /**
     * Compares a new incoming value to the committed state,
     * and stores it in the pending buffer if it's different.
     * Emits `onChange` if the pending state is updated.
     *
     * @param incoming A new value container emitted by the source.
     */
    bufferIncomingChange(state) {
        // Skip if already pending and unchanged
        if (this.#pendingChange && deepEqual(this.#pendingChange, state))
            return;
        // If value matches committed, clear pending
        if (deepEqual(this.#committedState, state))
            this.#pendingChange = undefined;
        else
            this.#pendingChange = { value: state.value };
        this.onChange.dispatchSignal();
    }
    // ################ PUBLIC API ################
    /**
     * Returns the currently buffered (uncommitted) change.
     *
     * @returns A value change object `{ increment, decrement }` or `null`.
     * @throws If the buffer is disabled.
     */
    getBufferedChange() {
        if (!this.enabled)
            throw new Error("Dependence is turned off - you cannot extract its state!");
        if (!this.#pendingChange)
            return null;
        return { increment: this.#pendingChange, decrement: this.#committedState };
    }
    /**
     * Commits the last pending value, making it the new reference state.
     *
     * @throws If the buffer is disabled or there's nothing to commit.
     */
    commitState() {
        if (this.#pendingChange === undefined)
            throw new Error("Dependence is turned off - you cannot commit its state!");
        this.#committedState = this.#pendingChange;
        this.#pendingChange = undefined;
    }
    /**
     * Returns the last committed value container.
     *
     * @returns `{ value }` if committed, or `null` if never committed.
     * @throws If the buffer is disabled.
     */
    getCommittedState() {
        if (!this.enabled)
            throw new Error("Dependence is turned off - you cannot extract its state!");
        if (!this.#committedState)
            return null;
        return this.#committedState;
    }
}
