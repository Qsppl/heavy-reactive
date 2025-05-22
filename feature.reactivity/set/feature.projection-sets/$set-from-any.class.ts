import { $Combination, ICombinationOptions } from "../_combination/$combination.class.js"
import type { TDependencySetResolver } from "./types/dependency-set-resolver.type.js"
import type { TDependencyValueResolver } from "./types/dependency-value-resolver.type.js"
import { $Value } from "../../value/$value.class.js"
import { $Set } from "../$set.class.js"
import { DeltaBufferForSet } from "./feature.reactive-delta-buffer/delta-buffer-for-set.class.js"
import { DeltaBufferForValue } from "./feature.reactive-delta-buffer/delta-buffer-for-value.class.js"
import type { IValueContainer } from "../../_common/value-container.interface.js"

/** Maps string keys to reactive dependencies — either `$Set<T>` or `$Value<T>`. */
export type TDependenciesMap = Record<string, $Set<unknown> | $Value<unknown>>

/**
 * Resolves a single reactive dependency to its runtime value representation:
 *
 * - `$Set<T>` becomes `Set<T> | null`
 * - `$Value<T>` becomes `IValueContainer<T> | null`
 *
 * Used as a building block for `TResolvedContext`.
 */
export type TResolved<T extends $Set<unknown> | $Value<unknown>> =
    T extends $Set<infer U> ? Set<U> | null
    : T extends $Value<infer V> ? IValueContainer<V> | null
    : never

/**
 * Maps dependency names to their resolved values:
 * - `$Set<T>` becomes `Set<T> | null`
 * - `$Value<T>` becomes `IValueContainer<T> | null`
 */
export type TResolvedContext<TDependencies extends TDependenciesMap> = {
    [name in keyof TDependencies]: TResolved<TDependencies[name]>
}

/**
 * Maps dependency names to resolver functions.
 *
 * For each declared dependency, a corresponding resolver must be provided.
 * This resolver defines how changes in that dependency affect the derived result set.
 *
 * - `$Set<T>` dependencies receive an `ISetChanges<T>` and return a set-level delta.
 * - `$Value<T>` dependencies receive an `IValueChange<T>` and return a set-level delta.
 *
 * @template TDeps The declared dependency map (`$Set` / `$Value`).
 * @template TResult The type of values in the resulting reactive set.
 *
 * @remarks
 * In the case of `$Set` dependencies, values in the source set are often treated as **projection keys** —
 * not direct members of the result set. The resolver may expand these keys into actual result values.
 *
 * For example:
 * - A tag ID in a filter set might expand into many entities to exclude.
 * - A parent ID might map to all child nodes in a tree structure.
 */
export type TDependencyResolversMap<TDeps extends TDependenciesMap, TResult> = {
    [key in keyof TDeps]: TDeps[key] extends $Set<infer TSourceValue> ? TDependencySetResolver<TResolvedContext<TDeps>, TSourceValue, TResult>
    : TDeps[key] extends $Value<infer TSourceValue> ? TDependencyValueResolver<TResolvedContext<TDeps>, TSourceValue, TResult>
    : never
}

/**
 * Configuration for `$SetFromAny<TResult, TDependencies>`.
 *
 * Describes the reactive input sources and how each of them should affect the resulting set.
 * Every entry in `dependencies` is paired with a corresponding function in `resolvers`
 * that determines how changes from that source propagate.
 *
 * @template TResult The type of values in the resulting reactive set.
 * @template TDependencies A record of named `$Set<T>` or `$Value<T>` inputs.
 */
export interface ISetFromAnyOptions<TResult, TDependencies extends TDependenciesMap> extends ICombinationOptions {
    /**
     * Named reactive dependencies: either `$Set<T>` or `$Value<T>`.
     *
     * Each key defines a named input, and the name will be used as:
     * - the key in the reactive context passed to all resolver functions;
     * - the identifier for matching the corresponding resolver in `resolvers`;
     * - a semantic reference in debugging or tracing.
     *
     * 💡 Use clear, meaningful names such as `source`, `filter`, `mode`, `superset`, `relation`.
     */
    dependencies: TDependencies

    /**
     * Resolver functions for handling incoming changes from each dependency.
     *
     * Each key must exactly match the corresponding name in `dependencies`.
     * The result of each resolver will be applied to the target set.
     *
     * - For `$Set<T>` sources, use `TDependencySetResolver`
     * - For `$Value<T>` sources, use `TDependencyValueResolver`
     *
     * @remarks
     * In the case of `$Set` dependencies, each item may be treated as a **projection key**,
     * not a literal result value. The resolver can expand each key into zero or more
     * elements that affect the derived set.
     *
     * This allows powerful correlation logic such as:
     * - mapping tag IDs to excluded objects;
     * - resolving user roles into granted features;
     * - expanding relation keys into a graph of affected entities.
     */
    resolvers: TDependencyResolversMap<TDependencies, TResult>
}

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
export class $SetFromAny<TResult, TDependencies extends TDependenciesMap> extends $Combination<TResult> {
    /**
     * Internal buffer objects that accumulate and commit changes
     * from each reactive dependency.
     */
    protected readonly buffers = new Set<DeltaBufferForSet | DeltaBufferForValue>()

    constructor(options: ISetFromAnyOptions<TResult, TDependencies>) {
        super(options)

        for (const name in options.dependencies) {
            const source = options.dependencies[name]

            if (source instanceof $Set) {
                /// @ts-expect-error: type erasure due to structural resolution
                const resolver: TDependencySetResolver = options.resolvers[name]

                this.buffers.add(new DeltaBufferForSet(name, source, resolver, false))
            } else if (source instanceof $Value) {
                /// @ts-expect-error: type erasure due to structural resolution
                const resolver: TDependencyValueResolver = options.resolvers[name]

                this.buffers.add(new DeltaBufferForValue(name, source, resolver, false))
            } else throw new TypeError(`Unexpected dependency type for "${name}".`)
        }

        if (this.enabled) this.attachBuffers()
    }

    // ################# CASCADED REACTIVITY ####################

    /** Returns the list of parent sources that are reactive combinations and currently disabled. */
    protected get inactiveParents() {
        return [...this.buffers].map((buffer) => buffer.source).filter((source) => source instanceof $Combination && !source.enabled)
    }

    /**
     * Returns true if all parent combinations are currently active.
     * If any parent is disabled, this node is considered blocked.
     */
    protected get allParentsAreActive() {
        return this.inactiveParents.length === 0
    }

    /**
     * Whether this combination is currently reactive and eligible for updates.
     *
     * A node is considered enabled only if:
     * - it is locally enabled;
     * - all its parent combinations are enabled (transitive cascade).
     */
    public get enabled() {
        return this.isLocallyEnabled && this.allParentsAreActive
    }

    /**
     * Enables the current node locally.
     * Will trigger full activation only if all parent combinations are active.
     */
    protected activate() {
        this.isLocallyEnabled = true
        if (this.allParentsAreActive) this.onActivated()
    }

    /**
     * Disables the current node locally.
     * Will trigger full deactivation only if all parent combinations are still active.
     */
    protected deactivate() {
        this.isLocallyEnabled = false
        if (this.allParentsAreActive) this.onDeactivated()
    }

    // ################# LIFECYCLE AND SUBSCRIPTION #################

    /**
     * Internal controller used to cancel the currently running `synchronize()` operation.
     * Ensures that overlapping sync passes do not interfere with each other.
     */
    #syncController?: AbortController

    /**
     * Stores per-buffer subscription controllers.
     * Used to unsubscribe cleanly during deactivation.
     */
    protected readonly changeSubscriptions = new Map<DeltaBufferForSet | DeltaBufferForValue, AbortController>()

    /**
     * Called when this node becomes fully active (locally and via parent cascade).
     * Enables all buffers, subscribes to their `.onChange`, and starts syncing.
     */
    protected onActivated(): void {
        super.onActivated()
        this.attachBuffers()
    }

    /**
     * Called when this node is deactivated.
     * Unsubscribes from all buffer change signals and cancels pending sync work.
     */
    protected onDeactivated(): void {
        super.onDeactivated()
        this.detachBuffers()
        this.#syncController?.abort()
    }

    /**
     * Enables all delta buffers and subscribes to their `.onChange` signals.
     * Triggers an initial `synchronize()` pass to resolve buffered state.
     */
    protected attachBuffers() {
        for (const buffer of this.buffers) buffer.enable()
        for (const buffer of this.buffers) this.listenToBuffer(buffer)
        this.synchronize()
    }

    /**
     * Unsubscribes from all buffer signals and disables tracking.
     * Called during full deactivation of this node.
     */
    protected detachBuffers() {
        for (const buffer of this.buffers) {
            this.changeSubscriptions.get(buffer)?.abort()
            buffer.disable()
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
    protected listenToBuffer(buffer: DeltaBufferForSet | DeltaBufferForValue): void {
        const controller = new AbortController()

        this.changeSubscriptions.set(buffer, controller)

        if (buffer instanceof DeltaBufferForSet)
            buffer.onChange.addSignalListener(() => buffer.getBufferedChanges() && this.synchronize(), { signal: controller.signal })

        if (buffer instanceof DeltaBufferForValue)
            buffer.onChange.addSignalListener(() => buffer.getBufferedChange() && this.synchronize(), { signal: controller.signal })
    }

    /** Whether a sync worker is currently running. */
    #isWorkerRunned = false

    /**
     * Prevents overlapping sync operations by running only one worker at a time.
     * If a sync is already running, this call is skipped.
     *
     * @param doWork A function that receives an `AbortSignal` and performs the sync logic.
     */
    protected async runWorker(doWork: (signal: AbortSignal) => Promise<void>) {
        if (this.#isWorkerRunned) return

        this.#isWorkerRunned = true
        const controller = (this.#syncController = new AbortController())

        try {
            await doWork(controller.signal)
        } catch (error) {
            console.error(error)

            this.disable()
            console.warn("The derived set was disabled because an error occurred while resolving its dependencies.")
        }

        this.#isWorkerRunned = false
        this.#syncController = undefined
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
    protected async synchronize() {
        this.runWorker(async (signal: AbortSignal) => {
            let desyncDetected = false

            do {
                desyncDetected = false

                for (const buffer of this.buffers) {
                    if (buffer instanceof DeltaBufferForSet) {
                        // Try to consume buffered delta from this buffer
                        const bufferedDelta = buffer.getBufferedChanges()
                        if (!bufferedDelta) continue

                        // Mark this buffer as committed before awaiting resolver
                        buffer.commitChanges()

                        // Compute the downstream effect of this delta
                        const resolvedDelta = await buffer.resolver(this.contextSnapshot(), bufferedDelta)
                        // A delta was consumed — we must re-check all buffers from the start
                        desyncDetected = true

                        // If this sync pass was aborted (e.g., due to disable), stop immediately
                        if (signal.aborted) return

                        // Apply changes to the target set
                        this.applyChanges(resolvedDelta)

                        break
                    } else if (buffer instanceof DeltaBufferForValue) {
                        // Try to consume buffered delta from this buffer
                        const bufferedDelta = buffer.getBufferedChange()
                        if (!bufferedDelta) continue

                        // Mark this buffer as committed before awaiting resolver
                        buffer.commitState()

                        // Compute the downstream effect of this delta
                        const resolvedDelta = await buffer.resolver(this.contextSnapshot(), bufferedDelta)
                        // A delta was consumed — we must re-check all buffers from the start
                        desyncDetected = true

                        // If this sync pass was aborted (e.g., due to disable), stop immediately
                        if (signal.aborted) return

                        // Apply changes to the target set
                        this.applyChanges(resolvedDelta)

                        break
                    }
                }
            } while (desyncDetected)
        })
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
    protected contextSnapshot(): Record<string, Set<any> | IValueContainer<any> | null> {
        const committedStates: Record<string, Set<any> | IValueContainer<any> | null> = {}

        for (const buffer of this.buffers) committedStates[buffer.name] = buffer.getCommittedState()

        return committedStates
    }
}
