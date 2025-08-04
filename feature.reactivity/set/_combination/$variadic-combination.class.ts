import { $Set } from "../$set.class.js"
import { ISetChanges } from "../../_common/set-changes.interface.js"
import { $Combination } from "./$combination.class.js"

/**
 * Configuration options for constructing a `$VariadicCombination<T>`.
 *
 * @template TValue The type of values managed by the combination.
 */
export interface IVariadicCombinationOptions<TValue> {
    /**
     * The initial list of reactive subsets to include in the combination.
     */
    subsets: Array<$Set<TValue>>

    /**
     * Optional debug label used for introspection or error messages.
     */
    label?: string

    /**
     * Whether this combination is initially reactive.
     * Defaults to `true` if omitted.
     */
    enabled?: boolean
}

/**
 * Abstract base class for reactive set combinations that depend on a variable number of input sets.
 *
 * `$VariadicCombination<T>` manages a collection of reactive input sets (`$Set<T>`) and provides:
 * - lifecycle control (`mount`, `unmount`) for dynamically added/removed subsets;
 * - automatic subscription management via `AbortController`;
 * - a shared occurrence map (`Map<T, number>`) to track presence and frequency of values across subsets;
 * - reactive update propagation through `applyChanges()`;
 * - support for cascade disabling via a parent node (`$Combination`) if applicable.
 *
 * This class is not meant to be instantiated directly. It provides shared logic for concrete
 * reactive set derivations like:
 *
 * - `$Intersection<T>` — values common to all subsets
 * - `$Union<T>` — values present in at least one subset
 * - `$Difference<T>` — values in a base set not present in any excluded subsets
 *
 * Subclasses must implement:
 * - `recalculateOnSubsetChange(changes: ISetChanges<T>): void` — logic for updating the result
 *   when a single input subset changes.
 *
 * @template TValue The type of values contained in the sets.
 *
 * @remarks
 * This class extends `$Set<T>` and is **readonly** — all mutation methods throw.
 * Use the `.subsets` array to control inputs, and `.applyChanges()` to emit result updates.
 */
export abstract class $VariadicCombination<TValue> extends $Combination<TValue> {
    /**
     * Tracks all subsets that are *registered* with this combination,
     * regardless of whether they are currently active/reactive.
     *
     * - These sets are known to the combination and may be conditionally mounted.
     * - Used for structural bookkeeping and cleanup.
     *
     * Subsets may be *attached* but not *included* if, for example, they are temporarily disabled.
     */
    protected readonly allSubsets = new Set<$Set<TValue>>()

    /**
     * Subsets that are actively contributing to the combination result.
     *
     * - This is a subset of `attachedSubsets`.
     * - Subsets are added here only if they are currently reactive/enabled.
     * - The size of this set is often used as a threshold for inclusion in intersection logic.
     */
    protected readonly includedSubsets = new Set<$Set<TValue>>()

    /**
     * Tracks how many included subsets contain each value.
     *
     * The key is a value of type `TValue`.
     * The value is the number of currently included subsets that contain it.
     *
     * Interpretation of this map depends on subclass:
     * - In `$Intersection`, a value is included if its count equals `includedSubsets.size`.
     * - In `$Union`, a value is included if its count is at least `1`.
     * - In `$Difference`, a similar map is used for exclusion tracking.
     */
    protected readonly valueOccurrences = new Map<TValue, number>()

    /**
     * Tracks subscriptions to `onChange` signals from all subsets.
     *
     * Each subset is associated with an `AbortController`, which can be used
     * to cancel the signal listener when the subset is unmounted.
     */
    protected readonly subsetChangeControllers = new Map<$Set<TValue>, AbortController>()

    /**
     * Tracks subscriptions to `onSwitch` signals from parent combinations (if any).
     *
     * This enables nested combinations to respond to reactivity state changes
     * in parent nodes and maintain cascade consistency.
     */
    protected readonly cascadeControllers = new Map<$Combination<TValue>, AbortController>()

    /**
     * Creates a new variadic combination from a list of subsets.
     *
     * This constructor is used by all derived reactive set combinators,
     * such as `$Intersection`, `$Union`, and `$Difference`.
     *
     * @param options Configuration object:
     * - `subsets`: the initial reactive sets to combine;
     * - `label`: optional debug label;
     * - `enabled`: whether the combination starts active.
     */
    constructor(options: IVariadicCombinationOptions<TValue>) {
        super({ label: options.label, enabled: options.enabled })
        for (const subset of options.subsets) this.#registerSubset(subset)
    }

    /**
     * Registers a new input subset for participation in this combination.
     *
     * - Ensures the subset is not already registered.
     * - If the subset is another combination, tracks its reactivity.
     * - Activates the subset immediately if appropriate.
     *
     * @throws If the same subset is registered more than once.
     */
    #registerSubset(subset: $Set<TValue>) {
        if (this.allSubsets.has(subset)) throw new Error("Subset is already registered. Perhaps you intended to register multiple events instead?")

        this.allSubsets.add(subset)

        if (subset instanceof $Combination) {
            this.trackSubsetSwitchState(subset)
            if (subset.enabled) this.includeSubsetInCalc(subset)
        } else this.includeSubsetInCalc(subset)
    }

    /**
     * Subscribes to the `onSwitch` signal of a subset that is itself a combination.
     *
     * This enables the parent to respond when the subset is enabled or disabled,
     * and update the result calculation accordingly.
     */
    protected trackSubsetSwitchState(subset: $Combination<TValue>) {
        const controller = new AbortController()
        this.cascadeControllers.set(subset, controller)
        subset.onSwitch.subscribe(() => (subset.enabled ? this.includeSubsetInCalc(subset) : this.excludeSubsetFromCalc(subset)))
    }

    /**
     * Includes a subset in the combination’s internal calculations.
     *
     * - Adds the subset to `includedSubsets`.
     * - Mounts the subset immediately if this combination is currently enabled.
     */
    protected includeSubsetInCalc(subset: $Set<TValue>) {
        this.includedSubsets.add(subset)
        if (this.enabled) this.mountSubset(subset)
    }

    /**
     * Excludes a subset from the combination’s internal calculations.
     *
     * - Removes the subset from `includedSubsets`.
     * - Unmounts the subset if this combination is currently enabled.
     */
    protected excludeSubsetFromCalc(subset: $Set<TValue>) {
        this.includedSubsets.delete(subset)
        if (this.enabled) this.unmountSubset(subset)
    }

    /**
     * Lifecycle hook called when this combination becomes reactive.
     *
     * All currently included subsets are mounted and begin contributing to the result.
     */
    protected onActivated(): void {
        super.onActivated()
        for (const subset of this.includedSubsets) this.mountSubset(subset)
    }

    /**
     * Lifecycle hook called when this combination is disabled.
     *
     * All currently included subsets are unmounted and removed from the result.
     */
    protected onDeactivated(): void {
        super.onDeactivated()
        for (const subset of this.includedSubsets) this.unmountSubset(subset)
    }

    /**
     * Mounts a subset: processes its current state and subscribes to future changes.
     *
     * - Its current content is processed via `recalculateOnSubsetChange`.
     * - A signal listener is attached to respond to future updates.
     */
    protected mountSubset(subset: $Set<TValue>) {
        this.recalculateOnSubsetChange({ increment: subset, decrement: undefined })
        this.listenSubsetChanges(subset)
    }

    /**
     * Unmounts a subset: stops listening to its changes and removes its contribution.
     *
     * - The subset is unsubscribed using its `AbortController`.
     * - Its contribution is removed from the result via `recalculateOnSubsetChange`.
     */
    protected unmountSubset(subset: $Set<TValue>) {
        this.subsetChangeControllers.get(subset)?.abort()
        if (this.enabled) this.recalculateOnSubsetChange({ increment: undefined, decrement: subset })
    }

    /**
     * Subscribes to the `onChange` signal of a subset.
     *
     * Any changes in the subset will be forwarded to `recalculateOnSubsetChange(...)`.
     */
    protected listenSubsetChanges(subset: $Set<TValue>) {
        const controller = new AbortController()
        this.subsetChangeControllers.set(subset, controller)
        subset.onChange.subscribe((changes) => this.recalculateOnSubsetChange(changes), { signal: controller.signal })
    }

    /**
     * Must be implemented by subclasses to define how changes in a single subset
     * should affect the resulting combination.
     *
     * @param changes A change payload emitted by one of the subsets.
     */
    protected abstract recalculateOnSubsetChange(changes: ISetChanges<TValue>): void
}
