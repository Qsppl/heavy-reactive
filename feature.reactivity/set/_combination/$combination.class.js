import { $Set } from "../$set.class.js";
import { Signal } from "/feature.javascript/feature.signals/signal.class.js";
/**
 * Base class for reactive set combinators that participate in derived calculations.
 *
 * `$Combination<T>` extends `$Set<T>` and introduces lifecycle control for derived sets.
 * It provides a minimal reactive core for managing:
 *
 * - reactivity state (`enabled`, `onSwitch`);
 * - cascade enable/disable logic;
 * - activation/deactivation lifecycle hooks (`onActivated`, `onDeactivated`);
 * - soft reactivity toggling through public `.enable()` / `.disable()` / `.switch(state?)` methods.
 *
 * This class is not designed to be used directly — instead, it serves as a foundation for:
 * - `$VariadicCombination<T>` — which adds dynamic subset management;
 * - higher-level operators like `$Intersection`, `$Union`, `$Difference`.
 *
 * @template TValue The type of values held in the set.
 *
 * @remarks
 * All `$Combination` instances are immutable from the outside —
 * all mutation methods throw `ReadonlyAccessError`.
 *
 * Use `.enabled` to determine whether the combination is reactive at the moment.
 * Use `.onSwitch` to listen for reactivity state changes.
 */
export class $Combination extends $Set {
    /**
     * Signal emitted when the combination is enabled or disabled.
     *
     * Can be used by parent or dependent structures to track reactivity status.
     *
     * @example
     * ```ts
     * $combination.onSwitch.addSignalListener(() => {
     *   if ($combination.enabled) console.log("Activated")
     *   else console.log("Deactivated")
     * })
     * ```
     */
    onSwitch = new Signal();
    /**
     * Initializes a new combination instance with optional configuration.
     *
     * This base constructor is used by all derived reactive combinators,
     * such as `$Intersection`, `$Union`, and `$Difference`.
     *
     * @param options Configuration object:
     * - `label` — optional debug label;
     * - `enabled` — whether the combination is active initially (defaults to `true`).
     */
    constructor(options) {
        super(options);
        this.#isLocallyEnabled = options.enabled ?? true;
    }
    /**
     * Tracks local reactivity state of the combination.
     *
     * Used to gate activation logic without involving external cascade state.
     */
    #isLocallyEnabled;
    /**
     * Returns whether this combination is currently reactive.
     *
     * This value reflects local activation only — subclasses may override the
     * `enabled` getter to include cascade logic.
     */
    get enabled() {
        return this.isLocallyEnabled;
    }
    /**
     * Enables the combination if it is currently disabled.
     *
     * Triggers the internal lifecycle activation hook and emits `onSwitch`.
     */
    enable() {
        if (this.isLocallyEnabled)
            return;
        this.activate();
    }
    /**
     * Disables the combination if it is currently enabled.
     *
     * Triggers the internal lifecycle deactivation hook and emits `onSwitch`.
     */
    disable() {
        if (!this.isLocallyEnabled)
            return;
        this.deactivate();
    }
    /**
     * Internal flag getter.
     *
     * @internal
     */
    get isLocallyEnabled() {
        return this.#isLocallyEnabled;
    }
    /**
     * Internal flag setter.
     *
     * @internal
     */
    set isLocallyEnabled(value) {
        this.#isLocallyEnabled = value;
    }
    /**
     * Internal method to transition into the active (reactive) state.
     *
     * This method:
     * - updates local state;
     * - calls `onActivated()` lifecycle hook.
     */
    activate() {
        this.isLocallyEnabled = true;
        this.onActivated();
    }
    /**
     * Lifecycle hook triggered when the combination becomes active.
     *
     * Subclasses may override this to start listening to inputs or initialize state.
     * This method emits the `onSwitch` signal.
     */
    onActivated() {
        this.onSwitch.dispatchSignal();
    }
    /**
     * Internal method to transition into the inactive (non-reactive) state.
     *
     * This method:
     * - updates local state;
     * - calls `onDeactivated()` lifecycle hook.
     */
    deactivate() {
        this.isLocallyEnabled = false;
        this.onDeactivated();
    }
    /**
     * Lifecycle hook triggered when the combination is disabled.
     *
     * This implementation:
     * - emits the `onSwitch` signal;
     * - clears current content;
     * - cancels pending transactions.
     *
     * Subclasses may override to clean up derived state or signal listeners.
     */
    onDeactivated() {
        this.onSwitch.dispatchSignal();
        this.cancelTransaction();
        this.clear();
    }
}
