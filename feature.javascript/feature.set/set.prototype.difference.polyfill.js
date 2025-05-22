export function difference(set, other) {
    /// @ts-expect-error The method was recently added, so it does not appear as available yet
    if ("difference" in Set.prototype)
        return set.difference(other);
    const result = new Set();
    for (const value of set)
        if (!other.has(value))
            result.add(value);
    return result;
}
