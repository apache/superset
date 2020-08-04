export function toArray(obj) {
    var ret = [];
    for (var attr in obj) {
        ret[attr] = obj;
    }

    return ret;
}

