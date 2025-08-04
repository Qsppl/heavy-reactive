import { MaybePromise } from "#typescript/maybe-promise.type.js"
import { TInputSetChanges } from "../../../_common/set-changes.interface.js"
import { IValueChange } from "../../../_common/value-change.interface.js"

/**
 * A resolver function used to convert changes from a `$Set` dependency
 * into a delta that should be applied to the result set.
 *
 * @template TContext The resolved values of all dependencies.
 * @template TSource The type of values in the dependency source.
 * @template TResult The type of values in the resulting set.
 *
 * @remarks
 * The resolver may use each `TSource` value as a *projective key* — not just a value to test.
 * This allows transformation, correlation, or expansion into multiple result values.
 */
export type TDependencyValueResolver<TContext extends Record<string, any> = Record<string, any>, TSource = any, TResult = any> = (
    context: TContext,
    changes: IValueChange<TSource>,
) => MaybePromise<TInputSetChanges<TResult>>
