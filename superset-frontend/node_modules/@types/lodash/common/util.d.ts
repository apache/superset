import _ = require("../index");
declare module "../index" {
    // attempt

    interface LoDashStatic {
        /**
         * Attempts to invoke func, returning either the result or the caught error object. Any additional arguments
         * are provided to func when it’s invoked.
         *
         * @param func The function to attempt.
         * @return Returns the func result or error object.
         */
        attempt<TResult>(func: (...args: any[]) => TResult, ...args: any[]): TResult|Error;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.attempt
         */
        attempt<TResult>(...args: any[]): TResult|Error;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.attempt
         */
        attempt<TResult>(...args: any[]): LoDashExplicitWrapper<TResult|Error>;
    }

    // bindAll

    interface LoDashStatic {
        /**
         * Binds methods of an object to the object itself, overwriting the existing method. Method names may be
         * specified as individual arguments or as arrays of method names. If no method names are provided all
         * enumerable function properties, own and inherited, of object are bound.
         *
         * Note: This method does not set the "length" property of bound functions.
         *
         * @param object The object to bind and assign the bound methods to.
         * @param methodNames The object method names to bind, specified as individual method names or arrays of
         * method names.
         * @return Returns object.
         */
        bindAll<T>(
            object: T,
            ...methodNames: Array<Many<string>>
        ): T;
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.bindAll
         */
        bindAll(...methodNames: Array<Many<string>>): this;
    }

    // cond

    interface LoDashStatic {
        /**
         * Creates a function that iterates over `pairs` and invokes the corresponding
         * function of the first predicate to return truthy. The predicate-function
         * pairs are invoked with the `this` binding and arguments of the created
         * function.
         *
         * @since 4.0.0
         * @category Util
         * @param pairs The predicate-function pairs.
         * @returns Returns the new composite function.
         * @example
         *
         * var func = _.cond([
         *   [_.matches({ 'a': 1 }),           _.constant('matches A')],
         *   [_.conforms({ 'b': _.isNumber }), _.constant('matches B')],
         *   [_.stubTrue,                      _.constant('no match')]
         * ]);
         *
         * func({ 'a': 1, 'b': 2 });
         * // => 'matches A'
         *
         * func({ 'a': 0, 'b': 1 });
         * // => 'matches B'
         *
         * func({ 'a': '1', 'b': '2' });
         * // => 'no match'
         */
        cond<T, R>(pairs: Array<CondPair<T, R>>): (Target: T) => R;
    }

    // conforms

    type ConformsPredicateObject<T> = {
        [P in keyof T]?: (val: T[P]) => boolean;
    };

    interface LoDashStatic {
        /**
         * Creates a function that invokes the predicate properties of `source` with the corresponding
         * property values of a given object, returning true if all predicates return truthy, else false.
         */
        conforms<T>(source: ConformsPredicateObject<T>): (value: T) => boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.conforms
         */
        conforms<T>(this: LoDashImplicitWrapper<ConformsPredicateObject<T>>): LoDashImplicitWrapper<(value: T) => boolean>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.conforms
         */
        conforms<T>(this: LoDashExplicitWrapper<ConformsPredicateObject<T>>): LoDashExplicitWrapper<(value: T) => boolean>;
    }

    // constant

    interface LoDashStatic {
        /**
         * Creates a function that returns value.
         *
         * @param value The value to return from the new function.
         * @return Returns the new function.
         */
        constant<T>(value: T): () => T;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.constant
         */
        constant(): LoDashImplicitWrapper<() => TValue>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.constant
         */
        constant(): LoDashExplicitWrapper<() => TValue>;
    }

    // defaultTo

    interface LoDashStatic {
        /**
         * Checks `value` to determine whether a default value should be returned in
         * its place. The `defaultValue` is returned if `value` is `NaN`, `null`,
         * or `undefined`.
         *
         * @param value The value to check.
         * @param defaultValue The default value.
         * @returns Returns the resolved value.
         */
        defaultTo<T>(value: T | null | undefined, defaultValue: T): T;

        /**
         * @see _.defaultTo
         */
        defaultTo<T, TDefault>(
            value: T | null | undefined,
            defaultValue: TDefault
        ): T | TDefault;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.defaultTo
         */
        defaultTo<T>(this: LoDashImplicitWrapper<T | null | undefined>, defaultValue: T): T;

        /**
         * @see _.defaultTo
         */
        defaultTo<T, TDefault>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            defaultValue: TDefault
        ): T | TDefault;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.defaultTo
         */
        defaultTo<T>(this: LoDashExplicitWrapper<T | null | undefined>, defaultValue: T): LoDashExplicitWrapper<T>;

        /**
         * @see _.defaultTo
         */
        defaultTo<T, TDefault>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            defaultValue: TDefault
        ): LoDashExplicitWrapper<T | TDefault>;
    }

    // flow

    interface LoDashStatic {
        /**
         * Creates a function that returns the result of invoking the provided functions with the this binding of the
         * created function, where each successive invocation is supplied the return value of the previous.
         *
         * @param funcs Functions to invoke.
         * @return Returns the new function.
         */
        // 0-argument first function
        flow<R1, R2>(f1: () => R1, f2: (a: R1) => R2): () => R2;
        flow<R1, R2, R3>(f1: () => R1, f2: (a: R1) => R2, f3: (a: R2) => R3): () => R3;
        flow<R1, R2, R3, R4>(f1: () => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): () => R4;
        flow<R1, R2, R3, R4, R5>(f1: () => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): () => R5;
        flow<R1, R2, R3, R4, R5, R6>(f1: () => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): () => R6;
        flow<R1, R2, R3, R4, R5, R6, R7>(f1: () => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): () => R7;
        flow<R1, R2, R3, R4, R5, R6, R7>(f1: () => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): () => any;
        // 1-argument first function
        flow<A1, R1, R2>(f1: (a1: A1) => R1, f2: (a: R1) => R2): (a1: A1) => R2;
        flow<A1, R1, R2, R3>(f1: (a1: A1) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3): (a1: A1) => R3;
        flow<A1, R1, R2, R3, R4>(f1: (a1: A1) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): (a1: A1) => R4;
        flow<A1, R1, R2, R3, R4, R5>(f1: (a1: A1) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): (a1: A1) => R5;
        flow<A1, R1, R2, R3, R4, R5, R6>(f1: (a1: A1) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): (a1: A1) => R6;
        flow<A1, R1, R2, R3, R4, R5, R6, R7>(f1: (a1: A1) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): (a1: A1) => R7;
        flow<A1, R1, R2, R3, R4, R5, R6, R7>(f1: (a1: A1) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): (a1: A1) => any;
        // 2-argument first function
        flow<A1, A2, R1, R2>(f1: (a1: A1, a2: A2) => R1, f2: (a: R1) => R2): (a1: A1, a2: A2) => R2;
        flow<A1, A2, R1, R2, R3>(f1: (a1: A1, a2: A2) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3): (a1: A1, a2: A2) => R3;
        flow<A1, A2, R1, R2, R3, R4>(f1: (a1: A1, a2: A2) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): (a1: A1, a2: A2) => R4;
        flow<A1, A2, R1, R2, R3, R4, R5>(f1: (a1: A1, a2: A2) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): (a1: A1, a2: A2) => R5;
        flow<A1, A2, R1, R2, R3, R4, R5, R6>(f1: (a1: A1, a2: A2) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): (a1: A1, a2: A2) => R6;
        flow<A1, A2, R1, R2, R3, R4, R5, R6, R7>(f1: (a1: A1, a2: A2) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): (a1: A1, a2: A2) => R7;
        flow<A1, A2, R1, R2, R3, R4, R5, R6, R7>(f1: (a1: A1, a2: A2) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): (a1: A1, a2: A2) => any;
        // 3-argument first function
        flow<A1, A2, A3, R1, R2>(f1: (a1: A1, a2: A2, a3: A3) => R1, f2: (a: R1) => R2): (a1: A1, a2: A2, a3: A3) => R2;
        flow<A1, A2, A3, R1, R2, R3>(f1: (a1: A1, a2: A2, a3: A3) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3): (a1: A1, a2: A2, a3: A3) => R3;
        flow<A1, A2, A3, R1, R2, R3, R4>(f1: (a1: A1, a2: A2, a3: A3) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): (a1: A1, a2: A2, a3: A3) => R4;
        flow<A1, A2, A3, R1, R2, R3, R4, R5>(f1: (a1: A1, a2: A2, a3: A3) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): (a1: A1, a2: A2, a3: A3) => R5;
        flow<A1, A2, A3, R1, R2, R3, R4, R5, R6>(f1: (a1: A1, a2: A2, a3: A3) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): (a1: A1, a2: A2, a3: A3) => R6;
        flow<A1, A2, A3, R1, R2, R3, R4, R5, R6, R7>(f1: (a1: A1, a2: A2, a3: A3) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): (a1: A1, a2: A2, a3: A3) => R7;
        flow<A1, A2, A3, R1, R2, R3, R4, R5, R6, R7>(f1: (a1: A1, a2: A2, a3: A3) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): (a1: A1, a2: A2, a3: A3) => any;
        // 4-argument first function
        flow<A1, A2, A3, A4, R1, R2>(f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1, f2: (a: R1) => R2): (a1: A1, a2: A2, a3: A3, a4: A4) => R2;
        flow<A1, A2, A3, A4, R1, R2, R3>(f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3): (a1: A1, a2: A2, a3: A3, a4: A4) => R3;
        flow<A1, A2, A3, A4, R1, R2, R3, R4>(f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): (a1: A1, a2: A2, a3: A3, a4: A4) => R4;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5>(f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): (a1: A1, a2: A2, a3: A3, a4: A4) => R5;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6>(f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): (a1: A1, a2: A2, a3: A3, a4: A4) => R6;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): (a1: A1, a2: A2, a3: A3, a4: A4) => R7;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): (a1: A1, a2: A2, a3: A3, a4: A4) => any;
        // any-argument first function
        flow<A1, A2, A3, A4, R1, R2>(f1: (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1, f2: (a: R1) => R2): (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R2;
        flow<A1, A2, A3, A4, R1, R2, R3>(f1: (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3): (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R3;
        flow<A1, A2, A3, A4, R1, R2, R3, R4>(f1: (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R4;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5>(f1: (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R5;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6>(f1: (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R6;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(f1: (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R7;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(f1: (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): (a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => any;
        flow(funcs: Array<Many<(...args: any[]) => any>>): (...args: any[]) => any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.flow
         */
        // 0-argument first function
        flow<R1, R2>(this: LoDashImplicitWrapper<() => R1>, f2: (a: R1) => R2): LoDashImplicitWrapper<() => R2>;
        flow<R1, R2, R3>(this: LoDashImplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashImplicitWrapper<() => R3>;
        flow<R1, R2, R3, R4>(this: LoDashImplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashImplicitWrapper<() => R4>;
        flow<R1, R2, R3, R4, R5>(this: LoDashImplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashImplicitWrapper<() => R5>;
        flow<R1, R2, R3, R4, R5, R6>(this: LoDashImplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashImplicitWrapper<() => R6>;
        flow<R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashImplicitWrapper<() => R7>;
        flow<R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashImplicitWrapper<() => any>;
        // 1-argument first function
        flow<A1, R1, R2>(this: LoDashImplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2): LoDashImplicitWrapper<(a1: A1) => R2>;
        flow<A1, R1, R2, R3>(this: LoDashImplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashImplicitWrapper<(a1: A1) => R3>;
        flow<A1, R1, R2, R3, R4>(this: LoDashImplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashImplicitWrapper<(a1: A1) => R4>;
        flow<A1, R1, R2, R3, R4, R5>(this: LoDashImplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashImplicitWrapper<(a1: A1) => R5>;
        flow<A1, R1, R2, R3, R4, R5, R6>(this: LoDashImplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashImplicitWrapper<(a1: A1) => R6>;
        flow<A1, R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashImplicitWrapper<(a1: A1) => R7>;
        flow<A1, R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashImplicitWrapper<(a1: A1) => any>;
        // 2-argument first function
        flow<A1, A2, R1, R2>(this: LoDashImplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2): LoDashImplicitWrapper<(a1: A1, a2: A2) => R2>;
        flow<A1, A2, R1, R2, R3>(this: LoDashImplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashImplicitWrapper<(a1: A1, a2: A2) => R3>;
        flow<A1, A2, R1, R2, R3, R4>(this: LoDashImplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashImplicitWrapper<(a1: A1, a2: A2) => R4>;
        flow<A1, A2, R1, R2, R3, R4, R5>(this: LoDashImplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashImplicitWrapper<(a1: A1, a2: A2) => R5>;
        flow<A1, A2, R1, R2, R3, R4, R5, R6>(this: LoDashImplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashImplicitWrapper<(a1: A1, a2: A2) => R6>;
        flow<A1, A2, R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashImplicitWrapper<(a1: A1, a2: A2) => R7>;
        flow<A1, A2, R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashImplicitWrapper<(a1: A1, a2: A2) => any>;
        // 3-argument first function
        flow<A1, A2, A3, R1, R2>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R2>;
        flow<A1, A2, A3, R1, R2, R3>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R3>;
        flow<A1, A2, A3, R1, R2, R3, R4>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R4>;
        flow<A1, A2, A3, R1, R2, R3, R4, R5>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R5>;
        flow<A1, A2, A3, R1, R2, R3, R4, R5, R6>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R6>;
        flow<A1, A2, A3, R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R7>;
        flow<A1, A2, A3, R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => any>;
        // 4-argument first function
        flow<A1, A2, A3, A4, R1, R2>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R2>;
        flow<A1, A2, A3, A4, R1, R2, R3>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R3>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R4>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R5>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R6>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R7>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => any>;
        // any-argument first function
        flow<A1, A2, A3, A4, R1, R2>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R2>;
        flow<A1, A2, A3, A4, R1, R2, R3>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R3>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R4>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R5>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R6>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R7>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(this: LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => any>;
        flow(this: LoDashImplicitWrapper<(...args: any[]) => any>, funcs: Array<Many<(a: any) => any>>): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.flow
         */
        // 0-argument first function
        flow<R1, R2>(this: LoDashExplicitWrapper<() => R1>, f2: (a: R1) => R2): LoDashExplicitWrapper<() => R2>;
        flow<R1, R2, R3>(this: LoDashExplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashExplicitWrapper<() => R3>;
        flow<R1, R2, R3, R4>(this: LoDashExplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashExplicitWrapper<() => R4>;
        flow<R1, R2, R3, R4, R5>(this: LoDashExplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashExplicitWrapper<() => R5>;
        flow<R1, R2, R3, R4, R5, R6>(this: LoDashExplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashExplicitWrapper<() => R6>;
        flow<R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashExplicitWrapper<() => R7>;
        flow<R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<() => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashExplicitWrapper<() => any>;
        // 1-argument first function
        flow<A1, R1, R2>(this: LoDashExplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2): LoDashExplicitWrapper<(a1: A1) => R2>;
        flow<A1, R1, R2, R3>(this: LoDashExplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashExplicitWrapper<(a1: A1) => R3>;
        flow<A1, R1, R2, R3, R4>(this: LoDashExplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashExplicitWrapper<(a1: A1) => R4>;
        flow<A1, R1, R2, R3, R4, R5>(this: LoDashExplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashExplicitWrapper<(a1: A1) => R5>;
        flow<A1, R1, R2, R3, R4, R5, R6>(this: LoDashExplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashExplicitWrapper<(a1: A1) => R6>;
        flow<A1, R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashExplicitWrapper<(a1: A1) => R7>;
        flow<A1, R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<(a1: A1) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashExplicitWrapper<(a1: A1) => any>;
        // 2-argument first function
        flow<A1, A2, R1, R2>(this: LoDashExplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2): LoDashExplicitWrapper<(a1: A1, a2: A2) => R2>;
        flow<A1, A2, R1, R2, R3>(this: LoDashExplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashExplicitWrapper<(a1: A1, a2: A2) => R3>;
        flow<A1, A2, R1, R2, R3, R4>(this: LoDashExplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashExplicitWrapper<(a1: A1, a2: A2) => R4>;
        flow<A1, A2, R1, R2, R3, R4, R5>(this: LoDashExplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashExplicitWrapper<(a1: A1, a2: A2) => R5>;
        flow<A1, A2, R1, R2, R3, R4, R5, R6>(this: LoDashExplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashExplicitWrapper<(a1: A1, a2: A2) => R6>;
        flow<A1, A2, R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashExplicitWrapper<(a1: A1, a2: A2) => R7>;
        flow<A1, A2, R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<(a1: A1, a2: A2) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashExplicitWrapper<(a1: A1, a2: A2) => any>;
        // 3-argument first function
        flow<A1, A2, A3, R1, R2>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R2>;
        flow<A1, A2, A3, R1, R2, R3>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R3>;
        flow<A1, A2, A3, R1, R2, R3, R4>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R4>;
        flow<A1, A2, A3, R1, R2, R3, R4, R5>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R5>;
        flow<A1, A2, A3, R1, R2, R3, R4, R5, R6>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R6>;
        flow<A1, A2, A3, R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R7>;
        flow<A1, A2, A3, R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => any>;
        // 4-argument first function
        flow<A1, A2, A3, A4, R1, R2>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R2>;
        flow<A1, A2, A3, A4, R1, R2, R3>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R3>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R4>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R5>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R6>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R7>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => any>;
        // any-argument first function
        flow<A1, A2, A3, A4, R1, R2>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R2>;
        flow<A1, A2, A3, A4, R1, R2, R3>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R3>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R4>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R5>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R6>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R7>;
        flow<A1, A2, A3, A4, R1, R2, R3, R4, R5, R6, R7>(this: LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => R1>, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...funcs: Array<Many<(a: any) => any>>): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4, ...args: any[]) => any>;
        flow(this: LoDashExplicitWrapper<(...args: any[]) => any>, funcs: Array<Many<(a: any) => any>>): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // flowRight

    interface LoDashStatic {
        /**
         * This method is like _.flow except that it creates a function that invokes the provided functions from right
         * to left.
         *
         * @param funcs Functions to invoke.
         * @return Returns the new function.
         */
        // 0-argument first function
        flowRight<R2, R1>(f2: (a: R1) => R2, f1: () => R1): () => R2;
        flowRight<R3, R2, R1>(f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): () => R3;
        flowRight<R4, R3, R2, R1>(f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): () => R4;
        flowRight<R5, R4, R3, R2, R1>(f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): () => R5;
        flowRight<R6, R5, R4, R3, R2, R1>(f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): () => R6;
        flowRight<R7, R6, R5, R4, R3, R2, R1>(f7: (a: R6) => R7, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): () => R7;
        // 1-argument first function
        flowRight<A1, R2, R1>(f2: (a: R1) => R2, f1: (a1: A1) => R1): (a1: A1) => R2;
        flowRight<A1, R3, R2, R1>(f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): (a1: A1) => R3;
        flowRight<A1, R4, R3, R2, R1>(f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): (a1: A1) => R4;
        flowRight<A1, R5, R4, R3, R2, R1>(f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): (a1: A1) => R5;
        flowRight<A1, R6, R5, R4, R3, R2, R1>(f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): (a1: A1) => R6;
        flowRight<A1, R7, R6, R5, R4, R3, R2, R1>(f7: (a: R6) => R7, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): (a1: A1) => R7;
        // 2-argument first function
        flowRight<A1, A2, R2, R1>(f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): (a1: A1, a2: A2) => R2;
        flowRight<A1, A2, R3, R2, R1>(f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): (a1: A1, a2: A2) => R3;
        flowRight<A1, A2, R4, R3, R2, R1>(f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): (a1: A1, a2: A2) => R4;
        flowRight<A1, A2, R5, R4, R3, R2, R1>(f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): (a1: A1, a2: A2) => R5;
        flowRight<A1, A2, R6, R5, R4, R3, R2, R1>(f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): (a1: A1, a2: A2) => R6;
        flowRight<A1, A2, R7, R6, R5, R4, R3, R2, R1>(f7: (a: R6) => R7, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): (a1: A1, a2: A2) => R7;
        // 3-argument first function
        flowRight<A1, A2, A3, R2, R1>(f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): (a1: A1, a2: A2, a3: A3) => R2;
        flowRight<A1, A2, A3, R3, R2, R1>(f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): (a1: A1, a2: A2, a3: A3) => R3;
        flowRight<A1, A2, A3, R4, R3, R2, R1>(f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): (a1: A1, a2: A2, a3: A3) => R4;
        flowRight<A1, A2, A3, R5, R4, R3, R2, R1>(f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): (a1: A1, a2: A2, a3: A3) => R5;
        flowRight<A1, A2, A3, R6, R5, R4, R3, R2, R1>(f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): (a1: A1, a2: A2, a3: A3) => R6;
        flowRight<A1, A2, A3, R7, R6, R5, R4, R3, R2, R1>(f7: (a: R6) => R7, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): (a1: A1, a2: A2, a3: A3) => R7;
        // 4-argument first function
        flowRight<A1, A2, A3, A4, R2, R1>(f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): (a1: A1, a2: A2, a3: A3, a4: A4) => R2;
        flowRight<A1, A2, A3, A4, R3, R2, R1>(f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): (a1: A1, a2: A2, a3: A3, a4: A4) => R3;
        flowRight<A1, A2, A3, A4, R4, R3, R2, R1>(f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): (a1: A1, a2: A2, a3: A3, a4: A4) => R4;
        flowRight<A1, A2, A3, A4, R5, R4, R3, R2, R1>(f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): (a1: A1, a2: A2, a3: A3, a4: A4) => R5;
        flowRight<A1, A2, A3, A4, R6, R5, R4, R3, R2, R1>(f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): (a1: A1, a2: A2, a3: A3, a4: A4) => R6;
        flowRight<A1, A2, A3, A4, R7, R6, R5, R4, R3, R2, R1>(f7: (a: R6) => R7, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): (a1: A1, a2: A2, a3: A3, a4: A4) => R7;
        // any-argument first function
        flowRight<R2, R1>(f2: (a: R1) => R2, f1: (...args: any[]) => R1): (...args: any[]) => R2;
        flowRight<R3, R2, R1>(f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): (...args: any[]) => R3;
        flowRight<R4, R3, R2, R1>(f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): (...args: any[]) => R4;
        flowRight<R5, R4, R3, R2, R1>(f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): (...args: any[]) => R5;
        flowRight<R6, R5, R4, R3, R2, R1>(f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): (...args: any[]) => R6;
        flowRight<R7, R6, R5, R4, R3, R2, R1>(f7: (a: R6) => R7, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): (...args: any[]) => R7;
        flowRight(f7: (a: any) => any, f6: (a: any) => any, f5: (a: any) => any, f4: (a: any) => any, f3: (a: any) => any, f2: (a: any) => any, f1: () => any, ...funcs: Array<Many<(...args: any[]) => any>>): (...args: any[]) => any;
        flowRight(funcs: Array<Many<(...args: any[]) => any>>): (...args: any[]) => any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.flowRight
         */
        // 0-argument first function
        flowRight<R2, R1>(this: LoDashImplicitWrapper<(a: R1) => R2>, f1: () => R1): LoDashImplicitWrapper<() => R2>;
        flowRight<R3, R2, R1>(this: LoDashImplicitWrapper<(a: R2) => R3>, f2: (a: R1) => R2, f1: () => R1): LoDashImplicitWrapper<() => R3>;
        flowRight<R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R3) => R4>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): LoDashImplicitWrapper<() => R4>;
        flowRight<R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R4) => R5>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): LoDashImplicitWrapper<() => R5>;
        flowRight<R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R5) => R6>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): LoDashImplicitWrapper<() => R6>;
        flowRight<R7, R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R6) => R7>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): LoDashImplicitWrapper<() => R7>;
        // 1-argument first function
        flowRight<A1, R2, R1>(this: LoDashImplicitWrapper<(a: R1) => R2>, f1: (a1: A1) => R1): LoDashImplicitWrapper<(a1: A1) => R2>;
        flowRight<A1, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R2) => R3>, f2: (a: R1) => R2, f1: (a1: A1) => R1): LoDashImplicitWrapper<(a1: A1) => R3>;
        flowRight<A1, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R3) => R4>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): LoDashImplicitWrapper<(a1: A1) => R4>;
        flowRight<A1, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R4) => R5>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): LoDashImplicitWrapper<(a1: A1) => R5>;
        flowRight<A1, R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R5) => R6>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): LoDashImplicitWrapper<(a1: A1) => R6>;
        flowRight<A1, R7, R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R6) => R7>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): LoDashImplicitWrapper<(a1: A1) => R7>;
        // 2-argument first function
        flowRight<A1, A2, R2, R1>(this: LoDashImplicitWrapper<(a: R1) => R2>, f1: (a1: A1, a2: A2) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2) => R2>;
        flowRight<A1, A2, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R2) => R3>, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2) => R3>;
        flowRight<A1, A2, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R3) => R4>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2) => R4>;
        flowRight<A1, A2, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R4) => R5>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2) => R5>;
        flowRight<A1, A2, R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R5) => R6>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2) => R6>;
        flowRight<A1, A2, R7, R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R6) => R7>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2) => R7>;
        // 3-argument first function
        flowRight<A1, A2, A3, R2, R1>(this: LoDashImplicitWrapper<(a: R1) => R2>, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R2>;
        flowRight<A1, A2, A3, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R2) => R3>, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R3>;
        flowRight<A1, A2, A3, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R3) => R4>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R4>;
        flowRight<A1, A2, A3, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R4) => R5>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R5>;
        flowRight<A1, A2, A3, R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R5) => R6>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R6>;
        flowRight<A1, A2, A3, R7, R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R6) => R7>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3) => R7>;
        // 4-argument first function
        flowRight<A1, A2, A3, A4, R2, R1>(this: LoDashImplicitWrapper<(a: R1) => R2>, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R2>;
        flowRight<A1, A2, A3, A4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R2) => R3>, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R3>;
        flowRight<A1, A2, A3, A4, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R3) => R4>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R4>;
        flowRight<A1, A2, A3, A4, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R4) => R5>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R5>;
        flowRight<A1, A2, A3, A4, R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R5) => R6>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R6>;
        flowRight<A1, A2, A3, A4, R7, R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R6) => R7>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashImplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R7>;
        // any-argument first function
        flowRight<R2, R1>(this: LoDashImplicitWrapper<(a: R1) => R2>, f1: (...args: any[]) => R1): LoDashImplicitWrapper<(...args: any[]) => R2>;
        flowRight<R3, R2, R1>(this: LoDashImplicitWrapper<(a: R1) => R2>, f2: (a: R1) => R2, f1: (...args: any[]) => R1): LoDashImplicitWrapper<(...args: any[]) => R3>;
        flowRight<R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R1) => R2>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): LoDashImplicitWrapper<(...args: any[]) => R4>;
        flowRight<R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R1) => R2>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): LoDashImplicitWrapper<(...args: any[]) => R5>;
        flowRight<R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R1) => R2>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): LoDashImplicitWrapper<(...args: any[]) => R6>;
        flowRight<R7, R6, R5, R4, R3, R2, R1>(this: LoDashImplicitWrapper<(a: R1) => R2>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): LoDashImplicitWrapper<(...args: any[]) => R7>;
        flowRight(this: LoDashImplicitWrapper<(a: any) => any>, f6: (a: any) => any, f5: (a: any) => any, f4: (a: any) => any, f3: (a: any) => any, f2: (a: any) => any, f1: () => any, ...funcs: Array<Many<(...args: any[]) => any>>): LoDashImplicitWrapper<(...args: any[]) => any>;
        flowRight(this: LoDashImplicitWrapper<(a: any) => any>, funcs: Array<Many<(...args: any[]) => any>>): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.flowRight
         */
        // 0-argument first function
        flowRight<R2, R1>(this: LoDashExplicitWrapper<(a: R1) => R2>, f1: () => R1): LoDashExplicitWrapper<() => R2>;
        flowRight<R3, R2, R1>(this: LoDashExplicitWrapper<(a: R2) => R3>, f2: (a: R1) => R2, f1: () => R1): LoDashExplicitWrapper<() => R3>;
        flowRight<R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R3) => R4>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): LoDashExplicitWrapper<() => R4>;
        flowRight<R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R4) => R5>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): LoDashExplicitWrapper<() => R5>;
        flowRight<R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R5) => R6>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): LoDashExplicitWrapper<() => R6>;
        flowRight<R7, R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R6) => R7>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: () => R1): LoDashExplicitWrapper<() => R7>;
        // 1-argument first function
        flowRight<A1, R2, R1>(this: LoDashExplicitWrapper<(a: R1) => R2>, f1: (a1: A1) => R1): LoDashExplicitWrapper<(a1: A1) => R2>;
        flowRight<A1, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R2) => R3>, f2: (a: R1) => R2, f1: (a1: A1) => R1): LoDashExplicitWrapper<(a1: A1) => R3>;
        flowRight<A1, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R3) => R4>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): LoDashExplicitWrapper<(a1: A1) => R4>;
        flowRight<A1, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R4) => R5>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): LoDashExplicitWrapper<(a1: A1) => R5>;
        flowRight<A1, R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R5) => R6>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): LoDashExplicitWrapper<(a1: A1) => R6>;
        flowRight<A1, R7, R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R6) => R7>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1) => R1): LoDashExplicitWrapper<(a1: A1) => R7>;
        // 2-argument first function
        flowRight<A1, A2, R2, R1>(this: LoDashExplicitWrapper<(a: R1) => R2>, f1: (a1: A1, a2: A2) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2) => R2>;
        flowRight<A1, A2, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R2) => R3>, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2) => R3>;
        flowRight<A1, A2, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R3) => R4>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2) => R4>;
        flowRight<A1, A2, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R4) => R5>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2) => R5>;
        flowRight<A1, A2, R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R5) => R6>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2) => R6>;
        flowRight<A1, A2, R7, R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R6) => R7>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2) => R7>;
        // 3-argument first function
        flowRight<A1, A2, A3, R2, R1>(this: LoDashExplicitWrapper<(a: R1) => R2>, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R2>;
        flowRight<A1, A2, A3, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R2) => R3>, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R3>;
        flowRight<A1, A2, A3, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R3) => R4>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R4>;
        flowRight<A1, A2, A3, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R4) => R5>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R5>;
        flowRight<A1, A2, A3, R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R5) => R6>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R6>;
        flowRight<A1, A2, A3, R7, R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R6) => R7>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3) => R7>;
        // 4-argument first function
        flowRight<A1, A2, A3, A4, R2, R1>(this: LoDashExplicitWrapper<(a: R1) => R2>, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R2>;
        flowRight<A1, A2, A3, A4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R2) => R3>, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R3>;
        flowRight<A1, A2, A3, A4, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R3) => R4>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R4>;
        flowRight<A1, A2, A3, A4, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R4) => R5>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R5>;
        flowRight<A1, A2, A3, A4, R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R5) => R6>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R6>;
        flowRight<A1, A2, A3, A4, R7, R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R6) => R7>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (a1: A1, a2: A2, a3: A3, a4: A4) => R1): LoDashExplicitWrapper<(a1: A1, a2: A2, a3: A3, a4: A4) => R7>;
        // any-argument first function
        flowRight<R2, R1>(this: LoDashExplicitWrapper<(a: R1) => R2>, f1: (...args: any[]) => R1): LoDashExplicitWrapper<(...args: any[]) => R2>;
        flowRight<R3, R2, R1>(this: LoDashExplicitWrapper<(a: R1) => R2>, f2: (a: R1) => R2, f1: (...args: any[]) => R1): LoDashExplicitWrapper<(...args: any[]) => R3>;
        flowRight<R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R1) => R2>, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): LoDashExplicitWrapper<(...args: any[]) => R4>;
        flowRight<R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R1) => R2>, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): LoDashExplicitWrapper<(...args: any[]) => R5>;
        flowRight<R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R1) => R2>, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): LoDashExplicitWrapper<(...args: any[]) => R6>;
        flowRight<R7, R6, R5, R4, R3, R2, R1>(this: LoDashExplicitWrapper<(a: R1) => R2>, f6: (a: R5) => R6, f5: (a: R4) => R5, f4: (a: R3) => R4, f3: (a: R2) => R3, f2: (a: R1) => R2, f1: (...args: any[]) => R1): LoDashExplicitWrapper<(...args: any[]) => R7>;
        flowRight(this: LoDashExplicitWrapper<(a: any) => any>, f6: (a: any) => any, f5: (a: any) => any, f4: (a: any) => any, f3: (a: any) => any, f2: (a: any) => any, f1: () => any, ...funcs: Array<Many<(...args: any[]) => any>>): LoDashExplicitWrapper<(...args: any[]) => any>;
        flowRight(this: LoDashExplicitWrapper<(a: any) => any>, funcs: Array<Many<(...args: any[]) => any>>): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // identity

    interface LoDashStatic {
        /**
         * This method returns the first argument provided to it.
         *
         * @param value Any value.
         * @return Returns value.
         */
        identity<T>(value: T): T;

        /**
         * @see _.identity
         */
        identity(): undefined;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.identity
         */
        identity(): TValue;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.identity
         */
        identity(): this;
    }

    // iteratee

    interface LoDashStatic {
        /**
         * Creates a function that invokes `func` with the arguments of the created
         * function. If `func` is a property name the created callback returns the
         * property value for a given element. If `func` is an object the created
         * callback returns `true` for elements that contain the equivalent object properties, otherwise it returns `false`.
         *
         * @category Util
         * @param [func=_.identity] The value to convert to a callback.
         * @returns Returns the callback.
         * @example
         *
         * var users = [
         *   { 'user': 'barney', 'age': 36 },
         *   { 'user': 'fred',   'age': 40 }
         * ];
         *
         * // create custom iteratee shorthands
         * _.iteratee = _.wrap(_.iteratee, function(callback, func) {
         *   var p = /^(\S+)\s*([<>])\s*(\S+)$/.exec(func);
         *   return !p ? callback(func) : function(object) {
         *     return (p[2] == '>' ? object[p[1]] > p[3] : object[p[1]] < p[3]);
         *   };
         * });
         *
         * _.filter(users, 'age > 36');
         * // => [{ 'user': 'fred', 'age': 40 }]
         */
        iteratee<TFunction extends (...args: any[]) => any>(
            func: TFunction
        ): TFunction;

        /**
         * @see _.iteratee
         */
        // tslint:disable-next-line:unified-signatures Tests fail in TS2.3 if the overloads are joined
        iteratee(
            func: string | object
        ): (...args: any[]) => any;

        /**
         * @see _.iteratee
         */
        iteratee(): typeof _.identity; // tslint:disable-line:no-unnecessary-qualifier
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.iteratee
         */
        iteratee<TFunction extends (...args: any[]) => any>(
            this: LoDashImplicitWrapper<TFunction | string | object>
        ): LoDashImplicitWrapper<TFunction>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.iteratee
         */
        iteratee<TFunction extends (...args: any[]) => any>(
            this: LoDashExplicitWrapper<TFunction | string | object>
        ): LoDashExplicitWrapper<TFunction>;
    }

    // matches

    interface LoDashStatic {
        /**
         * Creates a function that performs a deep comparison between a given object and source, returning true if the
         * given object has equivalent property values, else false.
         *
         * Note: This method supports comparing arrays, booleans, Date objects, numbers, Object objects, regexes, and
         * strings. Objects are compared by their own, not inherited, enumerable properties. For comparing a single own
         * or inherited property value see _.matchesProperty.
         *
         * @param source The object of property values to match.
         * @return Returns the new function.
         */
        matches<T>(source: T): (value: any) => boolean;

        /**
         * @see _.matches
         */
        matches<T, V>(source: T): (value: V) => boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.matches
         */
        matches<V>(): LoDashImplicitWrapper<(value: V) => boolean>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.matches
         */
        matches<V>(): LoDashExplicitWrapper<(value: V) => boolean>;
    }

    // matchesProperty

    interface LoDashStatic {
        /**
         * Creates a function that compares the property value of path on a given object to value.
         *
         * Note: This method supports comparing arrays, booleans, Date objects, numbers, Object objects, regexes, and
         * strings. Objects are compared by their own, not inherited, enumerable properties.
         *
         * @param path The path of the property to get.
         * @param srcValue The value to match.
         * @return Returns the new function.
         */
        matchesProperty<T>(
            path: PropertyPath,
            srcValue: T
        ): (value: any) => boolean;

        /**
         * @see _.matchesProperty
         */
        matchesProperty<T, V>(
            path: PropertyPath,
            srcValue: T
        ): (value: V) => boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.matchesProperty
         */
        matchesProperty<SrcValue>(
            srcValue: SrcValue
        ): LoDashImplicitWrapper<(value: any) => boolean>;

        /**
         * @see _.matchesProperty
         */
        matchesProperty<SrcValue, Value>(
            srcValue: SrcValue
        ): LoDashImplicitWrapper<(value: Value) => boolean>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.matchesProperty
         */
        matchesProperty<SrcValue>(
            srcValue: SrcValue
        ): LoDashExplicitWrapper<(value: any) => boolean>;

        /**
         * @see _.matchesProperty
         */
        matchesProperty<SrcValue, Value>(
            srcValue: SrcValue
        ): LoDashExplicitWrapper<(value: Value) => boolean>;
    }

    // method

    interface LoDashStatic {
        /**
         * Creates a function that invokes the method at path on a given object. Any additional arguments are provided
         * to the invoked method.
         *
         * @param path The path of the method to invoke.
         * @param args The arguments to invoke the method with.
         * @return Returns the new function.
         */
        method(
            path: PropertyPath,
            ...args: any[]
        ): (object: any) => any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.method
         */
        method(...args: any[]): LoDashImplicitWrapper<(object: any) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.method
         */
        method(...args: any[]): LoDashExplicitWrapper<(object: any) => any>;
    }

    // methodOf

    interface LoDashStatic {
        /**
         * The opposite of _.method; this method creates a function that invokes the method at a given path on object.
         * Any additional arguments are provided to the invoked method.
         *
         * @param object The object to query.
         * @param args The arguments to invoke the method with.
         * @return Returns the new function.
         */
        methodOf(
            object: object,
            ...args: any[]
        ): (path: PropertyPath) => any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.methodOf
         */
        methodOf(
            ...args: any[]
        ): LoDashImplicitWrapper<(path: PropertyPath) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.methodOf
         */
        methodOf(
            ...args: any[]
        ): LoDashExplicitWrapper<(path: PropertyPath) => any>;
    }

    // mixin

    interface MixinOptions {
        chain?: boolean;
    }

    interface LoDashStatic {
        /**
         * Adds all own enumerable function properties of a source object to the destination object. If object is a
         * function then methods are added to its prototype as well.
         *
         * Note: Use _.runInContext to create a pristine lodash function to avoid conflicts caused by modifying
         * the original.
         *
         * @param object The destination object.
         * @param source The object of functions to add.
         * @param options The options object.
         * @param options.chain Specify whether the functions added are chainable.
         * @return Returns object.
         */
        mixin<TObject>(
            object: TObject,
            source: Dictionary<(...args: any[]) => any>,
            options?: MixinOptions
        ): TObject;

        /**
         * @see _.mixin
         */
        mixin<TResult>(
            source: Dictionary<(...args: any[]) => any>,
            options?: MixinOptions
        ): LoDashStatic;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.mixin
         */
        mixin(
            source: Dictionary<(...args: any[]) => any>,
            options?: MixinOptions
        ): this;

        /**
         * @see _.mixin
         */
        mixin(
            options?: MixinOptions
        ): LoDashImplicitWrapper<LoDashStatic>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.mixin
         */
        mixin(
            source: Dictionary<(...args: any[]) => any>,
            options?: MixinOptions
        ): this;

        /**
         * @see _.mixin
         */
        mixin(
            options?: MixinOptions
        ): LoDashExplicitWrapper<LoDashStatic>;
    }

    // noConflict

    interface LoDashStatic {
        /**
         * Reverts the _ variable to its previous value and returns a reference to the lodash function.
         *
         * @return Returns the lodash function.
         */
        noConflict(): typeof _;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.noConflict
         */
        noConflict(): typeof _;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.noConflict
         */
        noConflict(): LoDashExplicitWrapper<typeof _>;
    }

    // noop

    interface LoDashStatic {
        /**
         * A no-operation function that returns undefined regardless of the arguments it receives.
         *
         * @return undefined
         */
        noop(...args: any[]): void;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.noop
         */
        noop(...args: any[]): void;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.noop
         */
        noop(...args: any[]): LoDashExplicitWrapper<undefined>;
    }

    // nthArg

    interface LoDashStatic {
        /**
         * Creates a function that returns its nth argument.
         *
         * @param n The index of the argument to return.
         * @return Returns the new function.
         */
        nthArg(n?: number): (...args: any[]) => any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.nthArg
         */
        nthArg(): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.nthArg
         */
        nthArg(): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // over

    interface LoDashStatic {
        /**
         * Creates a function that invokes iteratees with the arguments provided to the created function and returns
         * their results.
         *
         * @param iteratees The iteratees to invoke.
         * @return Returns the new function.
         */
        over<TResult>(...iteratees: Array<Many<(...args: any[]) => TResult>>): (...args: any[]) => TResult[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.over
         */
        over<TResult>(
            this: LoDashImplicitWrapper<Many<(...args: any[]) => TResult>>,
            ...iteratees: Array<Many<(...args: any[]) => TResult>>
        ): LoDashImplicitWrapper<(...args: any[]) => TResult[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.over
         */
        over<TResult>(
            this: LoDashExplicitWrapper<Many<(...args: any[]) => TResult>>,
            ...iteratees: Array<Many<(...args: any[]) => TResult>>
        ): LoDashExplicitWrapper<(...args: any[]) => TResult[]>;
    }

    // overEvery

    interface LoDashStatic {
        /**
         * Creates a function that checks if all of the predicates return truthy when invoked with the arguments
         * provided to the created function.
         *
         * @param predicates The predicates to check.
         * @return Returns the new function.
         */
        overEvery<T, Result1 extends T, Result2 extends T>(
            a: (arg: T) => arg is Result1,
            b: (arg: T) => arg is Result2
        ): (arg: T) => arg is Result1 & Result2;
        overEvery<T>(...predicates: Array<Many<(...args: T[]) => boolean>>): (...args: T[]) => boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.overEvery
         */
        overEvery<T>(...predicates: Array<Many<(...args: T[]) => boolean>>): LoDashImplicitWrapper<(...args: T[]) => boolean>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.overEvery
         */
        overEvery<T>(...predicates: Array<Many<(...args: T[]) => boolean>>): LoDashExplicitWrapper<(...args: T[]) => boolean>;
    }

    // overSome

    interface LoDashStatic {
        /**
         * Creates a function that checks if any of the predicates return truthy when invoked with the arguments
         * provided to the created function.
         *
         * @param predicates The predicates to check.
         * @return Returns the new function.
         */
        overSome<T, Result1 extends T, Result2 extends T>(
            a: (arg: T) => arg is Result1,
            b: (arg: T) => arg is Result2
        ): (arg: T) => arg is Result1 | Result2;
        overSome<T>(...predicates: Array<Many<(...args: T[]) => boolean>>): (...args: T[]) => boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.overSome
         */
        overSome<T>(...predicates: Array<Many<(...args: T[]) => boolean>>): LoDashImplicitWrapper<(...args: T[]) => boolean>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.overSome
         */
        overSome<T>(...predicates: Array<Many<(...args: T[]) => boolean>>): LoDashExplicitWrapper<(...args: T[]) => boolean>;
    }

    // property

    interface LoDashStatic {
        /**
         * Creates a function that returns the property value at path on a given object.
         *
         * @param path The path of the property to get.
         * @return Returns the new function.
         */
        property<TObj, TResult>(path: PropertyPath): (obj: TObj) => TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.property
         */
        property<TObj, TResult>(): LoDashImplicitWrapper<(obj: TObj) => TResult>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.property
         */
        property<TObj, TResult>(): LoDashExplicitWrapper<(obj: TObj) => TResult>;
    }

    // propertyOf

    interface LoDashStatic {
        /**
         * The opposite of _.property; this method creates a function that returns the property value at a given path
         * on object.
         *
         * @param object The object to query.
         * @return Returns the new function.
         */
        propertyOf<T extends {}>(object: T): (path: PropertyPath) => any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.propertyOf
         */
        propertyOf(): LoDashImplicitWrapper<(path: PropertyPath) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.propertyOf
         */
        propertyOf(): LoDashExplicitWrapper<(path: PropertyPath) => any>;
    }

    // range

    interface LoDashStatic {
        /**
         * Creates an array of numbers (positive and/or negative) progressing from start up to, but not including, end.
         * If end is not specified it’s set to start with start then set to 0. If end is less than start a zero-length
         * range is created unless a negative step is specified.
         *
         * @param start The start of the range.
         * @param end The end of the range.
         * @param step The value to increment or decrement by.
         * @return Returns a new range array.
         */
        range(
            start: number,
            end?: number,
            step?: number
        ): number[];

        /**
         * Creates an array of numbers (positive and/or negative) progressing from start up to, but not including, end.
         * If end is not specified it’s set to start with start then set to 0. If end is less than start a zero-length
         * range is created unless a negative step is specified.
         *
         * @param start The start of the range.
         * @param index Not used in this overload.
         * @param guard Enables use as an iteratee for methods like _.map. You should not pass this parameter directly in your code.
         * @return Returns a new range array.
         */
        range(
            end: number,
            index: string | number,
            guard: object
        ): number[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.range
         */
        range(
            end?: number,
            step?: number
        ): LoDashImplicitWrapper<number[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.range
         */
        range(
            end?: number,
            step?: number
        ): LoDashExplicitWrapper<number[]>;
    }

    // rangeRight

    interface LoDashStatic {
        /**
         * This method is like `_.range` except that it populates values in
         * descending order.
         *
         * @category Util
         * @param start The start of the range.
         * @param end The end of the range.
         * @param step The value to increment or decrement by.
         * @returns Returns the new array of numbers.
         * @example
         *
         * _.rangeRight(4);
         * // => [3, 2, 1, 0]
         *
         * _.rangeRight(-4);
         * // => [-3, -2, -1, 0]
         *
         * _.rangeRight(1, 5);
         * // => [4, 3, 2, 1]
         *
         * _.rangeRight(0, 20, 5);
         * // => [15, 10, 5, 0]
         *
         * _.rangeRight(0, -4, -1);
         * // => [-3, -2, -1, 0]
         *
         * _.rangeRight(1, 4, 0);
         * // => [1, 1, 1]
         *
         * _.rangeRight(0);
         * // => []
         */
        rangeRight(
            start: number,
            end?: number,
            step?: number
        ): number[];

        /**
         * This method is like _.range except that it populates values in
         * descending order.
         *
         * @param start The start of the range.
         * @param index Not used in this overload.
         * @param guard Enables use as an iteratee for methods like _.map. You should not pass this parameter directly in your code.
         * @return Returns a new range array.
         */
        rangeRight(
            end: number,
            index: string | number,
            guard: object
        ): number[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.rangeRight
         */
        rangeRight(
            end?: number,
            step?: number
        ): LoDashImplicitWrapper<number[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.rangeRight
         */
        rangeRight(
            end?: number,
            step?: number
        ): LoDashExplicitWrapper<number[]>;
    }

    // runInContext

    interface LoDashStatic {
        /**
         * Create a new pristine lodash function using the given context object.
         *
         * @param context The context object.
         * @return Returns a new lodash function.
         */
        runInContext(context?: object): LoDashStatic;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.runInContext
         */
        runInContext(): LoDashStatic;
    }

    // stubArray

    interface LoDashStatic {
        /**
         * This method returns a new empty array.
         *
         * @returns Returns the new empty array.
         */
        stubArray(): any[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.stubArray
         */
        stubArray(): any[];
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.stubArray
         */
        stubArray(): LoDashExplicitWrapper<any[]>;
    }

    // stubFalse

    interface LoDashStatic {
        /**
         * This method returns `false`.
         *
         * @returns Returns `false`.
         */
        stubFalse(): false;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.stubFalse
         */
        stubFalse(): false;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.stubFalse
         */
        stubFalse(): LoDashExplicitWrapper<false>;
    }

    // stubObject

    interface LoDashStatic {
        /**
         * This method returns a new empty object.
         *
         * @returns Returns the new empty object.
         */
        stubObject(): any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.stubObject
         */
        stubObject(): any;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.stubObject
         */
        stubObject(): LoDashExplicitWrapper<any>;
    }

    // stubString

    interface LoDashStatic {
        /**
         * This method returns an empty string.
         *
         * @returns Returns the empty string.
         */
        stubString(): string;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.stubString
         */
        stubString(): string;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.stubString
         */
        stubString(): LoDashExplicitWrapper<string>;
    }

    // stubTrue

    interface LoDashStatic {
        /**
         * This method returns `true`.
         *
         * @returns Returns `true`.
         */
        stubTrue(): true;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.stubTrue
         */
        stubTrue(): true;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.stubTrue
         */
        stubTrue(): LoDashExplicitWrapper<true>;
    }

    // times

    interface LoDashStatic {
        /**
         * Invokes the iteratee function n times, returning an array of the results of each invocation. The iteratee
         * is invoked with one argument; (index).
         *
         * @param n The number of times to invoke iteratee.
         * @param iteratee The function invoked per iteration.
         * @return Returns the array of results.
         */
        times<TResult>(
            n: number,
            iteratee: (num: number) => TResult
        ): TResult[];

        /**
         * @see _.times
         */
        times(n: number): number[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.times
         */
        times<TResult>(
            iteratee: (num: number) => TResult
        ): TResult[];

        /**
         * @see _.times
         */
        times(): number[];
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.times
         */
        times<TResult>(
            iteratee: (num: number) => TResult
        ): LoDashExplicitWrapper<TResult[]>;

        /**
         * @see _.times
         */
        times(): LoDashExplicitWrapper<number[]>;
    }

    // toPath

    interface LoDashStatic {
        /**
         * Converts `value` to a property path array.
         *
         * @category Util
         * @param value The value to convert.
         * @returns Returns the new property path array.
         * @example
         *
         * _.toPath('a.b.c');
         * // => ['a', 'b', 'c']
         *
         * _.toPath('a[0].b.c');
         * // => ['a', '0', 'b', 'c']
         *
         * var path = ['a', 'b', 'c'],
         *     newPath = _.toPath(path);
         *
         * console.log(newPath);
         * // => ['a', 'b', 'c']
         *
         * console.log(path === newPath);
         * // => false
         */
        toPath(value: any): string[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.toPath
         */
        toPath(): LoDashImplicitWrapper<string[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.toPath
         */
        toPath(): LoDashExplicitWrapper<string[]>;
    }

    // uniqueId

    interface LoDashStatic {
        /**
         * Generates a unique ID. If prefix is provided the ID is appended to it.
         *
         * @param prefix The value to prefix the ID with.
         * @return Returns the unique ID.
         */
        uniqueId(prefix?: string): string;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.uniqueId
         */
        uniqueId(): string;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.uniqueId
         */
        uniqueId(): LoDashExplicitWrapper<string>;
    }

    // stubTrue

    interface LoDashStatic {
        /**
         * This method returns true.
         *
         * @return Returns true.
         */
        stubTrue(): true;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.stubTrue
         */
        stubTrue(): true;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.stubTrue
         */
        stubTrue(): LoDashExplicitWrapper<true>;
    }

    // stubFalse

    interface LoDashStatic {
        /**
         * This method returns false.
         *
         * @return Returns false.
         */
        stubFalse(): false;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.stubFalse
         */
        stubFalse(): false;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.stubFalse
         */
        stubFalse(): LoDashExplicitWrapper<false>;
    }
}
