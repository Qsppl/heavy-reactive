import { $Combination } from "../_combination/$combination.class.js";
import { $Value } from "../../value/$value.class.js";
import { $Set } from "../$set.class.js";
import { DeltaBufferForSet } from "./feature.reactive-delta-buffer/delta-buffer-for-set.class.js";
import { DeltaBufferForValue } from "./feature.reactive-delta-buffer/delta-buffer-for-value.class.js";
/**
 * Reactive combination that derives a set from one or more `$Set` or `$Value` sources.
 *
 * `$SetFromAny` generalizes reactive set computation by allowing
 * arbitrary dependencies (sets or values) and assigning each a resolver function.
 *
 * Whenever any dependency changes, the appropriate resolver runs,
 * producing incremental or overwrite-level changes to the result.
 *
 * This class powers all advanced constructs like:
 * - `$SubsetViaVal`, `$SubsetViaSet`
 * - `$ComplementViaVal`, `$ComplementViaSet`
 * - `$SetFromSet`
 *
 * @template TResult The type of values in the resulting set.
 * @template TDependencies A record of dependency names → $Set / $Value
 *
 * @remarks
 * This set is readonly. To influence its result, mutate the sources it depends on.
 */
export class $SetFromAny extends $Combination {
    /**
     * Internal buffer objects that accumulate and commit changes
     * from each reactive dependency.
     */
    buffers = new Set();
    constructor(options) {
        super(options);
        for (const name in options.dependencies) {
            const source = options.dependencies[name];
            if (source instanceof $Set) {
                /// @ts-expect-error: type erasure due to structural resolution
                const resolver = options.resolvers[name];
                this.buffers.add(new DeltaBufferForSet(name, source, resolver, false));
            }
            else if (source instanceof $Value) {
                /// @ts-expect-error: type erasure due to structural resolution
                const resolver = options.resolvers[name];
                this.buffers.add(new DeltaBufferForValue(name, source, resolver, false));
            }
            else
                throw new TypeError(`Unexpected dependency type for "${name}".`);
        }
        if (this.enabled)
            this.attachBuffers();
    }
    // ################# CASCADED REACTIVITY ####################
    /** Returns the list of parent sources that are reactive combinations and currently disabled. */
    get inactiveParents() {
        return [...this.buffers].map((buffer) => buffer.source).filter((source) => source instanceof $Combination && !source.enabled);
    }
    /**
     * Returns true if all parent combinations are currently active.
     * If any parent is disabled, this node is considered blocked.
     */
    get allParentsAreActive() {
        return this.inactiveParents.length === 0;
    }
    /**
     * Whether this combination is currently reactive and eligible for updates.
     *
     * A node is considered enabled only if:
     * - it is locally enabled;
     * - all its parent combinations are enabled (transitive cascade).
     */
    get enabled() {
        return this.isLocallyEnabled && this.allParentsAreActive;
    }
    /**
     * Enables the current node locally.
     * Will trigger full activation only if all parent combinations are active.
     */
    activate() {
        this.isLocallyEnabled = true;
        if (this.allParentsAreActive)
            this.onActivated();
    }
    /**
     * Disables the current node locally.
     * Will trigger full deactivation only if all parent combinations are still active.
     */
    deactivate() {
        this.isLocallyEnabled = false;
        if (this.allParentsAreActive)
            this.onDeactivated();
    }
    // ################# LIFECYCLE AND SUBSCRIPTION #################
    /**
     * Internal controller used to cancel the currently running `synchronize()` operation.
     * Ensures that overlapping sync passes do not interfere with each other.
     */
    #syncController;
    /**
     * Stores per-buffer subscription controllers.
     * Used to unsubscribe cleanly during deactivation.
     */
    changeSubscriptions = new Map();
    /**
     * Called when this node becomes fully active (locally and via parent cascade).
     * Enables all buffers, subscribes to their `.onChange`, and starts syncing.
     */
    onActivated() {
        super.onActivated();
        this.attachBuffers();
    }
    /**
     * Called when this node is deactivated.
     * Unsubscribes from all buffer change signals and cancels pending sync work.
     */
    onDeactivated() {
        super.onDeactivated();
        this.detachBuffers();
        this.#syncController?.abort();
    }
    /**
     * Enables all delta buffers and subscribes to their `.onChange` signals.
     * Triggers an initial `synchronize()` pass to resolve buffered state.
     */
    attachBuffers() {
        for (const buffer of this.buffers)
            buffer.enable();
        for (const buffer of this.buffers)
            this.listenToBuffer(buffer);
        this.synchronize();
    }
    /**
     * Unsubscribes from all buffer signals and disables tracking.
     * Called during full deactivation of this node.
     */
    detachBuffers() {
        for (const buffer of this.buffers) {
            this.changeSubscriptions.get(buffer)?.abort();
            buffer.disable();
        }
    }
    /**
     * Subscribes to `.onChange` signals from a delta buffer.
     *
     * Signals are treated as notifications that a new delta *may* exist.
     * After receiving a signal, we check for real uncommitted changes via `getBufferedChange()`.
     * If changes are present, a `synchronize()` pass is started.
     *
     * @param buffer A delta buffer tracking either a `$Set` or `$Value` source.
     */
    listenToBuffer(buffer) {
        const controller = new AbortController();
        this.changeSubscriptions.set(buffer, controller);
        if (buffer instanceof DeltaBufferForSet)
            buffer.onChange.addSignalListener(() => buffer.getBufferedChanges() && this.synchronize(), { signal: controller.signal });
        if (buffer instanceof DeltaBufferForValue)
            buffer.onChange.addSignalListener(() => buffer.getBufferedChange() && this.synchronize(), { signal: controller.signal });
    }
    /** Whether a sync worker is currently running. */
    #isWorkerRunned = false;
    /**
     * Prevents overlapping sync operations by running only one worker at a time.
     * If a sync is already running, this call is skipped.
     *
     * @param doWork A function that receives an `AbortSignal` and performs the sync logic.
     */
    async runWorker(doWork) {
        if (this.#isWorkerRunned)
            return;
        this.#isWorkerRunned = true;
        const controller = (this.#syncController = new AbortController());
        try {
            await doWork(controller.signal);
        }
        catch (error) {
            console.error(error);
            this.disable();
            console.warn("The derived set was disabled because an error occurred while resolving its dependencies.");
        }
        this.#isWorkerRunned = false;
        this.#syncController = undefined;
    }
    /**
     * Synchronizes buffered changes by resolving and applying deltas
     * from one dependency buffer at a time.
     *
     * Because resolution is asynchronous, other buffers might change
     * while we await — so we must re-evaluate all buffers after each resolution.
     *
     * This loop continues until no buffered deltas remain.
     */
    async synchronize() {
        this.runWorker(async (signal) => {
            let desyncDetected = false;
            do {
                desyncDetected = false;
                for (const buffer of this.buffers) {
                    if (buffer instanceof DeltaBufferForSet) {
                        // Try to consume buffered delta from this buffer
                        const bufferedDelta = buffer.getBufferedChanges();
                        if (!bufferedDelta)
                            continue;
                        // Mark this buffer as committed before awaiting resolver
                        buffer.commitChanges();
                        // Compute the downstream effect of this delta
                        const resolvedDelta = await buffer.resolver(this.contextSnapshot(), bufferedDelta);
                        // A delta was consumed — we must re-check all buffers from the start
                        desyncDetected = true;
                        // If this sync pass was aborted (e.g., due to disable), stop immediately
                        if (signal.aborted)
                            return;
                        // Apply changes to the target set
                        this.applyChanges(resolvedDelta);
                        break;
                    }
                    else if (buffer instanceof DeltaBufferForValue) {
                        // Try to consume buffered delta from this buffer
                        const bufferedDelta = buffer.getBufferedChange();
                        if (!bufferedDelta)
                            continue;
                        // Mark this buffer as committed before awaiting resolver
                        buffer.commitState();
                        // Compute the downstream effect of this delta
                        const resolvedDelta = await buffer.resolver(this.contextSnapshot(), bufferedDelta);
                        // A delta was consumed — we must re-check all buffers from the start
                        desyncDetected = true;
                        // If this sync pass was aborted (e.g., due to disable), stop immediately
                        if (signal.aborted)
                            return;
                        // Apply changes to the target set
                        this.applyChanges(resolvedDelta);
                        break;
                    }
                }
            } while (desyncDetected);
        });
    }
    /**
     * Returns a snapshot of the last committed state of all dependencies.
     *
     * This snapshot is passed as the `context` argument to resolver functions.
     * It contains:
     * - for each `$Set` dependency: a `Set<T> | null` representing committed values;
     * - for each `$Value` dependency: an `IValueContainer<T> | null` representing the last known value;
     *
     * @returns A record mapping dependency names to their last committed state.
     */
    contextSnapshot() {
        const committedStates = {};
        for (const buffer of this.buffers)
            committedStates[buffer.name] = buffer.getCommittedState();
        return committedStates;
    }
}
