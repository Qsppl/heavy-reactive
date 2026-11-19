import type { MaybePromise } from "#typescript/maybe-promise.type.js"
import type { ISetChanges, TInputSetChanges } from "../../../_common/set-changes.interface.js"

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
export type TDependencySetResolver<TContext extends Record<string, any> = Record<string, any>, TSource = any, TResult = any> = (
    context: TContext,
    changes: ISetChanges<TSource>,
) => MaybePromise<TInputSetChanges<TResult>>
