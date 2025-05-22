export function intersection(set, other) {
    /// @ts-expect-error The method was recently added, so it does not appear as available yet
    if ("intersection" in Set.prototype)
        return set.intersection(other);
    const result = new Set();
    for (const value of other)
        if (set.has(value))
            result.add(value);
    return result;
}
