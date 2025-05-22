export function union<TValue>(set: Set<TValue>, other: Set<NoInfer<TValue>>): Set<TValue> {
    /// @ts-expect-error The method was recently added, so it does not appear as available yet
    if ("union" in Set.prototype) return set.union(other)

    const result = new Set<TValue>()

    for (const value of set) result.add(value)

    for (const value of other) result.add(value)

    return result
}
