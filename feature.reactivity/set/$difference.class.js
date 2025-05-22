import { $VariadicCombination } from "./_combination/$variadic-combination.class.js";
import { $Combination } from "./_combination/$combination.class.js";
/**
 * Reactive set representing the difference between a base set and one or more excluded sets.
 *
 * `$Difference<T>` continuously computes the set of items that exist in the **base** set
 * but are **not present** in any of the **excluded** sets.
 *
 * This class extends `$VariadicCombination<T>` and is fully reactive:
 * any change to the base or excluded sets automatically updates the result.
 *
 * The resulting set is:
 * - **readonly** – direct mutations will throw a `ReadonlyAccessError`;
 * - **reactive** – emits `onChange` when the computed difference changes;
 * - **derived** – entirely driven by its input sets.
 *
 * @template TValue The type of elements in the sets.
 *
 * @example
 * ```ts
 * const $base = $set(['a', 'b', 'c', 'd'])
 * const $excluded = $set(['b', 'd'])
 *
 * const $visible = new $Difference($base, [$excluded])
 *
 * console.log([...$visible]) // ['a', 'c']
 *
 * $excluded.delete('b')
 * console.log([...$visible]) // ['a', 'c', 'b']
 * ```
 */
export class $Difference extends $VariadicCombination {
    /**
     * The base set from which all excluded values are subtracted.
     *
     * This set defines the upper bound of possible values in the result.
     * Items are only present in the result if they are in this set
     * and are not present in any of the excluded subsets.
     *
     * Assigned during construction and never reassigned.
     */
    superset;
    /**
     * Creates a new reactive difference set.
     *
     * @param options Configuration object:
     * - `superset`: the base set to subtract from;
     * - `subsets`: one or more sets to subtract (excluded sets);
     * - `label`: optional debug label;
     * - `enabled`: whether the result is initially reactive.
     *
     * @remarks
     * - Emits a warning if `superset` is also listed in `subsets` — this is logically meaningless.
     * - Automatically mounts the `superset` if reactivity is enabled.
     * - If the superset is also a derived set (e.g. another `$Combination`), sets up parent switching logic.
     */
    constructor(options) {
        if (options.subsets.includes(options.superset))
            console.warn("The subtraction of the superminity from itself does not make sense - it requires optimization.");
        super(options);
        this.superset = options.superset;
        if (this.enabled)
            this.mountSuperset();
        if (options.superset instanceof $Combination)
            this.watchParentReactivity(options.superset);
    }
    // ################# PARENT REACTIVE NODE ####################
    /**
     * Returns whether the parent node (i.e. the superset) is currently reactive.
     *
     * If the `superset` is itself a combination (i.e. a derived structure),
     * its `.enabled` state is used. Otherwise, it is assumed to be always enabled.
     */
    get isParentEnabled() {
        if (this.superset instanceof $Combination)
            return this.superset.enabled;
        return true;
    }
    /**
     * Returns whether this node is currently reactive.
     *
     * The node is considered enabled only if both:
     * - this node itself is marked as enabled (`isLocallyEnabled`);
     * - its parent (if any) is also enabled (`isParentEnabled`).
     */
    get enabled() {
        return this.isLocallyEnabled && this.isParentEnabled;
    }
    /**
     * Marks this node as enabled, and activates it only if the parent is also enabled.
     *
     * Triggers `onActivated()` if the node becomes active.
     */
    activate() {
        this.isLocallyEnabled = true;
        if (this.isParentEnabled)
            this.onActivated();
    }
    /**
     * Marks this node as disabled, and deactivates it only if the parent is still enabled.
     *
     * Triggers `onDeactivated()` if the node was previously active.
     */
    deactivate() {
        this.isLocallyEnabled = false;
        if (this.isParentEnabled)
            this.onDeactivated();
    }
    /**
     * Subscribes to reactivity state changes of the parent (superset).
     *
     * This allows `$Difference` to mirror the enabled/disabled state of the parent node.
     *
     * @param parent The superset to track for reactivity changes.
     */
    watchParentReactivity(parent) {
        parent.onSwitch.addSignalListener(() => {
            if (this.isLocallyEnabled && parent.enabled)
                this.onActivated();
            if (this.isLocallyEnabled && !parent.enabled)
                this.onDeactivated();
        });
    }
    // ################# SUPERSET ####################
    /**
     * Lifecycle hook triggered when this difference becomes fully enabled.
     *
     * - Calls the parent implementation.
     * - Mounts the superset, so its values are included in the result.
     */
    onActivated() {
        super.onActivated();
        this.mountSuperset();
    }
    /**
     * Lifecycle hook triggered when this difference becomes disabled.
     *
     * - Calls the parent implementation.
     * - Unsubscribes from the superset and stops tracking its changes.
     */
    onDeactivated() {
        super.onDeactivated();
        this.unmountSuperset();
    }
    /**
     * Initializes tracking of the superset:
     * - Applies its current content as the initial `increment`;
     * - Starts listening to future changes.
     */
    mountSuperset() {
        this.handleChangesOfSuperset({ increment: this.superset, decrement: undefined });
        this.listenSupersetChanges();
    }
    /**
     * Stops listening to changes from the superset.
     *
     * Aborts the corresponding subscription signal, if present.
     */
    unmountSuperset() {
        this.subsetChangeControllers.get(this.superset)?.abort();
    }
    /**
     * Subscribes to the superset's `onChange` signal.
     *
     * All future changes will be handled by `handleChangesOfSuperset`.
     * The subscription is abortable and tracked in `changeSubscriptions`.
     */
    listenSupersetChanges() {
        const controller = new AbortController();
        this.subsetChangeControllers.set(this.superset, controller);
        this.superset.onChange.addSignalListener((changes) => this.handleChangesOfSuperset(changes), { signal: controller.signal });
    }
    /**
     * Processes changes coming from the superset.
     *
     * - Removes all `decrement` values from `occurrences`;
     * - Adds `increment` values that are not currently excluded.
     *
     * Only items not already excluded will be added to the result.
     *
     * @param param0 The changes to apply from the superset.
     */
    handleChangesOfSuperset({ increment = new Set(), decrement }) {
        for (const item of decrement ?? [])
            this.valueOccurrences.delete(item);
        const nonOccuredIncrementItems = [...increment].filter((item) => !this.valueOccurrences.get(item));
        this.applyChanges({ decrement, increment: new Set(nonOccuredIncrementItems) });
    }
    // #################
    /**
     * Recalculates the result when an excluded subset changes.
     *
     * - When a value is added to an excluded set and it's the first time it's excluded,
     *   it is removed from the result (`decrement`).
     * - When a value is removed from an excluded set and it is no longer excluded by any subset,
     *   it is restored to the result (`increment`).
     *
     * @param param0 Changes from one of the excluded subsets.
     */
    recalculateOnSubsetChange({ increment: addedToExcludedSet, decrement: removedFromExcludedSet }) {
        const addedBackToResult = new Set();
        const removedFromResult = new Set();
        for (const item of addedToExcludedSet ?? []) {
            const prevCount = this.valueOccurrences.get(item) ?? 0;
            const nextCount = prevCount + 1;
            this.valueOccurrences.set(item, nextCount);
            if (nextCount === 1)
                removedFromResult.add(item);
        }
        for (const item of removedFromExcludedSet ?? []) {
            const prevCount = this.valueOccurrences.get(item);
            if (!prevCount)
                continue;
            const nextCount = prevCount - 1;
            if (nextCount === 0) {
                this.valueOccurrences.delete(item);
                addedBackToResult.add(item);
            }
            else {
                this.valueOccurrences.set(item, nextCount);
            }
        }
        this.applyChanges({ increment: addedBackToResult, decrement: removedFromResult });
    }
}
