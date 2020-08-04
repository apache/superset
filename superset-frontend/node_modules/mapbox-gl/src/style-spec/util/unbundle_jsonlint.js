
// Turn jsonlint-lines-primitives objects into primitive objects
export function unbundle(value) {
    if (value instanceof Number || value instanceof String || value instanceof Boolean) {
        return value.valueOf();
    } else {
        return value;
    }
}

export function deepUnbundle(value) {
    if (Array.isArray(value)) {
        return value.map(deepUnbundle);
    }
    return unbundle(value);
}

