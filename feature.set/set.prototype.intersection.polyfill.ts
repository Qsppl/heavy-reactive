export function intersection<TValue>(set: Set<TValue>, other: Set<TValue>): Set<TValue> {
    if ("intersection" in Set.prototype) return set.intersection(other)
    const result = new Set<TValue>()
    for (const value of other) if (set.has(value)) result.add(value)
    return result
}
