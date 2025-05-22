import { difference } from "/feature.javascript/feature.set/set.prototype.difference.polyfill.js";
import { union } from "/feature.javascript/feature.set/set.prototype.union.polyfill.js";
import { Signal } from "/feature.javascript/feature.signals/signal.class.js";
/**
 * Reactive delta buffer for a `$Set<T>`.
 *
 * `DeltaBufferForSet` observes changes from a reactive `$Set` source
 * and accumulates a pending change set, separated into additions and removals.
 * These changes can later be committed and consumed as an atomic delta.
 *
 * This buffering mechanism enables controlled, stepwise propagation
 * of updates across multiple reactive dependencies without race conditions or redundant work.
 *
 * ### Lifecycle
 * - When enabled, the buffer listens to `.onChange` of the source set.
 * - All changes are accumulated incrementally in two sets:
 *   - `pendingAdded` — new elements added to the source
 *   - `pendingRemoved` — elements removed from the source
 * - When `commitState()` is called:
 *   - both pending buffers are cleared
 *   - `getCommitted()` becomes valid
 *
 * ### Usage
 * This buffer is used internally in `$SetFromAny` to manage deferred application
 * of changes and is compatible with `TDependencySetResolver` functions.
 *
 * @example
 * ```ts
 * const buffer = new DeltaBufferForSet("source", $tags, resolve, true)
 *
 * const delta = buffer.getBufferedChange()
 * const result = await resolve(context, delta)
 * buffer.commitState()
 * ```
 */
export class DeltaBufferForSet {
    name;
    source;
    resolver;
    /**
     * Signal emitted whenever new uncommitted changes are buffered.
     *
     * Consumers may use this to trigger resolution logic,
     * e.g. in `$SetFromAny`, to launch `synchronize()` when changes are present.
     */
    onChange = new Signal();
    /**
     * The set of values that were added to the source but not yet committed.
     * These will appear in `increment` if `getBufferedChange()` is called.
     */
    #pendingAdded = new Set();
    /**
     * The set of values that were removed from the source but not yet committed.
     * These will appear in `decrement` if `getBufferedChange()` is called.
     */
    #pendingRemoved = new Set();
    /**
     * Whether this delta buffer is currently enabled.
     * A disabled buffer ignores changes and clears its internal state.
     */
    #isLocallyEnabled;
    /** Controller used to cancel the active subscription to `source.onChange`. */
    #changesSubscription;
    /**
     * Initializes a new delta buffer for a `$Set<T>`.
     *
     * The buffer listens to change signals from the given reactive set,
     * accumulates uncommitted additions and removals, and provides access
     * to the resulting delta through `getBufferedChange()`.
     *
     * This constructor also optionally activates the buffer immediately,
     * subscribing to the source and buffering its initial state as an addition.
     *
     * @param name A unique name identifying this dependency within the reactive context.
     * @param source The reactive `$Set` to observe.
     * @param resolver A function that converts buffered changes into result-level updates.
     * @param isInitiallyEnabled Whether the buffer should start active and listening.
     */
    constructor(name, source, resolver, isInitiallyEnabled) {
        this.name = name;
        this.source = source;
        this.resolver = resolver;
        this.#isLocallyEnabled = isInitiallyEnabled;
        if (this.enabled) {
            this.subscribeToSource();
            this.bufferIncomingChange({ increment: this.source, decrement: undefined });
        }
    }
    // ################ ACTIVATION ################
    /**
     * Indicates whether the buffer is currently enabled.
     * If disabled, no changes will be tracked or retained.
     */
    get enabled() {
        return this.#isLocallyEnabled;
    }
    /**
     * Enables the buffer and starts listening for changes from the source set.
     * Immediately buffers the current state as an `increment` delta.
     */
    enable() {
        if (this.#isLocallyEnabled === true)
            return;
        this.#isLocallyEnabled = true;
        this.subscribeToSource();
        this.bufferIncomingChange({ increment: this.source, decrement: undefined });
    }
    /** Disables the buffer, stops tracking, and clears all internal state. */
    disable() {
        if (this.#isLocallyEnabled === false)
            return;
        this.#isLocallyEnabled = false;
        this.#changesSubscription?.abort();
        this.clear();
    }
    // ################ TRACKING ################
    /**
     * Subscribes to the source set's `.onChange` signal.
     * Any received change is buffered using `bufferIncomingChange()`.
     */
    subscribeToSource() {
        const controller = new AbortController();
        this.#changesSubscription = controller;
        this.source.onChange.addSignalListener((changes) => this.bufferIncomingChange(changes), { signal: controller.signal });
    }
    /**
     * Clears both addition and removal buffers.
     * Called when the buffer is disabled or reinitialized.
     */
    clear() {
        this.#pendingAdded.clear();
        this.#pendingRemoved.clear();
    }
    /**
     * Buffers a new incoming set change by merging it into the current delta.
     *
     * - All values from `increment` are added to `pendingAdded` and removed from `pendingRemoved`.
     * - All values from `decrement` are added to `pendingRemoved` and removed from `pendingAdded`.
     *
     * After applying the change, the `onChange` signal is dispatched.
     *
     * @param changes A change payload received from the source set.
     */
    bufferIncomingChange(changes) {
        for (const value of changes.increment ?? []) {
            this.#pendingAdded.add(value);
            this.#pendingRemoved.delete(value);
        }
        for (const value of changes.decrement ?? []) {
            this.#pendingAdded.delete(value);
            this.#pendingRemoved.add(value);
        }
        this.onChange.dispatchSignal();
    }
    // ################ PUBLIC API ################
    /**
     * Returns the current buffered (uncommitted) set changes, if any.
     *
     * @returns An object with `increment` / `decrement` sets, or `null` if no change is buffered.
     * @throws If the buffer is disabled.
     */
    getBufferedChanges() {
        if (!this.enabled)
            throw new Error("Dependence is turned off - you cannot extract its state!");
        if (this.#pendingAdded.size || this.#pendingRemoved.size) {
            return { increment: new Set(this.#pendingAdded), decrement: new Set(this.#pendingRemoved) };
        }
        return null;
    }
    /**
     * Tracks whether the buffer has ever been committed.
     *
     * Used internally by `getCommitted()` to determine
     * whether a valid resolved state can be returned.
     *
     * Until this is `true`, `getCommitted()` will return `null`
     * to indicate that no commit has taken place yet.
     */
    #hasCommittedOnce = false;
    /**
     * Commits the current buffered changes and clears the internal delta.
     *
     * After this call:
     * - `getBufferedChange()` returns null;
     * - `getCommitted()` becomes available.
     *
     * @throws If the buffer is disabled.
     */
    commitChanges() {
        if (!this.enabled)
            throw new Error("Dependence is turned off - you cannot commit its state!");
        this.#pendingAdded.clear();
        this.#pendingRemoved.clear();
        this.#hasCommittedOnce = true;
    }
    /**
     * Returns the last known committed state of the source set,
     * computed as: `(source − pendingAdded) ∪ pendingRemoved`.
     *
     * This gives the actual derived content as seen by the buffer
     * after all resolved and applied changes — not the raw input.
     *
     * @returns A Set representing the last resolved state, or `null` if never committed.
     * @throws If the buffer is disabled.
     */
    getCommittedState() {
        if (!this.enabled)
            throw new Error("Dependence is turned off - you cannot extract its state!");
        if (!this.#hasCommittedOnce)
            return null;
        return union(difference(this.source, this.#pendingAdded), this.#pendingRemoved);
    }
}
