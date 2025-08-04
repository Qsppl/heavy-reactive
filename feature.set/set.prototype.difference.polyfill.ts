export function difference<TValue>(set: Set<TValue>, other: Set<NoInfer<TValue>>): Set<TValue> {
    if ("difference" in Set.prototype) return set.difference(other)

    const result = new Set<TValue>()
    for (const value of set) if (!other.has(value)) result.add(value)
    return result
}
