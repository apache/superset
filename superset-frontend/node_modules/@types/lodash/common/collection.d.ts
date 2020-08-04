import _ = require("../index");
declare module "../index" {
    // countBy

    interface LoDashStatic {
        /**
         * Creates an object composed of keys generated from the results of running each element of collection through
         * iteratee. The corresponding value of each key is the number of times the key was returned by iteratee. The
         * iteratee is invoked with one argument: (value).
         *
         * @param collection The collection to iterate over.
         * @param iteratee The function invoked per iteration.
         * @return Returns the composed aggregate object.
         */
        countBy<T>(
            collection: List<T> | null | undefined,
            iteratee?: ValueIteratee<T>
        ): Dictionary<number>;

        /**
         * @see _.countBy
         */
        countBy<T extends object>(
            collection: T | null | undefined,
            iteratee?: ValueIteratee<T[keyof T]>
        ): Dictionary<number>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.countBy
         */
        countBy<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            iteratee?: ValueIteratee<T>
        ): LoDashImplicitWrapper<Dictionary<number>>;

        /**
         * @see _.countBy
         */
        countBy<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratee?: ValueIteratee<T[keyof T]>
        ): LoDashImplicitWrapper<Dictionary<number>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.countBy
         */
        countBy<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            iteratee?: ValueIteratee<T>
        ): LoDashExplicitWrapper<Dictionary<number>>;

        /**
         * @see _.countBy
         */
        countBy<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratee?: ValueIteratee<T[keyof T]>
        ): LoDashExplicitWrapper<Dictionary<number>>;
    }

    // each

    interface LoDashStatic {
        each: typeof _.forEach; // tslint:disable-line:no-unnecessary-qualifier
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.forEach
         */
        each<T>(
            this: LoDashWrapper<T[] | null | undefined>,
            iteratee?: ArrayIterator<T, any>
        ): this;

        /**
         * @see _.forEach
         */
        each(
            this: LoDashWrapper<string | null | undefined>,
            iteratee?: StringIterator<any>
        ): this;

        /**
         * @see _.forEach
         */
        each<T>(
            this: LoDashWrapper<List<T> | null | undefined>,
            iteratee?: ListIterator<T, any>
        ): this;

        /**
         * @see _.forEach
         */
        each<T extends object>(
            this: LoDashWrapper<T | null | undefined>,
            iteratee?: ObjectIterator<T, any>
        ): this;
    }

    // eachRight

    interface LoDashStatic {
        eachRight: typeof _.forEachRight; // tslint:disable-line:no-unnecessary-qualifier
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.forEachRight
         */
        eachRight<T>(
            this: LoDashWrapper<T[] | null | undefined>,
            iteratee?: ArrayIterator<T, any>
        ): this;

        /**
         * @see _.forEachRight
         */
        eachRight(
            this: LoDashWrapper<string | null | undefined>,
            iteratee?: StringIterator<any>
        ): this;

        /**
         * @see _.forEachRight
         */
        eachRight<T>(
            this: LoDashWrapper<List<T> | null | undefined>,
            iteratee?: ListIterator<T, any>
        ): this;

        /**
         * @see _.forEachRight
         */
        eachRight<T extends object>(
            this: LoDashWrapper<T | null | undefined>,
            iteratee?: ObjectIterator<T, any>
        ): this;
    }

    // every

    interface LoDashStatic {
        /**
         * Checks if predicate returns truthy for all elements of collection. Iteration is stopped once predicate
         * returns falsey. The predicate is invoked with three arguments: (value, index|key, collection).
         *
         * @param collection The collection to iterate over.
         * @param predicate The function invoked per iteration.
         * @return Returns true if all elements pass the predicate check, else false.
         */
        every<T>(
            collection: List<T> | null | undefined,
            predicate?: ListIterateeCustom<T, boolean>
        ): boolean;

        /**
         * @see _.every
         */
        every<T extends object>(
            collection: T | null | undefined,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.every
         */
        every<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>
        ): boolean;

        /**
         * @see _.every
         */
        every<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): boolean;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.every
         */
        every<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>
        ): LoDashExplicitWrapper<boolean>;

        /**
         * @see _.every
         */
        every<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): LoDashExplicitWrapper<boolean>;
    }

    // filter

    interface LoDashStatic {
        /**
         * Iterates over elements of collection, returning an array of all elements predicate returns truthy for. The
         * predicate is invoked with three arguments: (value, index|key, collection).
         *
         * @param collection The collection to iterate over.
         * @param predicate The function invoked per iteration.
         * @return Returns the new filtered array.
         */
        filter(
            collection: string | null | undefined,
            predicate?: StringIterator<boolean>
        ): string[];

        /**
         * @see _.filter
         */
        filter<T, S extends T>(
            collection: List<T> | null | undefined,
            predicate: ListIteratorTypeGuard<T, S>
        ): S[];

        /**
         * @see _.filter
         */
        filter<T>(
            collection: List<T> | null | undefined,
            predicate?: ListIterateeCustom<T, boolean>
        ): T[];

        /**
         * @see _.filter
         */
        filter<T extends object, S extends T[keyof T]>(
            collection: T | null | undefined,
            predicate: ObjectIteratorTypeGuard<T, S>
        ): S[];

        /**
         * @see _.filter
         */
        filter<T extends object>(
            collection: T | null | undefined,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): Array<T[keyof T]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.filter
         */
        filter(
            this: LoDashImplicitWrapper<string | null | undefined>,
            predicate?: StringIterator<boolean>
        ): LoDashImplicitWrapper<string[]>;

        /**
         * @see _.filter
         */
        filter<T, S extends T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            predicate: ListIteratorTypeGuard<T, S>
        ): LoDashImplicitWrapper<S[]>;

        /**
         * @see _.filter
         */
        filter<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>
        ): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.filter
         */
        filter<T extends object, S extends T[keyof T]>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate: ObjectIteratorTypeGuard<T, S>
        ): LoDashImplicitWrapper<S[]>;

        /**
         * @see _.filter
         */
        filter<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): LoDashImplicitWrapper<Array<T[keyof T]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.filter
         */
        filter(
            this: LoDashExplicitWrapper<string | null | undefined>,
            predicate?: StringIterator<boolean>
        ): LoDashExplicitWrapper<string[]>;

        /**
         * @see _.filter
         */
        filter<T, S extends T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            predicate: ListIteratorTypeGuard<T, S>
        ): LoDashExplicitWrapper<S[]>;

        /**
         * @see _.filter
         */
        filter<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>
        ): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.filter
         */
        filter<T extends object, S extends T[keyof T]>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate: ObjectIteratorTypeGuard<T, S>
        ): LoDashExplicitWrapper<S[]>;

        /**
         * @see _.filter
         */
        filter<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): LoDashExplicitWrapper<Array<T[keyof T]>>;
    }

    // find

    interface LoDashStatic {
        /**
         * Iterates over elements of collection, returning the first element predicate returns truthy for.
         * The predicate is invoked with three arguments: (value, index|key, collection).
         *
         * @param collection The collection to search.
         * @param predicate The function invoked per iteration.
         * @param fromIndex The index to search from.
         * @return Returns the matched element, else undefined.
         */
        find<T, S extends T>(
            collection: List<T> | null | undefined,
            predicate: ListIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): S|undefined;

        /**
         * @see _.find
         */
        find<T>(
            collection: List<T> | null | undefined,
            predicate?: ListIterateeCustom<T, boolean>,
            fromIndex?: number
        ): T|undefined;

        /**
         * @see _.find
         */
        find<T extends object, S extends T[keyof T]>(
            collection: T | null | undefined,
            predicate: ObjectIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): S|undefined;

        /**
         * @see _.find
         */
        find<T extends object>(
            collection: T | null | undefined,
            predicate?: ObjectIterateeCustom<T, boolean>,
            fromIndex?: number
        ): T[keyof T]|undefined;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.find
         */
        find<T, S extends T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            predicate: ListIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): S|undefined;

        /**
         * @see _.find
         */
        find<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>,
            fromIndex?: number
        ): T|undefined;

        /**
         * @see _.find
         */
        find<T extends object, S extends T[keyof T]>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate: ObjectIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): S|undefined;

        /**
         * @see _.find
         */
        find<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>,
            fromIndex?: number
        ): T[keyof T]|undefined;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.find
         */
        find<T, S extends T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            predicate: ListIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): LoDashExplicitWrapper<S|undefined>;

        /**
         * @see _.find
         */
        find<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>,
            fromIndex?: number
        ): LoDashExplicitWrapper<T|undefined>;

        /**
         * @see _.find
         */
        find<T extends object, S extends T[keyof T]>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate: ObjectIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): LoDashExplicitWrapper<S|undefined>;

        /**
         * @see _.find
         */
        find<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>,
            fromIndex?: number
        ): LoDashExplicitWrapper<T[keyof T]|undefined>;
    }

    // findLast

    interface LoDashStatic {
        /**
         * This method is like _.find except that it iterates over elements of a collection from
         * right to left.
         * @param collection Searches for a value in this list.
         * @param predicate The function called per iteration.
         * @param fromIndex The index to search from.
         * @return The found element, else undefined.
         */
        findLast<T, S extends T>(
            collection: List<T> | null | undefined,
            predicate: ListIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): S|undefined;

        /**
         * @see _.findLast
         */
        findLast<T>(
            collection: List<T> | null | undefined,
            predicate?: ListIterateeCustom<T, boolean>,
            fromIndex?: number
        ): T|undefined;

        /**
         * @see _.findLast
         */
        findLast<T extends object, S extends T[keyof T]>(
            collection: T | null | undefined,
            predicate: ObjectIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): S|undefined;

        /**
         * @see _.findLast
         */
        findLast<T extends object>(
            collection: T | null | undefined,
            predicate?: ObjectIterateeCustom<T, boolean>,
            fromIndex?: number
        ): T[keyof T]|undefined;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.findLast
         */
        findLast<T, S extends T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            predicate: ListIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): S | undefined;

        /**
         * @see _.findLast
         */
        findLast<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>,
            fromIndex?: number
        ): T | undefined;

        /**
         * @see _.findLast
         */
        findLast<T extends object, S extends T[keyof T]>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate: ObjectIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): S|undefined;

        /**
         * @see _.findLast
         */
        findLast<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>,
            fromIndex?: number
        ): T[keyof T]|undefined;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.findLast
         */
        findLast<T, S extends T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            predicate: ListIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): LoDashExplicitWrapper<S | undefined>;

        /**
         * @see _.findLast
         */
        findLast<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>,
            fromIndex?: number
        ): LoDashExplicitWrapper<T | undefined>;

        /**
         * @see _.findLast
         */
        findLast<T extends object, S extends T[keyof T]>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate: ObjectIteratorTypeGuard<T, S>,
            fromIndex?: number
        ): LoDashExplicitWrapper<S|undefined>;

        /**
         * @see _.findLast
         */
        findLast<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>,
            fromIndex?: number
        ): LoDashExplicitWrapper<T[keyof T]|undefined>;
    }

    // flatMap

    interface LoDashStatic {
        /**
         * Creates an array of flattened values by running each element in collection through iteratee
         * and concating its result to the other mapped values. The iteratee is invoked with three arguments:
         * (value, index|key, collection).
         *
         * @param collection The collection to iterate over.
         * @param iteratee The function invoked per iteration.
         * @return Returns the new flattened array.
         */
        flatMap<T>(
            collection: List<Many<T>> | Dictionary<Many<T>> | NumericDictionary<Many<T>> | null | undefined
        ): T[];

        /**
         * @see _.flatMap
         */
        flatMap(
            collection: object | null | undefined
        ): any[];

        /**
         * @see _.flatMap
         */
        flatMap<T, TResult>(
            collection: List<T> | null | undefined,
            iteratee: ListIterator<T, Many<TResult>>
        ): TResult[];

        /**
         * @see _.flatMap
         */
        flatMap<T extends object, TResult>(
            collection: T | null | undefined,
            iteratee: ObjectIterator<T, Many<TResult>>
        ): TResult[];

        /**
         * @see _.flatMap
         */
        flatMap(
            collection: object | null | undefined,
            iteratee: string
        ): any[];

        /**
         * @see _.flatMap
         */
        flatMap(
            collection: object | null | undefined,
            iteratee: object
        ): boolean[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.flatMap
         */
        flatMap<T>(this: LoDashImplicitWrapper<List<Many<T>> | Dictionary<Many<T>> | NumericDictionary<Many<T>> | null | undefined>): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.flatMap
         */
        flatMap(): LoDashImplicitWrapper<any[]>;

        /**
         * @see _.flatMap
         */
        flatMap<T, TResult>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            iteratee: ListIterator<T, Many<TResult>>
        ): LoDashImplicitWrapper<TResult[]>;

        /**
         * @see _.flatMap
         */
        flatMap<T extends object, TResult>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratee: ObjectIterator<T, Many<TResult>>
        ): LoDashImplicitWrapper<TResult[]>;

        /**
         * @see _.flatMap
         */
        flatMap(
            iteratee: string
        ): LoDashImplicitWrapper<any[]>;

        /**
         * @see _.flatMap
         */
        flatMap(
            iteratee: object
        ): LoDashImplicitWrapper<boolean[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.flatMap
         */
        flatMap<T>(this: LoDashExplicitWrapper<List<Many<T>> | Dictionary<Many<T>> | NumericDictionary<Many<T>> | null | undefined>): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.flatMap
         */
        flatMap(): LoDashExplicitWrapper<any[]>;

        /**
         * @see _.flatMap
         */
        flatMap<T, TResult>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            iteratee: ListIterator<T, Many<TResult>>
        ): LoDashExplicitWrapper<TResult[]>;

        /**
         * @see _.flatMap
         */
        flatMap<T extends object, TResult>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratee: ObjectIterator<T, Many<TResult>>
        ): LoDashExplicitWrapper<TResult[]>;

        /**
         * @see _.flatMap
         */
        flatMap(
            iteratee: string
        ): LoDashExplicitWrapper<any[]>;

        /**
         * @see _.flatMap
         */
        flatMap(
            iteratee: object
        ): LoDashExplicitWrapper<boolean[]>;
    }

    // flatMapDeep

    interface LoDashStatic {
        /**
         * This method is like `_.flatMap` except that it recursively flattens the
         * mapped results.
         *
         * @since 4.7.0
         * @category Collection
         * @param collection The collection to iterate over.
         * @param [iteratee=_.identity] The function invoked per iteration.
         * @returns Returns the new flattened array.
         * @example
         *
         * function duplicate(n) {
         *   return [[[n, n]]];
         * }
         *
         * _.flatMapDeep([1, 2], duplicate);
         * // => [1, 1, 2, 2]
         */
        flatMapDeep<T>(
            collection: List<ListOfRecursiveArraysOrValues<T> | T> | Dictionary<ListOfRecursiveArraysOrValues<T> | T> | NumericDictionary<ListOfRecursiveArraysOrValues<T> | T> | null | undefined
        ): T[];

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep<T, TResult>(
            collection: List<T> | null | undefined,
            iteratee: ListIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>
        ): TResult[];

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep<T extends object, TResult>(
            collection: T | null | undefined,
            iteratee: ObjectIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>
        ): TResult[];

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep(
            collection: object | null | undefined,
            iteratee: string
        ): any[];

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep(
            collection: object | null | undefined,
            iteratee: object
        ): boolean[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.flatMapDeep
         */
        flatMapDeep<T>(
            this: LoDashImplicitWrapper<List<ListOfRecursiveArraysOrValues<T> | T> | Dictionary<ListOfRecursiveArraysOrValues<T> | T> | NumericDictionary<ListOfRecursiveArraysOrValues<T> | T> | null | undefined>
        ): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep<T, TResult>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            iteratee: ListIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>
        ): LoDashImplicitWrapper<TResult[]>;

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep<T extends object, TResult>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratee: ObjectIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>
        ): LoDashImplicitWrapper<TResult[]>;

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep(
            this: LoDashImplicitWrapper<object | null | undefined>,
            iteratee: string
        ): LoDashImplicitWrapper<any[]>;

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep(
            this: LoDashImplicitWrapper<object | null | undefined>,
            iteratee: object
        ): LoDashImplicitWrapper<boolean[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.flatMapDeep
         */
        flatMapDeep<T>(
            this: LoDashExplicitWrapper<List<ListOfRecursiveArraysOrValues<T> | T> | Dictionary<ListOfRecursiveArraysOrValues<T> | T> | NumericDictionary<ListOfRecursiveArraysOrValues<T> | T> | null | undefined>
        ): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep<T, TResult>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            iteratee: ListIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>
        ): LoDashExplicitWrapper<TResult[]>;

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep<T extends object, TResult>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratee: ObjectIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>
        ): LoDashExplicitWrapper<TResult[]>;

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep(
            this: LoDashExplicitWrapper<object | null | undefined>,
            iteratee: string
        ): LoDashExplicitWrapper<any[]>;

        /**
         * @see _.flatMapDeep
         */
        flatMapDeep(
            this: LoDashExplicitWrapper<object | null | undefined>,
            iteratee: object
        ): LoDashExplicitWrapper<boolean[]>;
    }

    // flatMapDepth

    interface LoDashStatic {
        /**
         * This method is like `_.flatMap` except that it recursively flattens the
         * mapped results up to `depth` times.
         *
         * @since 4.7.0
         * @category Collection
         * @param collection The collection to iterate over.
         * @param [iteratee=_.identity] The function invoked per iteration.
         * @param [depth=1] The maximum recursion depth.
         * @returns Returns the new flattened array.
         * @example
         *
         * function duplicate(n) {
         *   return [[[n, n]]];
         * }
         *
         * _.flatMapDepth([1, 2], duplicate, 2);
         * // => [[1, 1], [2, 2]]
         */
        flatMapDepth<T>(
            collection: List<ListOfRecursiveArraysOrValues<T> | T> | Dictionary<ListOfRecursiveArraysOrValues<T> | T> | NumericDictionary<ListOfRecursiveArraysOrValues<T> | T> | null | undefined
        ): T[];

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth<T, TResult>(
            collection: List<T> | null | undefined,
            iteratee: ListIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>,
            depth?: number
        ): TResult[];

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth<T extends object, TResult>(
            collection: T | null | undefined,
            iteratee: ObjectIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>,
            depth?: number
        ): TResult[];

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth(
            collection: object | null | undefined,
            iteratee: string,
            depth?: number
        ): any[];

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth(
            collection: object | null | undefined,
            iteratee: object,
            depth?: number
        ): boolean[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.flatMapDepth
         */
        flatMapDepth<T>(
            this: LoDashImplicitWrapper<List<ListOfRecursiveArraysOrValues<T> | T> | Dictionary<ListOfRecursiveArraysOrValues<T> | T> | NumericDictionary<ListOfRecursiveArraysOrValues<T> | T> | null | undefined>
        ): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth<T, TResult>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            iteratee: ListIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>,
            depth?: number
        ): LoDashImplicitWrapper<TResult[]>;

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth<T extends object, TResult>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratee: ObjectIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>,
            depth?: number
        ): LoDashImplicitWrapper<TResult[]>;

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth(
            this: LoDashImplicitWrapper<object | null | undefined>,
            iteratee: string,
            depth?: number
        ): LoDashImplicitWrapper<any[]>;

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth(
            this: LoDashImplicitWrapper<object | null | undefined>,
            iteratee: object,
            depth?: number
        ): LoDashImplicitWrapper<boolean[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.flatMapDepth
         */
        flatMapDepth<T>(
            this: LoDashExplicitWrapper<List<ListOfRecursiveArraysOrValues<T> | T> | Dictionary<ListOfRecursiveArraysOrValues<T> | T> | NumericDictionary<ListOfRecursiveArraysOrValues<T> | T> | null | undefined>
        ): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth<T, TResult>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            iteratee: ListIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>,
            depth?: number
        ): LoDashExplicitWrapper<TResult[]>;

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth<T extends object, TResult>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratee: ObjectIterator<T, ListOfRecursiveArraysOrValues<TResult> | TResult>,
            depth?: number
        ): LoDashExplicitWrapper<TResult[]>;

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth(
            this: LoDashExplicitWrapper<object | null | undefined>,
            iteratee: string,
            depth?: number
        ): LoDashExplicitWrapper<any[]>;

        /**
         * @see _.flatMapDepth
         */
        flatMapDepth(
            this: LoDashExplicitWrapper<object | null | undefined>,
            iteratee: object,
            depth?: number
        ): LoDashExplicitWrapper<boolean[]>;
    }

    // forEach

    interface LoDashStatic {
        /**
         * Iterates over elements of collection invoking iteratee for each element. The iteratee is invoked with three arguments:
         * (value, index|key, collection). Iteratee functions may exit iteration early by explicitly returning false.
         *
         * Note: As with other "Collections" methods, objects with a "length" property are iterated like arrays. To
         * avoid this behavior _.forIn or _.forOwn may be used for object iteration.
         *
         * @alias _.each
         *
         * @param collection The collection to iterate over.
         * @param iteratee The function invoked per iteration.
         */
        forEach<T>(
            collection: T[],
            iteratee?: ArrayIterator<T, any>
        ): T[];

        /**
         * @see _.forEach
         */
        forEach(
            collection: string,
            iteratee?: StringIterator<any>
        ): string;

        /**
         * @see _.forEach
         */
        forEach<T>(
            collection: List<T>,
            iteratee?: ListIterator<T, any>
        ): List<T>;

        /**
         * @see _.forEach
         */
        forEach<T extends object>(
            collection: T,
            iteratee?: ObjectIterator<T, any>
        ): T;

        /**
         * @see _.forEach
         */
        forEach<T, TArray extends T[] | null | undefined>(
            collection: TArray & (T[] | null | undefined),
            iteratee?: ArrayIterator<T, any>
        ): TArray;

        /**
         * @see _.forEach
         */
        forEach<TString extends string | null | undefined>(
            collection: TString,
            iteratee?: StringIterator<any>
        ): TString;

        /**
         * @see _.forEach
         */
        forEach<T, TList extends List<T> | null | undefined>(
            collection: TList & (List<T> | null | undefined),
            iteratee?: ListIterator<T, any>
        ): TList;

        /**
         * @see _.forEach
         */
        forEach<T extends object>(
            collection: T | null | undefined,
            iteratee?: ObjectIterator<T, any>
        ): T | null | undefined;
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.forEach
         */
        forEach<T>(
            this: LoDashWrapper<T[] | null | undefined>,
            iteratee?: ArrayIterator<T, any>
        ): this;

        /**
         * @see _.forEach
         */
        forEach(
            this: LoDashWrapper<string | null | undefined>,
            iteratee?: StringIterator<any>
        ): this;

        /**
         * @see _.forEach
         */
        forEach<T>(
            this: LoDashWrapper<List<T> | null | undefined>,
            iteratee?: ListIterator<T, any>
        ): this;

        /**
         * @see _.forEach
         */
        forEach<T extends object>(
            this: LoDashWrapper<T | null | undefined>,
            iteratee?: ObjectIterator<T, any>
        ): this;
    }

    // forEachRight

    interface LoDashStatic {
        /**
         * This method is like _.forEach except that it iterates over elements of collection from right to left.
         *
         * @alias _.eachRight
         *
         * @param collection The collection to iterate over.
         * @param iteratee The function called per iteration.
         */
        forEachRight<T>(
            collection: T[],
            iteratee?: ArrayIterator<T, any>
        ): T[];

        /**
         * @see _.forEachRight
         */
        forEachRight(
            collection: string,
            iteratee?: StringIterator<any>
        ): string;

        /**
         * @see _.forEachRight
         */
        forEachRight<T>(
            collection: List<T>,
            iteratee?: ListIterator<T, any>
        ): List<T>;

        /**
         * @see _.forEachRight
         */
        forEachRight<T extends object>(
            collection: T,
            iteratee?: ObjectIterator<T, any>
        ): T;

        /**
         * @see _.forEachRight
         */
        forEachRight<T, TArray extends T[] | null | undefined>(
            collection: TArray & (T[] | null | undefined),
            iteratee?: ArrayIterator<T, any>
        ): TArray;

        /**
         * @see _.forEachRight
         */
        forEachRight<TString extends string | null | undefined>(
            collection: TString,
            iteratee?: StringIterator<any>
        ): TString;

        /**
         * @see _.forEachRight
         */
        forEachRight<T, TList extends List<T> | null | undefined>(
            collection: TList & (List<T> | null | undefined),
            iteratee?: ListIterator<T, any>
        ): TList;

        /**
         * @see _.forEachRight
         */
        forEachRight<T extends object>(
            collection: T | null | undefined,
            iteratee?: ObjectIterator<T, any>
        ): T | null | undefined;
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.forEachRight
         */
        forEachRight<T>(
            this: LoDashWrapper<T[] | null | undefined>,
            iteratee?: ArrayIterator<T, any>
        ): this;

        /**
         * @see _.forEachRight
         */
        forEachRight(
            this: LoDashWrapper<string | null | undefined>,
            iteratee?: StringIterator<any>
        ): this;

        /**
         * @see _.forEachRight
         */
        forEachRight<T>(
            this: LoDashWrapper<List<T> | null | undefined>,
            iteratee?: ListIterator<T, any>
        ): this;

        /**
         * @see _.forEachRight
         */
        forEachRight<T extends object>(
            this: LoDashWrapper<T | null | undefined>,
            iteratee?: ObjectIterator<T, any>
        ): this;
    }

    // groupBy

    interface LoDashStatic {
        /**
         * Creates an object composed of keys generated from the results of running each element of collection through
         * iteratee. The corresponding value of each key is an array of the elements responsible for generating the
         * key. The iteratee is invoked with one argument: (value).
         *
         * @param collection The collection to iterate over.
         * @param iteratee The function invoked per iteration.
         * @return Returns the composed aggregate object.
         */
        groupBy<T>(
            collection: List<T> | null | undefined,
            iteratee?: ValueIteratee<T>
        ): Dictionary<T[]>;

        /**
         * @see _.groupBy
         */
        groupBy<T extends object>(
            collection: T | null | undefined,
            iteratee?: ValueIteratee<T[keyof T]>
        ): Dictionary<Array<T[keyof T]>>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.groupBy
         */
        groupBy<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            iteratee?: ValueIteratee<T>
        ): LoDashImplicitWrapper<Dictionary<T[]>>;

        /**
         * @see _.groupBy
         */
        groupBy<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratee?: ValueIteratee<T[keyof T]>
        ): LoDashImplicitWrapper<Dictionary<Array<T[keyof T]>>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.groupBy
         */
        groupBy<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            iteratee?: ValueIteratee<T>
        ): LoDashExplicitWrapper<Dictionary<T[]>>;

        /**
         * @see _.groupBy
         */
        groupBy<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratee?: ValueIteratee<T[keyof T]>
        ): LoDashExplicitWrapper<Dictionary<Array<T[keyof T]>>>;
    }

    // includes

    interface LoDashStatic {
        /**
         * Checks if target is in collection using SameValueZero for equality comparisons. If fromIndex is negative,
         * it’s used as the offset from the end of collection.
         *
         * @param collection The collection to search.
         * @param target The value to search for.
         * @param fromIndex The index to search from.
         * @return True if the target element is found, else false.
         */
        includes<T>(
            collection: List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined,
            target: T,
            fromIndex?: number
        ): boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.includes
         */
        includes<T>(
            this: LoDashImplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            target: T,
            fromIndex?: number
        ): boolean;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.includes
         */
        includes<T>(
            this: LoDashExplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            target: T,
            fromIndex?: number
        ): LoDashExplicitWrapper<boolean>;
    }

    // invokeMap

    interface LoDashStatic {
        /**
        * Invokes the method named by methodName on each element in the collection returning
        * an array of the results of each invoked method. Additional arguments will be provided
        * to each invoked method. If methodName is a function it will be invoked for, and this
        * bound to, each element in the collection.
        * @param collection The collection to iterate over.
        * @param methodName The name of the method to invoke.
        * @param args Arguments to invoke the method with.
        **/
        invokeMap(
            collection: object | null | undefined,
            methodName: string,
            ...args: any[]): any[];

        /**
        * @see _.invokeMap
        **/
        invokeMap<TResult>(
            collection: object | null | undefined,
            method: (...args: any[]) => TResult,
            ...args: any[]): TResult[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
        * @see _.invokeMap
        **/
        invokeMap(
            methodName: string,
            ...args: any[]): LoDashImplicitWrapper<any[]>;

        /**
        * @see _.invokeMap
        **/
        invokeMap<TResult>(
            method: (...args: any[]) => TResult,
            ...args: any[]): LoDashImplicitWrapper<TResult[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
        * @see _.invokeMap
        **/
        invokeMap(
            methodName: string,
            ...args: any[]): LoDashExplicitWrapper<any[]>;

        /**
        * @see _.invokeMap
        **/
        invokeMap<TResult>(
            method: (...args: any[]) => TResult,
            ...args: any[]): LoDashExplicitWrapper<TResult[]>;
    }

    // keyBy

    interface LoDashStatic {
        /**
         * Creates an object composed of keys generated from the results of running each element of collection through
         * iteratee. The corresponding value of each key is the last element responsible for generating the key. The
         * iteratee function is invoked with one argument: (value).
         *
         * @param collection The collection to iterate over.
         * @param iteratee The function invoked per iteration.
         * @return Returns the composed aggregate object.
         */
        keyBy<T>(
            collection: List<T> | null | undefined,
            iteratee?: ValueIterateeCustom<T, PropertyName>
        ): Dictionary<T>;

        /**
         * @see _.keyBy
         */
        keyBy<T extends object>(
            collection: T | null | undefined,
            iteratee?: ValueIterateeCustom<T[keyof T], PropertyName>
        ): Dictionary<T[keyof T]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.keyBy
         */
        keyBy<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            iteratee?: ValueIterateeCustom<T, PropertyName>
        ): LoDashImplicitWrapper<Dictionary<T>>;

        /**
         * @see _.keyBy
         */
        keyBy<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratee?: ValueIterateeCustom<T[keyof T], PropertyName>
        ): LoDashImplicitWrapper<Dictionary<T[keyof T]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.keyBy
         */
        keyBy<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            iteratee?: ValueIterateeCustom<T, PropertyName>
        ): LoDashExplicitWrapper<Dictionary<T>>;

        /**
         * @see _.keyBy
         */
        keyBy<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratee?: ValueIterateeCustom<T[keyof T], PropertyName>
        ): LoDashExplicitWrapper<Dictionary<T[keyof T]>>;
    }

    // map

    interface LoDashStatic {
        /**
         * Creates an array of values by running each element in collection through iteratee. The iteratee is
         * invoked with three arguments: (value, index|key, collection).
         *
         * Many lodash methods are guarded to work as iteratees for methods like _.every, _.filter, _.map, _.mapValues,
         * _.reject, and _.some.
         *
         * The guarded methods are:
         * ary, callback, chunk, clone, create, curry, curryRight, drop, dropRight, every, fill, flatten, invert, max,
         * min, parseInt, slice, sortBy, take, takeRight, template, trim, trimLeft, trimRight, trunc, random, range,
         * sample, some, sum, uniq, and words
         *
         * @param collection The collection to iterate over.
         * @param iteratee The function invoked per iteration.
         * @return Returns the new mapped array.
         */
        map<T, TResult>(
            collection: T[] | null | undefined,
            iteratee: ArrayIterator<T, TResult>
        ): TResult[];

        /**
         * @see _.map
         */
        map<T, TResult>(
            collection: List<T> | null | undefined,
            iteratee: ListIterator<T, TResult>
        ): TResult[];

        /**
         * @see _.map
         */
        map<T>(collection: List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined): T[];

        /**
         * @see _.map
         */
        map<T extends object, TResult>(
            collection: T | null | undefined,
            iteratee: ObjectIterator<T, TResult>
        ): TResult[];

        /** @see _.map */
        map<T, K extends keyof T>(
            collection: List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined,
            iteratee: K
        ): Array<T[K]>;

        /**
         * @see _.map
         */
        map<T>(
            collection: List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined,
            iteratee?: string
        ): any[];

        /**
         * @see _.map
         */
        map<T>(
            collection: List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined,
            iteratee?: object
        ): boolean[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.map
         */
        map<T, TResult>(
            this: LoDashImplicitWrapper<T[] | null | undefined>,
            iteratee: ArrayIterator<T, TResult>
        ): LoDashImplicitWrapper<TResult[]>;

        /**
         * @see _.map
         */
        map<T, TResult>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            iteratee: ListIterator<T, TResult>
        ): LoDashImplicitWrapper<TResult[]>;

        /**
         * @see _.map
         */
        map<T>(this: LoDashImplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.map
         */
        map<T extends object, TResult>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratee: ObjectIterator<T, TResult>
        ): LoDashImplicitWrapper<TResult[]>;

        /** @see _.map */
        map<T, K extends keyof T>(
            this: LoDashImplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee: K
        ): LoDashImplicitWrapper<Array<T[K]>>;

        /**
         * @see _.map
         */
        map<T>(
            this: LoDashImplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee?: string
        ): LoDashImplicitWrapper<any[]>;

        /**
         * @see _.map
         */
        map<T>(
            this: LoDashImplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee?: object
        ): LoDashImplicitWrapper<boolean[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.map
         */
        map<T, TResult>(
            this: LoDashExplicitWrapper<T[] | null | undefined>,
            iteratee: ArrayIterator<T, TResult>
        ): LoDashExplicitWrapper<TResult[]>;

        /**
         * @see _.map
         */
        map<T, TResult>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            iteratee: ListIterator<T, TResult>
        ): LoDashExplicitWrapper<TResult[]>;

        /**
         * @see _.map
         */
        map<T>(this: LoDashExplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.map
         */
        map<T extends object, TResult>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratee: ObjectIterator<T, TResult>
        ): LoDashExplicitWrapper<TResult[]>;

        /** @see _.map */
        map<T, K extends keyof T>(
            this: LoDashExplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee: K
        ): LoDashExplicitWrapper<Array<T[K]>>;

        /**
         * @see _.map
         */
        map<T>(
            this: LoDashExplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee?: string
        ): LoDashExplicitWrapper<any[]>;

        /**
         * @see _.map
         */
        map<T>(
            this: LoDashExplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee?: object
        ): LoDashExplicitWrapper<boolean[]>;
    }

    // orderBy

    interface LoDashStatic {
        /**
         * This method is like `_.sortBy` except that it allows specifying the sort
         * orders of the iteratees to sort by. If `orders` is unspecified, all values
         * are sorted in ascending order. Otherwise, specify an order of "desc" for
         * descending or "asc" for ascending sort order of corresponding values.
         *
         * @category Collection
         * @param collection The collection to iterate over.
         * @param [iteratees=[_.identity]] The iteratees to sort by.
         * @param [orders] The sort orders of `iteratees`.
         * @param- {Object} [guard] Enables use as an iteratee for functions like `_.reduce`.
         * @returns Returns the new sorted array.
         * @example
         *
         * var users = [
         *   { 'user': 'fred',   'age': 48 },
         *   { 'user': 'barney', 'age': 34 },
         *   { 'user': 'fred',   'age': 42 },
         *   { 'user': 'barney', 'age': 36 }
         * ];
         *
         * // sort by `user` in ascending order and by `age` in descending order
         * _.orderBy(users, ['user', 'age'], ['asc', 'desc']);
         * // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 42]]
         */
        orderBy<T>(
            collection: List<T> | null | undefined,
            iteratees?: Many<ListIterator<T, NotVoid>>,
            orders?: Many<boolean|"asc"|"desc">
        ): T[];

        /**
         * @see _.orderBy
         */
        orderBy<T>(
            collection: List<T> | null | undefined,
            iteratees?: Many<ListIteratee<T>>,
            orders?: Many<boolean|"asc"|"desc">
        ): T[];

        /**
         * @see _.orderBy
         */
        orderBy<T extends object>(
            collection: T | null | undefined,
            iteratees?: Many<ObjectIterator<T, NotVoid>>,
            orders?: Many<boolean|"asc"|"desc">
        ): Array<T[keyof T]>;

        /**
         * @see _.orderBy
         */
        orderBy<T extends object>(
            collection: T | null | undefined,
            iteratees?: Many<ObjectIteratee<T>>,
            orders?: Many<boolean|"asc"|"desc">
        ): Array<T[keyof T]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.orderBy
         */
        orderBy<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            iteratees?: Many<ListIterator<T, NotVoid>>,
            orders?: Many<boolean|"asc"|"desc">
        ): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.orderBy
         */
        orderBy<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            iteratees?: Many<ListIteratee<T>>,
            orders?: Many<boolean|"asc"|"desc">
        ): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.orderBy
         */
        orderBy<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratees?: Many<ObjectIterator<T, NotVoid>>,
            orders?: Many<boolean|"asc"|"desc">
        ): LoDashImplicitWrapper<Array<T[keyof T]>>;

        /**
         * @see _.orderBy
         */
        orderBy<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratees?: Many<ObjectIteratee<T>>,
            orders?: Many<boolean|"asc"|"desc">
        ): LoDashImplicitWrapper<Array<T[keyof T]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.orderBy
         */
        orderBy<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            iteratees?: Many<ListIterator<T, NotVoid>>,
            orders?: Many<boolean|"asc"|"desc">
        ): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.orderBy
         */
        orderBy<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            iteratees?: Many<ListIteratee<T>>,
            orders?: Many<boolean|"asc"|"desc">
        ): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.orderBy
         */
        orderBy<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratees?: Many<ObjectIterator<T, NotVoid>>,
            orders?: Many<boolean|"asc"|"desc">
        ): LoDashExplicitWrapper<Array<T[keyof T]>>;

        /**
         * @see _.orderBy
         */
        orderBy<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratees?: Many<ObjectIteratee<T>>,
            orders?: Many<boolean|"asc"|"desc">
        ): LoDashExplicitWrapper<Array<T[keyof T]>>;
    }

    // partition

    interface LoDashStatic {
        /**
        * Creates an array of elements split into two groups, the first of which contains elements predicate returns truthy for,
        * while the second of which contains elements predicate returns falsey for.
        * The predicate is invoked with three arguments: (value, index|key, collection).
        *
        * @param collection The collection to iterate over.
        * @param callback The function called per iteration.
        * @return Returns the array of grouped elements.
        **/
        partition<T, U extends T>(
            collection: List<T> | null | undefined,
            callback: ValueIteratorTypeGuard<T, U>
        ): [U[], Array<Exclude<T, U>>];
        partition<T>(
            collection: List<T> | null | undefined,
            callback: ValueIteratee<T>
        ): [T[], T[]];

        /**
         * @see _.partition
         */
        partition<T extends object>(
            collection: T | null | undefined,
            callback: ValueIteratee<T[keyof T]>
        ): [Array<T[keyof T]>, Array<T[keyof T]>];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.partition
         */
        partition<T, U extends T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            callback: ValueIteratorTypeGuard<T, U>
        ): LoDashImplicitWrapper<[U[], Array<Exclude<T, U>>]>;
        partition<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            callback: ValueIteratee<T>
        ): LoDashImplicitWrapper<[T[], T[]]>;

        /**
         * @see _.partition
         */
        partition<T>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            callback: ValueIteratee<T[keyof T]>
        ): LoDashImplicitWrapper<[Array<T[keyof T]>, Array<T[keyof T]>]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.partition
         */
        partition<T, U extends T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            callback: ValueIteratorTypeGuard<T, U>
        ): LoDashExplicitWrapper<[U[], Array<Exclude<T, U>>]>;
        partition<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            callback: ValueIteratee<T>
        ): LoDashExplicitWrapper<[T[], T[]]>;

        /**
         * @see _.partition
         */
        partition<T>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            callback: ValueIteratee<T[keyof T]>
        ): LoDashExplicitWrapper<[Array<T[keyof T]>, Array<T[keyof T]>]>;
    }

    // reduce

    interface LoDashStatic {
        /**
        * Reduces a collection to a value which is the accumulated result of running each
        * element in the collection through the callback, where each successive callback execution
        * consumes the return value of the previous execution. If accumulator is not provided the
        * first element of the collection will be used as the initial accumulator value. The callback
        * is invoked with four arguments: (accumulator, value, index|key, collection).
        * @param collection The collection to iterate over.
        * @param callback The function called per iteration.
        * @param accumulator Initial value of the accumulator.
        * @return Returns the accumulated value.
        **/
        reduce<T, TResult>(
            collection: T[] | null | undefined,
            callback: MemoListIterator<T, TResult, T[]>,
            accumulator: TResult
        ): TResult;

        /**
        * @see _.reduce
        **/
        reduce<T, TResult>(
            collection: List<T> | null | undefined,
            callback: MemoListIterator<T, TResult, List<T>>,
            accumulator: TResult
        ): TResult;

        /**
        * @see _.reduce
        **/
        reduce<T extends object, TResult>(
            collection: T | null | undefined,
            callback: MemoObjectIterator<T[keyof T], TResult, T>,
            accumulator: TResult
        ): TResult;

        /**
        * @see _.reduce
        **/
        reduce<T>(
            collection: T[] | null | undefined,
            callback: MemoListIterator<T, T, T[]>
        ): T | undefined;

        /**
         * @see _.reduce
         **/
        reduce<T>(
            collection: List<T> | null | undefined,
            callback: MemoListIterator<T, T, List<T>>
        ): T | undefined;

        /**
        * @see _.reduce
        **/
        reduce<T extends object>(
            collection: T | null | undefined,
            callback: MemoObjectIterator<T[keyof T], T[keyof T], T>
        ): T[keyof T] | undefined;
    }

    interface LoDashImplicitWrapper<TValue> {
         /**
        * @see _.reduce
        **/
        reduce<T, TResult>(
            this: LoDashImplicitWrapper<T[] | null | undefined>,
            callback: MemoListIterator<T, TResult, T[]>,
            accumulator: TResult
        ): TResult;

        /**
         * @see _.reduce
         **/
        reduce<T, TResult>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            callback: MemoListIterator<T, TResult, List<T>>,
            accumulator: TResult
        ): TResult;

        /**
        * @see _.reduce
        **/
        reduce<T extends object, TResult>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            callback: MemoObjectIterator<T[keyof T], TResult, T>,
            accumulator: TResult
        ): TResult;

        /**
        * @see _.reduce
        **/
        reduce<T>(
            this: LoDashImplicitWrapper<T[] | null | undefined>,
            callback: MemoListIterator<T, T, T[]>
        ): T | undefined;

        /**
        * @see _.reduce
        **/
        reduce<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            callback: MemoListIterator<T, T, List<T>>
        ): T | undefined;

        /**
        * @see _.reduce
        **/
        reduce<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            callback: MemoObjectIterator<T[keyof T], T[keyof T], T>
        ): T[keyof T] | undefined;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
        * @see _.reduce
        **/
        reduce<T, TResult>(
            this: LoDashExplicitWrapper<T[] | null | undefined>,
            callback: MemoListIterator<T, TResult, T[]>,
            accumulator: TResult
        ): LoDashExplicitWrapper<TResult>;

        /**
        * @see _.reduce
        **/
        reduce<T, TResult>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            callback: MemoListIterator<T, TResult, List<T>>,
            accumulator: TResult
        ): LoDashExplicitWrapper<TResult>;

        /**
        * @see _.reduce
        **/
        reduce<T extends object, TResult>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            callback: MemoObjectIterator<T[keyof T], TResult, T>,
            accumulator: TResult
        ): LoDashExplicitWrapper<TResult>;

        /**
        * @see _.reduce
        **/
        reduce<T>(
            this: LoDashExplicitWrapper<T[] | null | undefined>,
            callback: MemoListIterator<T, T, T[]>
        ): LoDashExplicitWrapper<T | undefined>;

        /**
        * @see _.reduce
        **/
        reduce<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            callback: MemoListIterator<T, T, List<T>>
        ): LoDashExplicitWrapper<T | undefined>;

        /**
        * @see _.reduce
        **/
        reduce<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            callback: MemoObjectIterator<T[keyof T], T[keyof T], T>
        ): LoDashExplicitWrapper<T[keyof T] | undefined>;
    }

    // reduceRight

    interface LoDashStatic {
        /**
        * This method is like _.reduce except that it iterates over elements of a collection from
        * right to left.
        * @param collection The collection to iterate over.
        * @param callback The function called per iteration.
        * @param accumulator Initial value of the accumulator.
        * @return The accumulated value.
        **/
        reduceRight<T, TResult>(
            collection: T[] | null | undefined,
            callback: MemoListIterator<T, TResult, T[]>,
            accumulator: TResult
        ): TResult;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T, TResult>(
            collection: List<T> | null | undefined,
            callback: MemoListIterator<T, TResult, List<T>>,
            accumulator: TResult
        ): TResult;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T extends object, TResult>(
            collection: T | null | undefined,
            callback: MemoObjectIterator<T[keyof T], TResult, T>,
            accumulator: TResult
        ): TResult;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T>(
            collection: T[] | null | undefined,
            callback: MemoListIterator<T, T, T[]>
        ): T | undefined;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T>(
            collection: List<T> | null | undefined,
            callback: MemoListIterator<T, T, List<T>>
        ): T | undefined;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T extends object>(
            collection: T | null | undefined,
            callback: MemoObjectIterator<T[keyof T], T[keyof T], T>
        ): T[keyof T] | undefined;
    }

    interface LoDashImplicitWrapper<TValue> {
         /**
        * @see _.reduceRight
        **/
        reduceRight<T, TResult>(
            this: LoDashImplicitWrapper<T[] | null | undefined>,
            callback: MemoListIterator<T, TResult, T[]>,
            accumulator: TResult
        ): TResult;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T, TResult>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            callback: MemoListIterator<T, TResult, List<T>>,
            accumulator: TResult
        ): TResult;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T extends object, TResult>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            callback: MemoObjectIterator<T[keyof T], TResult, T>,
            accumulator: TResult
        ): TResult;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T>(
            this: LoDashImplicitWrapper<T[] | null | undefined>,
            callback: MemoListIterator<T, T, T[]>
        ): T | undefined;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            callback: MemoListIterator<T, T, List<T>>
        ): T | undefined;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            callback: MemoObjectIterator<T[keyof T], T[keyof T], T>
        ): T[keyof T] | undefined;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
        * @see _.reduceRight
        **/
        reduceRight<T, TResult>(
            this: LoDashExplicitWrapper<T[] | null | undefined>,
            callback: MemoListIterator<T, TResult, T[]>,
            accumulator: TResult
        ): LoDashExplicitWrapper<TResult>;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T, TResult>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            callback: MemoListIterator<T, TResult, List<T>>,
            accumulator: TResult
        ): LoDashExplicitWrapper<TResult>;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T extends object, TResult>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            callback: MemoObjectIterator<T[keyof T], TResult, T>,
            accumulator: TResult
        ): LoDashExplicitWrapper<TResult>;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T>(
            this: LoDashExplicitWrapper<T[] | null | undefined>,
            callback: MemoListIterator<T, T, T[]>
        ): LoDashExplicitWrapper<T | undefined>;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            callback: MemoListIterator<T, T, List<T>>
        ): LoDashExplicitWrapper<T | undefined>;

        /**
        * @see _.reduceRight
        **/
        reduceRight<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            callback: MemoObjectIterator<T[keyof T], T[keyof T], T>
        ): LoDashExplicitWrapper<T[keyof T] | undefined>;
    }

    // reject

    interface LoDashStatic {
        /**
         * The opposite of _.filter; this method returns the elements of collection that predicate does not return
         * truthy for.
         *
         * @param collection The collection to iterate over.
         * @param predicate The function invoked per iteration.
         * @return Returns the new filtered array.
         */
        reject(
            collection: string | null | undefined,
            predicate?: StringIterator<boolean>
        ): string[];

        /**
         * @see _.reject
         */
        reject<T>(
            collection: List<T> | null | undefined,
            predicate?: ListIterateeCustom<T, boolean>
        ): T[];

        /**
         * @see _.reject
         */
        reject<T extends object>(
            collection: T | null | undefined,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): Array<T[keyof T]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.reject
         */
        reject(
            this: LoDashImplicitWrapper<string | null | undefined>,
            predicate?: StringIterator<boolean>
        ): LoDashImplicitWrapper<string[]>;

        /**
         * @see _.reject
         */
        reject<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>
        ): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.reject
         */
        reject<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): LoDashImplicitWrapper<Array<T[keyof T]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.reject
         */
        reject(
            this: LoDashExplicitWrapper<string | null | undefined>,
            predicate?: StringIterator<boolean>
        ): LoDashExplicitWrapper<string[]>;

        /**
         * @see _.reject
         */
        reject<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>
        ): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.reject
         */
        reject<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): LoDashExplicitWrapper<Array<T[keyof T]>>;
    }

    // sample

    interface LoDashStatic {
        /**
         * Gets a random element from collection.
         *
         * @param collection The collection to sample.
         * @return Returns the random element.
         */
        sample<T>(
            collection: List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined
        ): T | undefined;

        /**
         * @see _.sample
         */
        sample<T extends object>(
            collection: T | null | undefined
        ): T[keyof T] | undefined;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.sample
         */
        sample<T>(
            this: LoDashImplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>
        ): T | undefined;

        /**
         * @see _.sample
         */
        sample<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>
        ): T[keyof T] | undefined;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.sample
         */
        sample<T>(
            this: LoDashExplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>
        ): LoDashExplicitWrapper<T | undefined>;

        /**
         * @see _.sample
         */
        sample<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>
        ): LoDashExplicitWrapper<T[keyof T] | undefined>;
    }

    // sampleSize

    interface LoDashStatic {
        /**
         * Gets n random elements at unique keys from collection up to the size of collection.
         *
         * @param collection The collection to sample.
         * @param n The number of elements to sample.
         * @return Returns the random elements.
         */
        sampleSize<T>(
            collection: List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined,
            n?: number
        ): T[];

        /**
         * @see _.sampleSize
         */
        sampleSize<T extends object>(
            collection: T | null | undefined,
            n?: number
        ): Array<T[keyof T]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.sampleSize
         */
        sampleSize<T>(
            this: LoDashImplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            n?: number
        ): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.sampleSize
         */
        sampleSize<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            n?: number
        ): LoDashImplicitWrapper<Array<T[keyof T]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.sampleSize
         */
        sampleSize<T>(
            this: LoDashExplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            n?: number
        ): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.sampleSize
         */
        sampleSize<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            n?: number
        ): LoDashExplicitWrapper<Array<T[keyof T]>>;
    }

    // shuffle

    interface LoDashStatic {
        /**
         * Creates an array of shuffled values, using a version of the Fisher-Yates shuffle.
         *
         * @param collection The collection to shuffle.
         * @return Returns the new shuffled array.
         */
        shuffle<T>(collection: List<T> | null | undefined): T[];

        /**
         * @see _.shuffle
         */
        shuffle<T extends object>(collection: T | null | undefined): Array<T[keyof T]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.shuffle
         */
        shuffle<T>(this: LoDashImplicitWrapper<List<T> | null | undefined>): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.shuffle
         */
        shuffle<T extends object>(this: LoDashImplicitWrapper<T | null | undefined>): LoDashImplicitWrapper<Array<T[keyof T]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.shuffle
         */
        shuffle<T>(this: LoDashExplicitWrapper<List<T> | null | undefined>): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.shuffle
         */
        shuffle<T extends object>(this: LoDashExplicitWrapper<T | null | undefined>): LoDashExplicitWrapper<Array<T[keyof T]>>;
    }

    // size

    interface LoDashStatic {
        /**
         * Gets the size of collection by returning its length for array-like values or the number of own enumerable
         * properties for objects.
         *
         * @param collection The collection to inspect.
         * @return Returns the size of collection.
         */
        size(collection: object | string | null | undefined): number;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.size
         */
        size(): number;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.size
         */
        size(): LoDashExplicitWrapper<number>;
    }

    // some

    interface LoDashStatic {
        /**
         * Checks if predicate returns truthy for any element of collection. Iteration is stopped once predicate
         * returns truthy. The predicate is invoked with three arguments: (value, index|key, collection).
         *
         * @param collection The collection to iterate over.
         * @param predicate The function invoked per iteration.
         * @return Returns true if any element passes the predicate check, else false.
         */
        some<T>(
            collection: List<T> | null | undefined,
            predicate?: ListIterateeCustom<T, boolean>
        ): boolean;

        /**
         * @see _.some
         */
        some<T extends object>(
            collection: T | null | undefined,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.some
         */
        some<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>
        ): boolean;

        /**
         * @see _.some
         */
        some<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): boolean;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.some
         */
        some<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            predicate?: ListIterateeCustom<T, boolean>
        ): LoDashExplicitWrapper<boolean>;

        /**
         * @see _.some
         */
        some<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate?: ObjectIterateeCustom<T, boolean>
        ): LoDashExplicitWrapper<boolean>;
    }

    // sortBy

    interface LoDashStatic {
        /**
         * Creates an array of elements, sorted in ascending order by the results of
         * running each element in a collection through each iteratee. This method
         * performs a stable sort, that is, it preserves the original sort order of
         * equal elements. The iteratees are invoked with one argument: (value).
         *
         * @category Collection
         * @param collection The collection to iterate over.
         * @param [iteratees=[_.identity]]
         *  The iteratees to sort by, specified individually or in arrays.
         * @returns Returns the new sorted array.
         * @example
         *
         * var users = [
         *   { 'user': 'fred',   'age': 48 },
         *   { 'user': 'barney', 'age': 36 },
         *   { 'user': 'fred',   'age': 42 },
         *   { 'user': 'barney', 'age': 34 }
         * ];
         *
         * _.sortBy(users, function(o) { return o.user; });
         * // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 42]]
         *
         * _.sortBy(users, ['user', 'age']);
         * // => objects for [['barney', 34], ['barney', 36], ['fred', 42], ['fred', 48]]
         *
         * _.sortBy(users, 'user', function(o) {
         *   return Math.floor(o.age / 10);
         * });
         * // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 42]]
         */
        sortBy<T>(
            collection: List<T> | null | undefined,
            ...iteratees: Array<Many<ListIteratee<T>>>
        ): T[];

        /**
         * @see _.sortBy
         */
        sortBy<T extends object>(
            collection: T | null | undefined,
            ...iteratees: Array<Many<ObjectIteratee<T>>>
        ): Array<T[keyof T]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.sortBy
         */
        sortBy<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            ...iteratees: Array<Many<ListIteratee<T>>>
        ): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.sortBy
         */
        sortBy<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            ...iteratees: Array<Many<ObjectIteratee<T>>>
        ): LoDashImplicitWrapper<Array<T[keyof T]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.sortBy
         */
        sortBy<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            ...iteratees: Array<Many<ListIteratee<T>>>
        ): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.sortBy
         */
        sortBy<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            ...iteratees: Array<Many<ObjectIteratee<T>>>
        ): LoDashExplicitWrapper<Array<T[keyof T]>>;
    }
}
