"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function composeRefs() {
    var refs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        refs[_i] = arguments[_i];
    }
    if (refs.length === 2) { // micro-optimize the hot path
        return composeTwoRefs(refs[0], refs[1]) || null;
    }
    var composedRef = refs.slice(1).reduce(function (semiCombinedRef, refToInclude) { return composeTwoRefs(semiCombinedRef, refToInclude); }, refs[0]);
    return composedRef || null;
}
exports.default = composeRefs;
var composedRefCache = new WeakMap();
function composeTwoRefs(ref1, ref2) {
    if (ref1 && ref2) {
        var ref1Cache = composedRefCache.get(ref1) || new WeakMap();
        composedRefCache.set(ref1, ref1Cache);
        var composedRef = ref1Cache.get(ref2) || (function (instance) {
            updateRef(ref1, instance);
            updateRef(ref2, instance);
        });
        ref1Cache.set(ref2, composedRef);
        return composedRef;
    }
    if (!ref1) {
        return ref2;
    }
    else {
        return ref1;
    }
}
function updateRef(ref, instance) {
    if (typeof ref === 'function') {
        ref(instance);
    }
    else {
        ref.current = instance;
    }
}
//# sourceMappingURL=composeRefs.js.map