import _ = require("../index");
// tslint:disable-next-line:strict-export-declare-modifiers
type GlobalPartial<T> = Partial<T>;
declare module "../index" {
    type PartialObject<T> = GlobalPartial<T>;
    type Many<T> = T | ReadonlyArray<T>;
    interface LoDashStatic {
        /**
        * Creates a lodash object which wraps value to enable implicit method chain sequences.
        * Methods that operate on and return arrays, collections, and functions can be chained together.
        * Methods that retrieve a single value or may return a primitive value will automatically end the
        * chain sequence and return the unwrapped value. Otherwise, the value must be unwrapped with value().
        *
        * Explicit chain sequences, which must be unwrapped with value(), may be enabled using _.chain.
        *
        * The execution of chained methods is lazy, that is, it's deferred until value() is
        * implicitly or explicitly called.
        *
        * Lazy evaluation allows several methods to support shortcut fusion. Shortcut fusion
        * is an optimization to merge iteratee calls; this avoids the creation of intermediate
        * arrays and can greatly reduce the number of iteratee executions. Sections of a chain
        * sequence qualify for shortcut fusion if the section is applied to an array and iteratees
        * accept only one argument. The heuristic for whether a section qualifies for shortcut
        * fusion is subject to change.
        *
        * Chaining is supported in custom builds as long as the value() method is directly or
        * indirectly included in the build.
        *
        * In addition to lodash methods, wrappers have Array and String methods.
        * The wrapper Array methods are:
        * concat, join, pop, push, shift, sort, splice, and unshift.
        * The wrapper String methods are:
        * replace and split.
        *
        * The wrapper methods that support shortcut fusion are:
        * at, compact, drop, dropRight, dropWhile, filter, find, findLast, head, initial, last,
        * map, reject, reverse, slice, tail, take, takeRight, takeRightWhile, takeWhile, and toArray
        *
        * The chainable wrapper methods are:
        * after, ary, assign, assignIn, assignInWith, assignWith, at, before, bind, bindAll, bindKey,
        * castArray, chain, chunk, commit, compact, concat, conforms, constant, countBy, create,
        * curry, debounce, defaults, defaultsDeep, defer, delay, difference, differenceBy, differenceWith,
        * drop, dropRight, dropRightWhile, dropWhile, extend, extendWith, fill, filter, flatMap,
        * flatMapDeep, flatMapDepth, flatten, flattenDeep, flattenDepth, flip, flow, flowRight,
        * fromPairs, functions, functionsIn, groupBy, initial, intersection, intersectionBy, intersectionWith,
        * invert, invertBy, invokeMap, iteratee, keyBy, keys, keysIn, map, mapKeys, mapValues,
        * matches, matchesProperty, memoize, merge, mergeWith, method, methodOf, mixin, negate,
        * nthArg, omit, omitBy, once, orderBy, over, overArgs, overEvery, overSome, partial, partialRight,
        * partition, pick, pickBy, plant, property, propertyOf, pull, pullAll, pullAllBy, pullAllWith, pullAt,
        * push, range, rangeRight, rearg, reject, remove, rest, reverse, sampleSize, set, setWith,
        * shuffle, slice, sort, sortBy, sortedUniq, sortedUniqBy, splice, spread, tail, take,
        * takeRight, takeRightWhile, takeWhile, tap, throttle, thru, toArray, toPairs, toPairsIn,
        * toPath, toPlainObject, transform, unary, union, unionBy, unionWith, uniq, uniqBy, uniqWith,
        * unset, unshift, unzip, unzipWith, update, updateWith, values, valuesIn, without, wrap,
        * xor, xorBy, xorWith, zip, zipObject, zipObjectDeep, and zipWith.
        *
        * The wrapper methods that are not chainable by default are:
        * add, attempt, camelCase, capitalize, ceil, clamp, clone, cloneDeep, cloneDeepWith, cloneWith,
        * conformsTo, deburr, defaultTo, divide, each, eachRight, endsWith, eq, escape, escapeRegExp,
        * every, find, findIndex, findKey, findLast, findLastIndex, findLastKey, first, floor, forEach,
        * forEachRight, forIn, forInRight, forOwn, forOwnRight, get, gt, gte, has, hasIn, head,
        * identity, includes, indexOf, inRange, invoke, isArguments, isArray, isArrayBuffer,
        * isArrayLike, isArrayLikeObject, isBoolean, isBuffer, isDate, isElement, isEmpty, isEqual, isEqualWith,
        * isError, isFinite, isFunction, isInteger, isLength, isMap, isMatch, isMatchWith, isNaN,
        * isNative, isNil, isNull, isNumber, isObject, isObjectLike, isPlainObject, isRegExp,
        * isSafeInteger, isSet, isString, isUndefined, isTypedArray, isWeakMap, isWeakSet, join,
        * kebabCase, last, lastIndexOf, lowerCase, lowerFirst, lt, lte, max, maxBy, mean, meanBy,
        * min, minBy, multiply, noConflict, noop, now, nth, pad, padEnd, padStart, parseInt, pop,
        * random, reduce, reduceRight, repeat, result, round, runInContext, sample, shift, size,
        * snakeCase, some, sortedIndex, sortedIndexBy, sortedLastIndex, sortedLastIndexBy, startCase,
        * startsWith, stubArray, stubFalse, stubObject, stubString, stubTrue, subtract, sum, sumBy,
        * template, times, toFinite, toInteger, toJSON, toLength, toLower, toNumber, toSafeInteger,
        * toString, toUpper, trim, trimEnd, trimStart, truncate, unescape, uniqueId, upperCase,
        * upperFirst, value, and words.
        **/
        <T>(value: T): LoDashImplicitWrapper<T>;

        /**
        * The semantic version number.
        **/
        VERSION: string;

        /**
        * By default, the template delimiters used by Lo-Dash are similar to those in embedded Ruby
        * (ERB). Change the following template settings to use alternative delimiters.
        **/
        templateSettings: TemplateSettings;
    }

    /**
    * By default, the template delimiters used by Lo-Dash are similar to those in embedded Ruby
    * (ERB). Change the following template settings to use alternative delimiters.
    **/
    interface TemplateSettings {
        /**
        * The "escape" delimiter.
        **/
        escape?: RegExp;

        /**
        * The "evaluate" delimiter.
        **/
        evaluate?: RegExp;

        /**
        * An object to import into the template as local variables.
        **/
        imports?: Dictionary<any>;

        /**
        * The "interpolate" delimiter.
        **/
        interpolate?: RegExp;

        /**
        * Used to reference the data object in the template text.
        **/
        variable?: string;
    }

    /**
     * Creates a cache object to store key/value pairs.
     */
    interface MapCache {
        /**
         * Removes `key` and its value from the cache.
         * @param key The key of the value to remove.
         * @return Returns `true` if the entry was removed successfully, else `false`.
         */
        delete(key: any): boolean;

        /**
         * Gets the cached value for `key`.
         * @param key The key of the value to get.
         * @return Returns the cached value.
         */
        get(key: any): any;

        /**
         * Checks if a cached value for `key` exists.
         * @param key The key of the entry to check.
         * @return Returns `true` if an entry for `key` exists, else `false`.
         */
        has(key: any): boolean;

        /**
         * Sets `value` to `key` of the cache.
         * @param key The key of the value to cache.
         * @param value The value to cache.
         * @return Returns the cache object.
         */
        set(key: any, value: any): this;

        /**
         * Removes all key-value entries from the map.
         */
        clear?: () => void;
    }
    interface MapCacheConstructor {
        new (): MapCache;
    }

    interface LoDashImplicitWrapper<TValue> extends LoDashWrapper<TValue> {
        pop<T>(this: LoDashImplicitWrapper<List<T> | null | undefined>): T | undefined;
        push<T>(this: LoDashImplicitWrapper<List<T> | null | undefined>, ...items: T[]): this;
        shift<T>(this: LoDashImplicitWrapper<List<T> | null | undefined>): T | undefined;
        sort<T>(this: LoDashImplicitWrapper<List<T> | null | undefined>, compareFn?: (a: T, b: T) => number): this;
        splice<T>(this: LoDashImplicitWrapper<List<T> | null | undefined>, start: number, deleteCount?: number, ...items: T[]): this;
        unshift<T>(this: LoDashImplicitWrapper<List<T> | null | undefined>, ...items: T[]): this;
    }

    interface LoDashExplicitWrapper<TValue> extends LoDashWrapper<TValue> {
        pop<T>(this: LoDashExplicitWrapper<List<T> | null | undefined>): LoDashExplicitWrapper<T | undefined>;
        push<T>(this: LoDashExplicitWrapper<List<T> | null | undefined>, ...items: T[]): this;
        shift<T>(this: LoDashExplicitWrapper<List<T> | null | undefined>): LoDashExplicitWrapper<T | undefined>;
        sort<T>(this: LoDashExplicitWrapper<List<T> | null | undefined>, compareFn?: (a: T, b: T) => number): this;
        splice<T>(this: LoDashExplicitWrapper<List<T> | null | undefined>, start: number, deleteCount?: number, ...items: T[]): this;
        unshift<T>(this: LoDashExplicitWrapper<List<T> | null | undefined>, ...items: T[]): this;
    }

    type NotVoid = {} | null | undefined;
    type IterateeShorthand<T> = PropertyName | [PropertyName, any] | PartialDeep<T>;
    type ArrayIterator<T, TResult> = (value: T, index: number, collection: T[]) => TResult;
    type ListIterator<T, TResult> = (value: T, index: number, collection: List<T>) => TResult;
    type ListIteratee<T> = ListIterator<T, NotVoid> | IterateeShorthand<T>;
    type ListIterateeCustom<T, TResult> = ListIterator<T, TResult> | IterateeShorthand<T>;
    type ListIteratorTypeGuard<T, S extends T> = (value: T, index: number, collection: List<T>) => value is S;

    // Note: key should be string, not keyof T, because the actual object may contain extra properties that were not specified in the type.
    type ObjectIterator<TObject, TResult> = (value: TObject[keyof TObject], key: string, collection: TObject) => TResult;
    type ObjectIteratee<TObject> = ObjectIterator<TObject, NotVoid> | IterateeShorthand<TObject[keyof TObject]>;
    type ObjectIterateeCustom<TObject, TResult> = ObjectIterator<TObject, TResult> | IterateeShorthand<TObject[keyof TObject]>;
    type ObjectIteratorTypeGuard<TObject, S extends TObject[keyof TObject]> = (value: TObject[keyof TObject], key: string, collection: TObject) => value is S;

    type StringIterator<TResult> = (char: string, index: number, string: string) => TResult;

    /** @deprecated Use MemoVoidArrayIterator or MemoVoidDictionaryIterator instead. */
    type MemoVoidIterator<T, TResult> = (prev: TResult, curr: T, indexOrKey: any, list: T[]) => void;

    /** @deprecated Use MemoListIterator or MemoObjectIterator instead. */
    type MemoIterator<T, TResult> = (prev: TResult, curr: T, indexOrKey: any, list: T[]) => TResult;
    type MemoListIterator<T, TResult, TList> = (prev: TResult, curr: T, index: number, list: TList) => TResult;
    type MemoObjectIterator<T, TResult, TList> = (prev: TResult, curr: T, key: string, list: TList) => TResult;
    type MemoIteratorCapped<T, TResult> = (prev: TResult, curr: T) => TResult;
    type MemoIteratorCappedRight<T, TResult> = (curr: T, prev: TResult) => TResult;

    type MemoVoidArrayIterator<T, TResult> = (acc: TResult, curr: T, index: number, arr: T[]) => void;
    type MemoVoidDictionaryIterator<T, TResult> = (acc: TResult, curr: T, key: string, dict: Dictionary<T>) => void;
    type MemoVoidIteratorCapped<T, TResult> = (acc: TResult, curr: T) => void;

    type ValueIteratee<T> = ((value: T) => NotVoid) | IterateeShorthand<T>;
    type ValueIterateeCustom<T, TResult> = ((value: T) => TResult) | IterateeShorthand<T>;
    type ValueIteratorTypeGuard<T, S extends T> = (value: T) => value is S;
    type ValueKeyIteratee<T> = ((value: T, key: string) => NotVoid) | IterateeShorthand<T>;
    type ValueKeyIterateeTypeGuard<T, S extends T> = (value: T, key: string) => value is S;
    type Comparator<T> = (a: T, b: T) => boolean;
    type Comparator2<T1, T2> = (a: T1, b: T2) => boolean;

    type PropertyName = string | number | symbol;
    type PropertyPath = Many<PropertyName>;

    type Omit<T, K extends keyof T> = Pick<T, ({ [P in keyof T]: P } & { [P in K]: never } & { [x: string]: never })[keyof T]>;

    /** Common interface between Arrays and jQuery objects */
    type List<T> = ArrayLike<T>;

    interface Dictionary<T> {
        [index: string]: T;
    }

    interface NumericDictionary<T> {
        [index: number]: T;
    }

    // Crazy typedef needed get _.omit to work properly with Dictionary and NumericDictionary
    type AnyKindOfDictionary =
        | Dictionary<{} | null | undefined>
        | NumericDictionary<{} | null | undefined>;

    interface Cancelable {
        cancel(): void;
        flush(): void;
    }

    type PartialDeep<T> = {
        [P in keyof T]?: PartialDeep<T[P]>;
    };

    // For backwards compatibility
    type LoDashImplicitArrayWrapper<T> = LoDashImplicitWrapper<T[]>;
    type LoDashImplicitNillableArrayWrapper<T> = LoDashImplicitWrapper<T[] | null | undefined>;
    type LoDashImplicitObjectWrapper<T> = LoDashImplicitWrapper<T>;
    type LoDashImplicitNillableObjectWrapper<T> = LoDashImplicitWrapper<T | null | undefined>;
    type LoDashImplicitNumberArrayWrapper = LoDashImplicitWrapper<number[]>;
    type LoDashImplicitStringWrapper = LoDashImplicitWrapper<string>;
    type LoDashExplicitArrayWrapper<T> = LoDashExplicitWrapper<T[]>;
    type LoDashExplicitNillableArrayWrapper<T> = LoDashExplicitWrapper<T[] | null | undefined>;
    type LoDashExplicitObjectWrapper<T> = LoDashExplicitWrapper<T>;
    type LoDashExplicitNillableObjectWrapper<T> = LoDashExplicitWrapper<T | null | undefined>;
    type LoDashExplicitNumberArrayWrapper = LoDashExplicitWrapper<number[]>;
    type LoDashExplicitStringWrapper = LoDashExplicitWrapper<string>;

    type DictionaryIterator<T, TResult> = ObjectIterator<Dictionary<T>, TResult>;
    type DictionaryIteratee<T> = ObjectIteratee<Dictionary<T>>;
    type DictionaryIteratorTypeGuard<T, S extends T> = ObjectIteratorTypeGuard<Dictionary<T>, S>;
    // NOTE: keys of objects at run time are always strings, even when a NumericDictionary is being iterated.
    type NumericDictionaryIterator<T, TResult> = (value: T, key: string, collection: NumericDictionary<T>) => TResult;
    type NumericDictionaryIteratee<T> = NumericDictionaryIterator<T, NotVoid> | IterateeShorthand<T>;
    type NumericDictionaryIterateeCustom<T, TResult> = NumericDictionaryIterator<T, TResult> | IterateeShorthand<T>;
}
