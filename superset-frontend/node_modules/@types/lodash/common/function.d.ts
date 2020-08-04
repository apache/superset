import _ = require("../index");
declare module "../index" {
    // after

    interface LoDashStatic {
        /**
         * The opposite of _.before; this method creates a function that invokes func once it’s called n or more times.
         *
         * @param n The number of calls before func is invoked.
         * @param func The function to restrict.
         * @return Returns the new restricted function.
         */
        after<TFunc extends (...args: any[]) => any>(
            n: number,
            func: TFunc
        ): TFunc;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
        * @see _.after
        **/
        after<TFunc extends (...args: any[]) => any>(func: TFunc): LoDashImplicitWrapper<TFunc>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.after
         **/
        after<TFunc extends (...args: any[]) => any>(func: TFunc): LoDashExplicitWrapper<TFunc>;
    }

    // ary

    interface LoDashStatic {
        /**
         * Creates a function that accepts up to n arguments ignoring any additional arguments.
         *
         * @param func The function to cap arguments for.
         * @param n The arity cap.
         * @returns Returns the new function.
         */
        ary(
            func: (...args: any[]) => any,
            n?: number
        ): (...args: any[]) => any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.ary
         */
        ary(n?: number): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.ary
         */
        ary(n?: number): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // before

    interface LoDashStatic {
        /**
         * Creates a function that invokes func, with the this binding and arguments of the created function, while
         * it’s called less than n times. Subsequent calls to the created function return the result of the last func
         * invocation.
         *
         * @param n The number of calls at which func is no longer invoked.
         * @param func The function to restrict.
         * @return Returns the new restricted function.
         */
        before<TFunc extends (...args: any[]) => any>(
            n: number,
            func: TFunc
        ): TFunc;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.before
         **/
        before<TFunc extends (...args: any[]) => any>(func: TFunc): LoDashImplicitWrapper<TFunc>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.before
         **/
        before<TFunc extends (...args: any[]) => any>(func: TFunc): LoDashExplicitWrapper<TFunc>;
    }

    // bind

    interface FunctionBind {
        placeholder: __;

        (
            func: (...args: any[]) => any,
            thisArg: any,
            ...partials: any[]
        ): (...args: any[]) => any;
    }

    interface LoDashStatic {
        /**
         * Creates a function that invokes func with the this binding of thisArg and prepends any additional _.bind
         * arguments to those provided to the bound function.
         *
         * The _.bind.placeholder value, which defaults to _ in monolithic builds, may be used as a placeholder for
         * partially applied arguments.
         *
         * Note: Unlike native Function#bind this method does not set the "length" property of bound functions.
         *
         * @param func The function to bind.
         * @param thisArg The this binding of func.
         * @param partials The arguments to be partially applied.
         * @return Returns the new bound function.
         */
        bind: FunctionBind;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.bind
         */
        bind(
            thisArg: any,
            ...partials: any[]
        ): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.bind
         */
        bind(
            thisArg: any,
            ...partials: any[]
        ): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // bindKey

    interface FunctionBindKey {
        placeholder: __;

        (
            object: object,
            key: string,
            ...partials: any[]
        ): (...args: any[]) => any;
    }

    interface LoDashStatic {
        /**
         * Creates a function that invokes the method at object[key] and prepends any additional _.bindKey arguments
         * to those provided to the bound function.
         *
         * This method differs from _.bind by allowing bound functions to reference methods that may be redefined
         * or don’t yet exist. See Peter Michaux’s article for more details.
         *
         * The _.bindKey.placeholder value, which defaults to _ in monolithic builds, may be used as a placeholder
         * for partially applied arguments.
         *
         * @param object The object the method belongs to.
         * @param key The key of the method.
         * @param partials The arguments to be partially applied.
         * @return Returns the new bound function.
         */
        bindKey: FunctionBindKey;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.bindKey
         */
        bindKey(
            key: string,
            ...partials: any[]
        ): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.bindKey
         */
        bindKey(
            key: string,
            ...partials: any[]
        ): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // curry

    interface Curry {
        /**
         * Creates a function that accepts one or more arguments of func that when called either invokes func returning
         * its result, if all func arguments have been provided, or returns a function that accepts one or more of the
         * remaining func arguments, and so on. The arity of func may be specified if func.length is not sufficient.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        <T1, R>(func: (t1: T1) => R, arity?: number):
            CurriedFunction1<T1, R>;
        /**
         * Creates a function that accepts one or more arguments of func that when called either invokes func returning
         * its result, if all func arguments have been provided, or returns a function that accepts one or more of the
         * remaining func arguments, and so on. The arity of func may be specified if func.length is not sufficient.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        <T1, T2, R>(func: (t1: T1, t2: T2) => R, arity?: number):
            CurriedFunction2<T1, T2, R>;
        /**
         * Creates a function that accepts one or more arguments of func that when called either invokes func returning
         * its result, if all func arguments have been provided, or returns a function that accepts one or more of the
         * remaining func arguments, and so on. The arity of func may be specified if func.length is not sufficient.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        <T1, T2, T3, R>(func: (t1: T1, t2: T2, t3: T3) => R, arity?: number):
            CurriedFunction3<T1, T2, T3, R>;
        /**
         * Creates a function that accepts one or more arguments of func that when called either invokes func returning
         * its result, if all func arguments have been provided, or returns a function that accepts one or more of the
         * remaining func arguments, and so on. The arity of func may be specified if func.length is not sufficient.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        <T1, T2, T3, T4, R>(func: (t1: T1, t2: T2, t3: T3, t4: T4) => R, arity?: number):
            CurriedFunction4<T1, T2, T3, T4, R>;
        /**
         * Creates a function that accepts one or more arguments of func that when called either invokes func returning
         * its result, if all func arguments have been provided, or returns a function that accepts one or more of the
         * remaining func arguments, and so on. The arity of func may be specified if func.length is not sufficient.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        <T1, T2, T3, T4, T5, R>(func: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R, arity?: number):
            CurriedFunction5<T1, T2, T3, T4, T5, R>;
        /**
         * Creates a function that accepts one or more arguments of func that when called either invokes func returning
         * its result, if all func arguments have been provided, or returns a function that accepts one or more of the
         * remaining func arguments, and so on. The arity of func may be specified if func.length is not sufficient.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        (func: (...args: any[]) => any, arity?: number): (...args: any[]) => any;

        placeholder: __;
    }

    interface LoDashStatic {
        curry: Curry;
    }

    interface CurriedFunction1<T1, R> {
        (): CurriedFunction1<T1, R>;
        (t1: T1): R;
    }

    interface CurriedFunction2<T1, T2, R> {
        (): CurriedFunction2<T1, T2, R>;
        (t1: T1): CurriedFunction1<T2, R>;
        (t1: __, t2: T2): CurriedFunction1<T1, R>;
        (t1: T1, t2: T2): R;
    }

    interface CurriedFunction3<T1, T2, T3, R> {
        (): CurriedFunction3<T1, T2, T3, R>;
        (t1: T1): CurriedFunction2<T2, T3, R>;
        (t1: __, t2: T2): CurriedFunction2<T1, T3, R>;
        (t1: T1, t2: T2): CurriedFunction1<T3, R>;
        (t1: __, t2: __, t3: T3): CurriedFunction2<T1, T2, R>;
        (t1: T1, t2: __, t3: T3): CurriedFunction1<T2, R>;
        (t1: __, t2: T2, t3: T3): CurriedFunction1<T1, R>;
        (t1: T1, t2: T2, t3: T3): R;
    }

    interface CurriedFunction4<T1, T2, T3, T4, R> {
        (): CurriedFunction4<T1, T2, T3, T4, R>;
        (t1: T1): CurriedFunction3<T2, T3, T4, R>;
        (t1: __, t2: T2): CurriedFunction3<T1, T3, T4, R>;
        (t1: T1, t2: T2): CurriedFunction2<T3, T4, R>;
        (t1: __, t2: __, t3: T3): CurriedFunction3<T1, T2, T4, R>;
        (t1: __, t2: __, t3: T3): CurriedFunction2<T2, T4, R>;
        (t1: __, t2: T2, t3: T3): CurriedFunction2<T1, T4, R>;
        (t1: T1, t2: T2, t3: T3): CurriedFunction1<T4, R>;
        (t1: __, t2: __, t3: __, t4: T4): CurriedFunction3<T1, T2, T3, R>;
        (t1: T1, t2: __, t3: __, t4: T4): CurriedFunction2<T2, T3, R>;
        (t1: __, t2: T2, t3: __, t4: T4): CurriedFunction2<T1, T3, R>;
        (t1: __, t2: __, t3: T3, t4: T4): CurriedFunction2<T1, T2, R>;
        (t1: T1, t2: T2, t3: __, t4: T4): CurriedFunction1<T3, R>;
        (t1: T1, t2: __, t3: T3, t4: T4): CurriedFunction1<T2, R>;
        (t1: __, t2: T2, t3: T3, t4: T4): CurriedFunction1<T1, R>;
        (t1: T1, t2: T2, t3: T3, t4: T4): R;
    }

    interface CurriedFunction5<T1, T2, T3, T4, T5, R> {
        (): CurriedFunction5<T1, T2, T3, T4, T5, R>;
        (t1: T1): CurriedFunction4<T2, T3, T4, T5, R>;
        (t1: __, t2: T2): CurriedFunction4<T1, T3, T4, T5, R>;
        (t1: T1, t2: T2): CurriedFunction3<T3, T4, T5, R>;
        (t1: __, t2: __, t3: T3): CurriedFunction4<T1, T2, T4, T5, R>;
        (t1: T1, t2: __, t3: T3): CurriedFunction3<T2, T4, T5, R>;
        (t1: __, t2: T2, t3: T3): CurriedFunction3<T1, T4, T5, R>;
        (t1: T1, t2: T2, t3: T3): CurriedFunction2<T4, T5, R>;
        (t1: __, t2: __, t3: __, t4: T4): CurriedFunction4<T1, T2, T3, T5, R>;
        (t1: T1, t2: __, t3: __, t4: T4): CurriedFunction3<T2, T3, T5, R>;
        (t1: __, t2: T2, t3: __, t4: T4): CurriedFunction3<T1, T3, T5, R>;
        (t1: __, t2: __, t3: T3, t4: T4): CurriedFunction3<T1, T2, T5, R>;
        (t1: T1, t2: T2, t3: __, t4: T4): CurriedFunction2<T3, T5, R>;
        (t1: T1, t2: __, t3: T3, t4: T4): CurriedFunction2<T2, T5, R>;
        (t1: __, t2: T2, t3: T3, t4: T4): CurriedFunction2<T1, T5, R>;
        (t1: T1, t2: T2, t3: T3, t4: T4): CurriedFunction1<T5, R>;
        (t1: __, t2: __, t3: __, t4: __, t5: T5): CurriedFunction4<T1, T2, T3, T4, R>;
        (t1: T1, t2: __, t3: __, t4: __, t5: T5): CurriedFunction3<T2, T3, T4, R>;
        (t1: __, t2: T2, t3: __, t4: __, t5: T5): CurriedFunction3<T1, T3, T4, R>;
        (t1: __, t2: __, t3: T3, t4: __, t5: T5): CurriedFunction3<T1, T2, T4, R>;
        (t1: __, t2: __, t3: __, t4: T4, t5: T5): CurriedFunction3<T1, T2, T3, R>;
        (t1: T1, t2: T2, t3: __, t4: __, t5: T5): CurriedFunction2<T3, T4, R>;
        (t1: T1, t2: __, t3: T3, t4: __, t5: T5): CurriedFunction2<T2, T4, R>;
        (t1: T1, t2: __, t3: __, t4: T4, t5: T5): CurriedFunction2<T2, T3, R>;
        (t1: __, t2: T2, t3: T3, t4: __, t5: T5): CurriedFunction2<T1, T4, R>;
        (t1: __, t2: T2, t3: __, t4: T4, t5: T5): CurriedFunction2<T1, T3, R>;
        (t1: __, t2: __, t3: T3, t4: T4, t5: T5): CurriedFunction2<T1, T2, R>;
        (t1: T1, t2: T2, t3: T3, t4: __, t5: T5): CurriedFunction1<T4, R>;
        (t1: T1, t2: T2, t3: __, t4: T4, t5: T5): CurriedFunction1<T3, R>;
        (t1: T1, t2: __, t3: T3, t4: T4, t5: T5): CurriedFunction1<T2, R>;
        (t1: __, t2: T2, t3: T3, t4: T4, t5: T5): CurriedFunction1<T1, R>;
        (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5): R;
    }

    interface RightCurriedFunction1<T1, R> {
        (): RightCurriedFunction1<T1, R>;
        (t1: T1): R;
    }

    interface RightCurriedFunction2<T1, T2, R> {
        (): RightCurriedFunction2<T1, T2, R>;
        (t2: T2): RightCurriedFunction1<T1, R>;
        (t1: T1, t2: __): RightCurriedFunction1<T2, R>;
        (t1: T1, t2: T2): R;
    }

    interface RightCurriedFunction3<T1, T2, T3, R> {
        (): RightCurriedFunction3<T1, T2, T3, R>;
        (t3: T3): RightCurriedFunction2<T1, T2, R>;
        (t2: T2, t3: __): RightCurriedFunction2<T1, T3, R>;
        (t2: T2, t3: T3): RightCurriedFunction1<T1, R>;
        (t1: T1, t2: __, t3: __): RightCurriedFunction2<T2, T3, R>;
        (t1: T1, t2: T2, t3: __): RightCurriedFunction1<T3, R>;
        (t1: T1, t2: __, t3: T3): RightCurriedFunction1<T2, R>;
        (t1: T1, t2: T2, t3: T3): R;
    }

    interface RightCurriedFunction4<T1, T2, T3, T4, R> {
        (): RightCurriedFunction4<T1, T2, T3, T4, R>;
        (t4: T4): RightCurriedFunction3<T1, T2, T3, R>;
        (t3: T3, t4: __): RightCurriedFunction3<T1, T2, T4, R>;
        (t3: T3, t4: T4): RightCurriedFunction2<T1, T2, R>;
        (t2: T2, t3: __, t4: __): RightCurriedFunction3<T1, T3, T4, R>;
        (t2: T2, t3: T3, t4: __): RightCurriedFunction2<T1, T4, R>;
        (t2: T2, t3: __, t4: T4): RightCurriedFunction2<T1, T3, R>;
        (t2: T2, t3: T3, t4: T4): RightCurriedFunction1<T1, R>;
        (t1: T1, t2: __, t3: __, t4: __): RightCurriedFunction3<T2, T3, T4, R>;
        (t1: T1, t2: T2, t3: __, t4: __): RightCurriedFunction2<T3, T4, R>;
        (t1: T1, t2: __, t3: T3, t4: __): RightCurriedFunction2<T2, T4, R>;
        (t1: T1, t2: __, t3: __, t4: T4): RightCurriedFunction2<T2, T3, R>;
        (t1: T1, t2: T2, t3: T3, t4: __): RightCurriedFunction1<T4, R>;
        (t1: T1, t2: T2, t3: __, t4: T4): RightCurriedFunction1<T3, R>;
        (t1: T1, t2: __, t3: T3, t4: T4): RightCurriedFunction1<T2, R>;
        (t1: T1, t2: T2, t3: T3, t4: T4): R;
    }

    interface RightCurriedFunction5<T1, T2, T3, T4, T5, R> {
        (): RightCurriedFunction5<T1, T2, T3, T4, T5, R>;
        (t5: T5): RightCurriedFunction4<T1, T2, T3, T4, R>;
        (t4: T4, t5: __): RightCurriedFunction4<T1, T2, T3, T5, R>;
        (t4: T4, t5: T5): RightCurriedFunction3<T1, T2, T3, R>;
        (t3: T3, t4: __, t5: __): RightCurriedFunction4<T1, T2, T4, T5, R>;
        (t3: T3, t4: T4, t5: __): RightCurriedFunction3<T1, T2, T5, R>;
        (t3: T3, t4: __, t5: T5): RightCurriedFunction3<T1, T2, T4, R>;
        (t3: T3, t4: T4, t5: T5): RightCurriedFunction2<T1, T2, R>;
        (t2: T2, t3: __, t4: __, t5: __): RightCurriedFunction4<T1, T3, T4, T5, R>;
        (t2: T2, t3: T3, t4: __, t5: __): RightCurriedFunction3<T1, T4, T5, R>;
        (t2: T2, t3: __, t4: T4, t5: __): RightCurriedFunction3<T1, T3, T5, R>;
        (t2: T2, t3: __, t4: __, t5: T5): RightCurriedFunction3<T1, T3, T4, R>;
        (t2: T2, t3: T3, t4: T4, t5: __): RightCurriedFunction2<T1, T5, R>;
        (t2: T2, t3: T3, t4: __, t5: T5): RightCurriedFunction2<T1, T4, R>;
        (t2: T2, t3: __, t4: T4, t5: T5): RightCurriedFunction2<T1, T3, R>;
        (t2: T2, t3: T3, t4: T4, t5: T5): RightCurriedFunction1<T1, R>;
        (t1: T1, t2: __, t3: __, t4: __, t5: __): RightCurriedFunction4<T2, T3, T4, T5, R>;
        (t1: T1, t2: T2, t3: __, t4: __, t5: __): RightCurriedFunction3<T3, T4, T5, R>;
        (t1: T1, t2: __, t3: T3, t4: __, t5: __): RightCurriedFunction3<T2, T4, T5, R>;
        (t1: T1, t2: __, t3: __, t4: T4, t5: __): RightCurriedFunction3<T2, T3, T5, R>;
        (t1: T1, t2: __, t3: __, t4: __, t5: T5): RightCurriedFunction3<T2, T3, T4, R>;
        (t1: T1, t2: T2, t3: T3, t4: __, t5: __): RightCurriedFunction2<T4, T5, R>;
        (t1: T1, t2: T2, t3: __, t4: T4, t5: __): RightCurriedFunction2<T3, T5, R>;
        (t1: T1, t2: T2, t3: __, t4: __, t5: T5): RightCurriedFunction2<T3, T4, R>;
        (t1: T1, t2: __, t3: T3, t4: T4, t5: __): RightCurriedFunction2<T2, T5, R>;
        (t1: T1, t2: __, t3: T3, t4: __, t5: T5): RightCurriedFunction2<T2, T4, R>;
        (t1: T1, t2: __, t3: __, t4: T4, t5: T5): RightCurriedFunction2<T2, T3, R>;
        (t1: T1, t2: T2, t3: T3, t4: T4, t5: __): RightCurriedFunction1<T5, R>;
        (t1: T1, t2: T2, t3: T3, t4: __, t5: T5): RightCurriedFunction1<T4, R>;
        (t1: T1, t2: T2, t3: __, t4: T4, t5: T5): RightCurriedFunction1<T3, R>;
        (t1: T1, t2: __, t3: T3, t4: T4, t5: T5): RightCurriedFunction1<T2, R>;
        (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5): R;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
        * @see _.curry
        **/
        curry<T1, R>(this: LoDashImplicitWrapper<(t1: T1) => R>, arity?: number):
            LoDashImplicitWrapper<CurriedFunction1<T1, R>>;

        /**
        * @see _.curry
        **/
        curry<T1, T2, R>(this: LoDashImplicitWrapper<(t1: T1, t2: T2) => R>, arity?: number):
            LoDashImplicitWrapper<CurriedFunction2<T1, T2, R>>;

        /**
        * @see _.curry
        **/
        curry<T1, T2, T3, R>(this: LoDashImplicitWrapper<(t1: T1, t2: T2, t3: T3) => R>, arity?: number):
            LoDashImplicitWrapper<CurriedFunction3<T1, T2, T3, R>>;

        /**
        * @see _.curry
        **/
        curry<T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<(t1: T1, t2: T2, t3: T3, t4: T4) => R>, arity?: number):
            LoDashImplicitWrapper<CurriedFunction4<T1, T2, T3, T4, R>>;

        /**
        * @see _.curry
        **/
        curry<T1, T2, T3, T4, T5, R>(this: LoDashImplicitWrapper<(t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R>, arity?: number):
            LoDashImplicitWrapper<CurriedFunction5<T1, T2, T3, T4, T5, R>>;

        /**
        * @see _.curry
        **/
        curry(arity?: number): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
        * @see _.curry
        **/
        curry<T1, R>(this: LoDashExplicitWrapper<(t1: T1) => R>):
            LoDashExplicitWrapper<CurriedFunction1<T1, R>>;

        /**
        * @see _.curry
        **/
        curry<T1, T2, R>(this: LoDashExplicitWrapper<(t1: T1, t2: T2) => R>):
            LoDashExplicitWrapper<CurriedFunction2<T1, T2, R>>;

        /**
        * @see _.curry
        **/
        curry<T1, T2, T3, R>(this: LoDashExplicitWrapper<(t1: T1, t2: T2, t3: T3) => R>):
            LoDashExplicitWrapper<CurriedFunction3<T1, T2, T3, R>>;

        /**
        * @see _.curry
        **/
        curry<T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<(t1: T1, t2: T2, t3: T3, t4: T4) => R>):
            LoDashExplicitWrapper<CurriedFunction4<T1, T2, T3, T4, R>>;

        /**
        * @see _.curry
        **/
        curry<T1, T2, T3, T4, T5, R>(this: LoDashExplicitWrapper<(t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R>):
            LoDashExplicitWrapper<CurriedFunction5<T1, T2, T3, T4, T5, R>>;

        /**
        * @see _.curry
        **/
        curry(arity?: number): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // curryRight

    interface CurryRight {
        /**
         * This method is like _.curry except that arguments are applied to func in the manner of _.partialRight
         * instead of _.partial.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        <T1, R>(func: (t1: T1) => R, arity?: number):
            RightCurriedFunction1<T1, R>;
        /**
         * This method is like _.curry except that arguments are applied to func in the manner of _.partialRight
         * instead of _.partial.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        <T1, T2, R>(func: (t1: T1, t2: T2) => R, arity?: number):
            RightCurriedFunction2<T1, T2, R>;
        /**
         * This method is like _.curry except that arguments are applied to func in the manner of _.partialRight
         * instead of _.partial.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        <T1, T2, T3, R>(func: (t1: T1, t2: T2, t3: T3) => R, arity?: number):
            RightCurriedFunction3<T1, T2, T3, R>;
        /**
         * This method is like _.curry except that arguments are applied to func in the manner of _.partialRight
         * instead of _.partial.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        <T1, T2, T3, T4, R>(func: (t1: T1, t2: T2, t3: T3, t4: T4) => R, arity?: number):
            RightCurriedFunction4<T1, T2, T3, T4, R>;
        /**
         * This method is like _.curry except that arguments are applied to func in the manner of _.partialRight
         * instead of _.partial.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        <T1, T2, T3, T4, T5, R>(func: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R, arity?: number):
            RightCurriedFunction5<T1, T2, T3, T4, T5, R>;
        /**
         * This method is like _.curry except that arguments are applied to func in the manner of _.partialRight
         * instead of _.partial.
         * @param func The function to curry.
         * @param arity The arity of func.
         * @return Returns the new curried function.
         */
        (func: (...args: any[]) => any, arity?: number): (...args: any[]) => any;

        placeholder: __;
    }

    interface LoDashStatic {
        curryRight: CurryRight;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.curryRight
         **/
        curryRight<T1, R>(this: LoDashImplicitWrapper<(t1: T1) => R>, arity?: number):
            LoDashImplicitWrapper<RightCurriedFunction1<T1, R>>;

        /**
         * @see _.curryRight
         **/
        curryRight<T1, T2, R>(this: LoDashImplicitWrapper<(t1: T1, t2: T2) => R>, arity?: number):
            LoDashImplicitWrapper<RightCurriedFunction2<T1, T2, R>>;

        /**
         * @see _.curryRight
         **/
        curryRight<T1, T2, T3, R>(this: LoDashImplicitWrapper<(t1: T1, t2: T2, t3: T3) => R>, arity?: number):
            LoDashImplicitWrapper<RightCurriedFunction3<T1, T2, T3, R>>;

        /**
         * @see _.curryRight
         **/
        curryRight<T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<(t1: T1, t2: T2, t3: T3, t4: T4) => R>, arity?: number):
            LoDashImplicitWrapper<RightCurriedFunction4<T1, T2, T3, T4, R>>;

        /**
         * @see _.curryRight
         **/
        curryRight<T1, T2, T3, T4, T5, R>(this: LoDashImplicitWrapper<(t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R>, arity?: number):
            LoDashImplicitWrapper<RightCurriedFunction5<T1, T2, T3, T4, T5, R>>;

        /**
         * @see _.curryRight
         **/
        curryRight(arity?: number): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.curryRight
         **/
        curryRight<T1, R>(this: LoDashExplicitWrapper<(t1: T1) => R>, arity?: number):
            LoDashExplicitWrapper<RightCurriedFunction1<T1, R>>;

        /**
         * @see _.curryRight
         **/
        curryRight<T1, T2, R>(this: LoDashExplicitWrapper<(t1: T1, t2: T2) => R>, arity?: number):
            LoDashExplicitWrapper<RightCurriedFunction2<T1, T2, R>>;

        /**
         * @see _.curryRight
         **/
        curryRight<T1, T2, T3, R>(this: LoDashExplicitWrapper<(t1: T1, t2: T2, t3: T3) => R>, arity?: number):
            LoDashExplicitWrapper<RightCurriedFunction3<T1, T2, T3, R>>;

        /**
         * @see _.curryRight
         **/
        curryRight<T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<(t1: T1, t2: T2, t3: T3, t4: T4) => R>, arity?: number):
            LoDashExplicitWrapper<RightCurriedFunction4<T1, T2, T3, T4, R>>;

        /**
         * @see _.curryRight
         **/
        curryRight<T1, T2, T3, T4, T5, R>(this: LoDashExplicitWrapper<(t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R>, arity?: number):
            LoDashExplicitWrapper<RightCurriedFunction5<T1, T2, T3, T4, T5, R>>;

        /**
         * @see _.curryRight
         **/
        curryRight(arity?: number): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // debounce

    interface DebounceSettings {
        /**
         * Specify invoking on the leading edge of the timeout.
         */
        leading?: boolean;

        /**
         * The maximum time func is allowed to be delayed before it’s invoked.
         */
        maxWait?: number;

        /**
         * Specify invoking on the trailing edge of the timeout.
         */
        trailing?: boolean;
    }

    interface LoDashStatic {
        /**
         * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed since
         * the last time the debounced function was invoked. The debounced function comes with a cancel method to
         * cancel delayed invocations and a flush method to immediately invoke them. Provide an options object to
         * indicate that func should be invoked on the leading and/or trailing edge of the wait timeout. Subsequent
         * calls to the debounced function return the result of the last func invocation.
         *
         * Note: If leading and trailing options are true, func is invoked on the trailing edge of the timeout only
         * if the the debounced function is invoked more than once during the wait timeout.
         *
         * See David Corbacho’s article for details over the differences between _.debounce and _.throttle.
         *
         * @param func The function to debounce.
         * @param wait The number of milliseconds to delay.
         * @param options The options object.
         * @param options.leading Specify invoking on the leading edge of the timeout.
         * @param options.maxWait The maximum time func is allowed to be delayed before it’s invoked.
         * @param options.trailing Specify invoking on the trailing edge of the timeout.
         * @return Returns the new debounced function.
         */
        debounce<T extends (...args: any[]) => any>(
            func: T,
            wait?: number,
            options?: DebounceSettings
        ): T & Cancelable;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.debounce
         */
        debounce(
            wait?: number,
            options?: DebounceSettings
        ): LoDashImplicitWrapper<TValue & Cancelable>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.debounce
         */
        debounce(
            wait?: number,
            options?: DebounceSettings
        ): LoDashExplicitWrapper<TValue & Cancelable>;
    }

    // defer

    interface LoDashStatic {
        /**
         * Defers invoking the func until the current call stack has cleared. Any additional arguments are provided to
         * func when it’s invoked.
         *
         * @param func The function to defer.
         * @param args The arguments to invoke the function with.
         * @return Returns the timer id.
         */
        defer(
            func: (...args: any[]) => any,
            ...args: any[]
        ): number;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.defer
         */
        defer(...args: any[]): LoDashImplicitWrapper<number>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.defer
         */
        defer(...args: any[]): LoDashExplicitWrapper<number>;
    }

    // delay

    interface LoDashStatic {
        /**
         * Invokes func after wait milliseconds. Any additional arguments are provided to func when it’s invoked.
         *
         * @param func The function to delay.
         * @param wait The number of milliseconds to delay invocation.
         * @param args The arguments to invoke the function with.
         * @return Returns the timer id.
         */
        delay(
            func: (...args: any[]) => any,
            wait: number,
            ...args: any[]
        ): number;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.delay
         */
        delay(
            wait: number,
            ...args: any[]
        ): LoDashImplicitWrapper<number>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.delay
         */
        delay(
            wait: number,
            ...args: any[]
        ): LoDashExplicitWrapper<number>;
    }

    // flip

    interface LoDashStatic {
        /**
         * Creates a function that invokes `func` with arguments reversed.
         *
         * @category Function
         * @param func The function to flip arguments for.
         * @returns Returns the new function.
         * @example
         *
         * var flipped = _.flip(function() {
         *   return _.toArray(arguments);
         * });
         *
         * flipped('a', 'b', 'c', 'd');
         * // => ['d', 'c', 'b', 'a']
         */
        flip<T extends (...args: any[]) => any>(func: T): T;
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.flip
         */
        flip(): this;
    }

    // memoize

    interface MemoizedFunction {
        cache: MapCache;
    }

    interface LoDashStatic {
        /**
         * Creates a function that memoizes the result of func. If resolver is provided it determines the cache key for
         * storing the result based on the arguments provided to the memoized function. By default, the first argument
         * provided to the memoized function is coerced to a string and used as the cache key. The func is invoked with
         * the this binding of the memoized function.
         *
         * @param func The function to have its output memoized.
         * @param resolver The function to resolve the cache key.
         * @return Returns the new memoizing function.
         */
        memoize: {
            <T extends (...args: any[]) => any>(func: T, resolver?: (...args: any[]) => any): T & MemoizedFunction;
            Cache: MapCacheConstructor;
        };
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.memoize
         */
        memoize(resolver?: (...args: any[]) => any): LoDashImplicitWrapper<TValue & MemoizedFunction>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.memoize
         */
        memoize(resolver?: (...args: any[]) => any): LoDashExplicitWrapper<TValue & MemoizedFunction>;
    }

    // negate

    interface LoDashStatic {
        /**
         * Creates a function that negates the result of the predicate func. The func predicate is invoked with
         * the this binding and arguments of the created function.
         *
         * @param predicate The predicate to negate.
         * @return Returns the new function.
         */
        negate(predicate: () => boolean): () => boolean;
        negate<A1>(predicate: (a1: A1) => boolean): (a1: A1) => boolean;
        negate<A1, A2>(predicate: (a1: A1, a2: A2) => boolean): (a1: A1, a2: A2) => boolean;
        negate(predicate: (...args: any[]) => any): (...args: any[]) => boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.negate
         */
        negate(this: LoDashImplicitWrapper<() => boolean>): LoDashImplicitWrapper<() => boolean>;
        negate<A1>(this: LoDashImplicitWrapper<(a1: A1) => boolean>): LoDashImplicitWrapper<(a1: A1) => boolean>;
        negate<A1, A2>(this: LoDashImplicitWrapper<(a1: A1, a2: A2) => boolean>): LoDashImplicitWrapper<(a1: A1, a2: A2) => boolean>;
        negate(this: LoDashImplicitWrapper<(...args: any[]) => any>): LoDashImplicitWrapper<(...args: any[]) => boolean>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.negate
         */
        negate(this: LoDashExplicitWrapper<() => boolean>): LoDashExplicitWrapper<() => boolean>;
        negate<A1>(this: LoDashExplicitWrapper<(a1: A1) => boolean>): LoDashExplicitWrapper<(a1: A1) => boolean>;
        negate<A1, A2>(this: LoDashExplicitWrapper<(a1: A1, a2: A2) => boolean>): LoDashExplicitWrapper<(a1: A1, a2: A2) => boolean>;
        negate(this: LoDashExplicitWrapper<(...args: any[]) => any>): LoDashExplicitWrapper<(...args: any[]) => boolean>;
    }

    // once

    interface LoDashStatic {
        /**
         * Creates a function that is restricted to invoking func once. Repeat calls to the function return the value
         * of the first call. The func is invoked with the this binding and arguments of the created function.
         *
         * @param func The function to restrict.
         * @return Returns the new restricted function.
         */
        once<T extends (...args: any[]) => any>(func: T): T;
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.once
         */
        once(): this;
    }

    // overArgs

    interface LoDashStatic {
        /**
         * Creates a function that runs each argument through a corresponding transform function.
         *
         * @param func The function to wrap.
         * @param transforms The functions to transform arguments, specified as individual functions or arrays
         * of functions.
         * @return Returns the new function.
         */
        overArgs(
            func: (...args: any[]) => any,
            ...transforms: Array<Many<(...args: any[]) => any>>
        ): (...args: any[]) => any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.overArgs
         */
        overArgs(...transforms: Array<Many<(...args: any[]) => any>>): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.overArgs
         */
        overArgs(...transforms: Array<Many<(...args: any[]) => any>>): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // partial

    interface LoDashStatic {
        /**
        * Creates a function that, when called, invokes func with any additional partial arguments
        * prepended to those provided to the new function. This method is similar to _.bind except
        * it does not alter the this binding.
        * @param func The function to partially apply arguments to.
        * @param args Arguments to be partially applied.
        * @return The new partially applied function.
        **/
        partial: Partial;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.partial
         */
        partial: ImplicitPartial;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.partial
         */
        partial: ExplicitPartial;
    }

    /** The placeholder, to be used in curried functions */
    type __ = LoDashStatic;

    type Function0<R> = () => R;
    type Function1<T1, R> = (t1: T1) => R;
    type Function2<T1, T2, R> = (t1: T1, t2: T2) => R;
    type Function3<T1, T2, T3, R> = (t1: T1, t2: T2, t3: T3) => R;
    type Function4<T1, T2, T3, T4, R> = (t1: T1, t2: T2, t3: T3, t4: T4) => R;

    interface Partial {
        // arity 0
        <R>(func: Function0<R>): Function0<R>;
        // arity 1
        <T1, R>(func: Function1<T1, R>): Function1<T1, R>;
        <T1, R>(func: Function1<T1, R>, arg1: T1): Function0<R>;
        // arity 2
        <T1, T2, R>(func: Function2<T1, T2, R>):                      Function2<T1, T2, R>;
        <T1, T2, R>(func: Function2<T1, T2, R>, arg1: T1):            Function1<    T2, R>;
        <T1, T2, R>(func: Function2<T1, T2, R>, plc1: __, arg2: T2):  Function1<T1,     R>;
        <T1, T2, R>(func: Function2<T1, T2, R>, arg1: T1, arg2: T2):  Function0<        R>;
        // arity 3
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>):                                Function3<T1, T2, T3, R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>, arg1: T1):                      Function2<    T2, T3, R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>, plc1: __, arg2: T2):            Function2<T1,     T3, R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>, arg1: T1, arg2: T2):            Function1<        T3, R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>, plc1: __, plc2: __, arg3: T3):  Function2<T1, T2,     R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>, arg1: T1, plc2: __, arg3: T3):  Function1<    T2,     R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>, plc1: __, arg2: T2, arg3: T3):  Function1<T1,         R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>, arg1: T1, arg2: T2, arg3: T3):  Function0<            R>;
        // arity 4
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>):                                          Function4<T1, T2, T3, T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1):                                Function3<    T2, T3, T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, plc1: __, arg2: T2):                      Function3<T1,     T3, T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, arg2: T2):                      Function2<        T3, T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, plc1: __, plc2: __, arg3: T3):            Function3<T1, T2,     T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, plc2: __, arg3: T3):            Function2<    T2,     T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, plc1: __, arg2: T2, arg3: T3):            Function2<T1,         T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, arg2: T2, arg3: T3):            Function1<            T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, plc1: __, plc2: __, plc3: __, arg4: T4):  Function3<T1, T2, T3,     R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, plc2: __, plc3: __, arg4: T4):  Function2<    T2, T3,     R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, plc1: __, arg2: T2, plc3: __, arg4: T4):  Function2<T1,     T3,     R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, arg2: T2, plc3: __, arg4: T4):  Function1<        T3,     R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, plc1: __, plc2: __, arg3: T3, arg4: T4):  Function2<T1, T2,         R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, plc2: __, arg3: T3, arg4: T4):  Function1<    T2,         R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, plc1: __, arg2: T2, arg3: T3, arg4: T4):  Function1<T1,             R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, arg2: T2, arg3: T3, arg4: T4):  Function0<                R>;
        // catch-all
        (func: (...args: any[]) => any, ...args: any[]): (...args: any[]) => any;

        placeholder: __;
    }

    interface ImplicitPartial {
        // arity 0
        <R>(this: LoDashImplicitWrapper<Function0<R>>): LoDashImplicitWrapper<Function0<R>>;
        // arity 1
        <T1, R>(this: LoDashImplicitWrapper<Function1<T1, R>>): LoDashImplicitWrapper<Function1<T1, R>>;
        <T1, R>(this: LoDashImplicitWrapper<Function1<T1, R>>, arg1: T1): LoDashImplicitWrapper<Function0<R>>;
        // arity 2
        <T1, T2, R>(this: LoDashImplicitWrapper<Function2<T1, T2, R>>):                      LoDashImplicitWrapper<Function2<T1, T2, R>>;
        <T1, T2, R>(this: LoDashImplicitWrapper<Function2<T1, T2, R>>, arg1: T1):            LoDashImplicitWrapper<Function1<    T2, R>>;
        <T1, T2, R>(this: LoDashImplicitWrapper<Function2<T1, T2, R>>, plc1: __, arg2: T2):  LoDashImplicitWrapper<Function1<T1,     R>>;
        <T1, T2, R>(this: LoDashImplicitWrapper<Function2<T1, T2, R>>, arg1: T1, arg2: T2):  LoDashImplicitWrapper<Function0<        R>>;
        // arity 3
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>):                                LoDashImplicitWrapper<Function3<T1, T2, T3, R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1):                      LoDashImplicitWrapper<Function2<    T2, T3, R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>, plc1: __, arg2: T2):            LoDashImplicitWrapper<Function2<T1,     T3, R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, arg2: T2):            LoDashImplicitWrapper<Function1<        T3, R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>, plc1: __, plc2: __, arg3: T3):  LoDashImplicitWrapper<Function2<T1, T2,     R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, plc2: __, arg3: T3):  LoDashImplicitWrapper<Function1<    T2,     R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>, plc1: __, arg2: T2, arg3: T3):  LoDashImplicitWrapper<Function1<T1,         R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, arg2: T2, arg3: T3):  LoDashImplicitWrapper<Function0<            R>>;
        // arity 4
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>):                                          LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1):                                LoDashImplicitWrapper<Function3<    T2, T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, arg2: T2):                      LoDashImplicitWrapper<Function3<T1,     T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2):                      LoDashImplicitWrapper<Function2<        T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, plc2: __, arg3: T3):            LoDashImplicitWrapper<Function3<T1, T2,     T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, arg3: T3):            LoDashImplicitWrapper<Function2<    T2,     T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, arg2: T2, arg3: T3):            LoDashImplicitWrapper<Function2<T1,         T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, arg3: T3):            LoDashImplicitWrapper<Function1<            T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, plc2: __, plc3: __, arg4: T4):  LoDashImplicitWrapper<Function3<T1, T2, T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, plc3: __, arg4: T4):  LoDashImplicitWrapper<Function2<    T2, T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, arg2: T2, plc3: __, arg4: T4):  LoDashImplicitWrapper<Function2<T1,     T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, plc3: __, arg4: T4):  LoDashImplicitWrapper<Function1<        T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, plc2: __, arg3: T3, arg4: T4):  LoDashImplicitWrapper<Function2<T1, T2,         R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, arg3: T3, arg4: T4):  LoDashImplicitWrapper<Function1<    T2,         R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, arg2: T2, arg3: T3, arg4: T4):  LoDashImplicitWrapper<Function1<T1,             R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, arg3: T3, arg4: T4):  LoDashImplicitWrapper<Function0<                R>>;
        // catch-all
        (...args: any[]): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface ExplicitPartial {
        // arity 0
        <R>(this: LoDashExplicitWrapper<Function0<R>>): LoDashExplicitWrapper<Function0<R>>;
        // arity 1
        <T1, R>(this: LoDashExplicitWrapper<Function1<T1, R>>): LoDashExplicitWrapper<Function1<T1, R>>;
        <T1, R>(this: LoDashExplicitWrapper<Function1<T1, R>>, arg1: T1): LoDashExplicitWrapper<Function0<R>>;
        // arity 2
        <T1, T2, R>(this: LoDashExplicitWrapper<Function2<T1, T2, R>>):                      LoDashExplicitWrapper<Function2<T1, T2, R>>;
        <T1, T2, R>(this: LoDashExplicitWrapper<Function2<T1, T2, R>>, arg1: T1):            LoDashExplicitWrapper<Function1<    T2, R>>;
        <T1, T2, R>(this: LoDashExplicitWrapper<Function2<T1, T2, R>>, plc1: __, arg2: T2):  LoDashExplicitWrapper<Function1<T1,     R>>;
        <T1, T2, R>(this: LoDashExplicitWrapper<Function2<T1, T2, R>>, arg1: T1, arg2: T2):  LoDashExplicitWrapper<Function0<        R>>;
        // arity 3
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>):                                LoDashExplicitWrapper<Function3<T1, T2, T3, R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1):                      LoDashExplicitWrapper<Function2<    T2, T3, R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>, plc1: __, arg2: T2):            LoDashExplicitWrapper<Function2<T1,     T3, R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, arg2: T2):            LoDashExplicitWrapper<Function1<        T3, R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>, plc1: __, plc2: __, arg3: T3):  LoDashExplicitWrapper<Function2<T1, T2,     R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, plc2: __, arg3: T3):  LoDashExplicitWrapper<Function1<    T2,     R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>, plc1: __, arg2: T2, arg3: T3):  LoDashExplicitWrapper<Function1<T1,         R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, arg2: T2, arg3: T3):  LoDashExplicitWrapper<Function0<            R>>;
        // arity 4
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>):                                          LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1):                                LoDashExplicitWrapper<Function3<    T2, T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, arg2: T2):                      LoDashExplicitWrapper<Function3<T1,     T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2):                      LoDashExplicitWrapper<Function2<        T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, plc2: __, arg3: T3):            LoDashExplicitWrapper<Function3<T1, T2,     T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, arg3: T3):            LoDashExplicitWrapper<Function2<    T2,     T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, arg2: T2, arg3: T3):            LoDashExplicitWrapper<Function2<T1,         T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, arg3: T3):            LoDashExplicitWrapper<Function1<            T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, plc2: __, plc3: __, arg4: T4):  LoDashExplicitWrapper<Function3<T1, T2, T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, plc3: __, arg4: T4):  LoDashExplicitWrapper<Function2<    T2, T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, arg2: T2, plc3: __, arg4: T4):  LoDashExplicitWrapper<Function2<T1,     T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, plc3: __, arg4: T4):  LoDashExplicitWrapper<Function1<        T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, plc2: __, arg3: T3, arg4: T4):  LoDashExplicitWrapper<Function2<T1, T2,         R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, arg3: T3, arg4: T4):  LoDashExplicitWrapper<Function1<    T2,         R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, plc1: __, arg2: T2, arg3: T3, arg4: T4):  LoDashExplicitWrapper<Function1<T1,             R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, arg3: T3, arg4: T4):  LoDashExplicitWrapper<Function0<                R>>;
        // catch-all
        (...args: any[]): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // partialRight

    interface LoDashStatic {
        /**
        * This method is like _.partial except that partial arguments are appended to those provided
        * to the new function.
        * @param func The function to partially apply arguments to.
        * @param args Arguments to be partially applied.
        * @return The new partially applied function.
        **/
        partialRight: PartialRight;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.partialRight
         */
        partialRight: ImplicitPartialRight;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.partialRight
         */
        partialRight: ExplicitPartialRight;
    }

    interface PartialRight {
        // arity 0
        <R>(func: Function0<R>): Function0<R>;
        // arity 1
        <T1, R>(func: Function1<T1, R>): Function1<T1, R>;
        <T1, R>(func: Function1<T1, R>, arg1: T1): Function0<R>;
        // arity 2
        <T1, T2, R>(func: Function2<T1, T2, R>):                      Function2<T1, T2, R>;
        <T1, T2, R>(func: Function2<T1, T2, R>, arg1: T1, plc2: __):  Function1<    T2, R>;
        <T1, T2, R>(func: Function2<T1, T2, R>,           arg2: T2):  Function1<T1,     R>;
        <T1, T2, R>(func: Function2<T1, T2, R>, arg1: T1, arg2: T2):  Function0<        R>;
        // arity 3
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>):                                Function3<T1, T2, T3, R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>, arg1: T1, plc2: __, plc3: __):  Function2<    T2, T3, R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>,           arg2: T2, plc3: __):  Function2<T1,     T3, R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>, arg1: T1, arg2: T2, plc3: __):  Function1<        T3, R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>,                     arg3: T3):  Function2<T1, T2,     R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>, arg1: T1, plc2: __, arg3: T3):  Function1<    T2,     R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>,           arg2: T2, arg3: T3):  Function1<T1,         R>;
        <T1, T2, T3, R>(func: Function3<T1, T2, T3, R>, arg1: T1, arg2: T2, arg3: T3):  Function0<            R>;
        // arity 4
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>):                                          Function4<T1, T2, T3, T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, plc2: __, plc3: __, plc4: __):  Function3<    T2, T3, T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>,           arg2: T2, plc3: __, plc4: __):  Function3<T1,     T3, T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, arg2: T2, plc3: __, plc4: __):  Function2<        T3, T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>,                     arg3: T3, plc4: __):  Function3<T1, T2,     T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, plc2: __, arg3: T3, plc4: __):  Function2<    T2,     T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>,           arg2: T2, arg3: T3, plc4: __):  Function2<T1,         T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, arg2: T2, arg3: T3, plc4: __):  Function1<            T4, R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>,                               arg4: T4):  Function3<T1, T2, T3,     R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, plc2: __, plc3: __, arg4: T4):  Function2<    T2, T3,     R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>,           arg2: T2, plc3: __, arg4: T4):  Function2<T1,     T3,     R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, arg2: T2, plc3: __, arg4: T4):  Function1<        T3,     R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>,                     arg3: T3, arg4: T4):  Function2<T1, T2,         R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, plc2: __, arg3: T3, arg4: T4):  Function1<    T2,         R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>,           arg2: T2, arg3: T3, arg4: T4):  Function1<T1,             R>;
        <T1, T2, T3, T4, R>(func: Function4<T1, T2, T3, T4, R>, arg1: T1, arg2: T2, arg3: T3, arg4: T4):  Function0<                R>;
        // catch-all
        (func: (...args: any[]) => any, ...args: any[]): (...args: any[]) => any;

        placeholder: __;
    }

    interface ImplicitPartialRight {
        // arity 0
        <R>(this: LoDashImplicitWrapper<Function0<R>>): LoDashImplicitWrapper<Function0<R>>;
        // arity 1
        <T1, R>(this: LoDashImplicitWrapper<Function1<T1, R>>): LoDashImplicitWrapper<Function1<T1, R>>;
        <T1, R>(this: LoDashImplicitWrapper<Function1<T1, R>>, arg1: T1): LoDashImplicitWrapper<Function0<R>>;
        // arity 2
        <T1, T2, R>(this: LoDashImplicitWrapper<Function2<T1, T2, R>>):                      LoDashImplicitWrapper<Function2<T1, T2, R>>;
        <T1, T2, R>(this: LoDashImplicitWrapper<Function2<T1, T2, R>>, arg1: T1, plc2: __):  LoDashImplicitWrapper<Function1<    T2, R>>;
        <T1, T2, R>(this: LoDashImplicitWrapper<Function2<T1, T2, R>>,           arg2: T2):  LoDashImplicitWrapper<Function1<T1,     R>>;
        <T1, T2, R>(this: LoDashImplicitWrapper<Function2<T1, T2, R>>, arg1: T1, arg2: T2):  LoDashImplicitWrapper<Function0<        R>>;
        // arity 3
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>):                                LoDashImplicitWrapper<Function3<T1, T2, T3, R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, plc2: __, plc3: __):  LoDashImplicitWrapper<Function2<    T2, T3, R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>,           arg2: T2, plc3: __):  LoDashImplicitWrapper<Function2<T1,     T3, R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, arg2: T2, plc3: __):  LoDashImplicitWrapper<Function1<        T3, R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>,                     arg3: T3):  LoDashImplicitWrapper<Function2<T1, T2,     R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, plc2: __, arg3: T3):  LoDashImplicitWrapper<Function1<    T2,     R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>,           arg2: T2, arg3: T3):  LoDashImplicitWrapper<Function1<T1,         R>>;
        <T1, T2, T3, R>(this: LoDashImplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, arg2: T2, arg3: T3):  LoDashImplicitWrapper<Function0<            R>>;
        // arity 4
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>):                                          LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, plc3: __, plc4: __):  LoDashImplicitWrapper<Function3<    T2, T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>,           arg2: T2, plc3: __, plc4: __):  LoDashImplicitWrapper<Function3<T1,     T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, plc3: __, plc4: __):  LoDashImplicitWrapper<Function2<        T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>,                     arg3: T3, plc4: __):  LoDashImplicitWrapper<Function3<T1, T2,     T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, arg3: T3, plc4: __):  LoDashImplicitWrapper<Function2<    T2,     T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>,           arg2: T2, arg3: T3, plc4: __):  LoDashImplicitWrapper<Function2<T1,         T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, arg3: T3, plc4: __):  LoDashImplicitWrapper<Function1<            T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>,                               arg4: T4):  LoDashImplicitWrapper<Function3<T1, T2, T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, plc3: __, arg4: T4):  LoDashImplicitWrapper<Function2<    T2, T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>,           arg2: T2, plc3: __, arg4: T4):  LoDashImplicitWrapper<Function2<T1,     T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, plc3: __, arg4: T4):  LoDashImplicitWrapper<Function1<        T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>,                     arg3: T3, arg4: T4):  LoDashImplicitWrapper<Function2<T1, T2,         R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, arg3: T3, arg4: T4):  LoDashImplicitWrapper<Function1<    T2,         R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>,           arg2: T2, arg3: T3, arg4: T4):  LoDashImplicitWrapper<Function1<T1,             R>>;
        <T1, T2, T3, T4, R>(this: LoDashImplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, arg3: T3, arg4: T4):  LoDashImplicitWrapper<Function0<                R>>;
        // catch-all
        (...args: any[]): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface ExplicitPartialRight {
        // arity 0
        <R>(this: LoDashExplicitWrapper<Function0<R>>): LoDashExplicitWrapper<Function0<R>>;
        // arity 1
        <T1, R>(this: LoDashExplicitWrapper<Function1<T1, R>>): LoDashExplicitWrapper<Function1<T1, R>>;
        <T1, R>(this: LoDashExplicitWrapper<Function1<T1, R>>, arg1: T1): LoDashExplicitWrapper<Function0<R>>;
        // arity 2
        <T1, T2, R>(this: LoDashExplicitWrapper<Function2<T1, T2, R>>):                      LoDashExplicitWrapper<Function2<T1, T2, R>>;
        <T1, T2, R>(this: LoDashExplicitWrapper<Function2<T1, T2, R>>, arg1: T1, plc2: __):  LoDashExplicitWrapper<Function1<    T2, R>>;
        <T1, T2, R>(this: LoDashExplicitWrapper<Function2<T1, T2, R>>,           arg2: T2):  LoDashExplicitWrapper<Function1<T1,     R>>;
        <T1, T2, R>(this: LoDashExplicitWrapper<Function2<T1, T2, R>>, arg1: T1, arg2: T2):  LoDashExplicitWrapper<Function0<        R>>;
        // arity 3
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>):                                LoDashExplicitWrapper<Function3<T1, T2, T3, R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, plc2: __, plc3: __):  LoDashExplicitWrapper<Function2<    T2, T3, R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>,           arg2: T2, plc3: __):  LoDashExplicitWrapper<Function2<T1,     T3, R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, arg2: T2, plc3: __):  LoDashExplicitWrapper<Function1<        T3, R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>,                     arg3: T3):  LoDashExplicitWrapper<Function2<T1, T2,     R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, plc2: __, arg3: T3):  LoDashExplicitWrapper<Function1<    T2,     R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>,           arg2: T2, arg3: T3):  LoDashExplicitWrapper<Function1<T1,         R>>;
        <T1, T2, T3, R>(this: LoDashExplicitWrapper<Function3<T1, T2, T3, R>>, arg1: T1, arg2: T2, arg3: T3):  LoDashExplicitWrapper<Function0<            R>>;
        // arity 4
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>):                                          LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, plc3: __, plc4: __):  LoDashExplicitWrapper<Function3<    T2, T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>,           arg2: T2, plc3: __, plc4: __):  LoDashExplicitWrapper<Function3<T1,     T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, plc3: __, plc4: __):  LoDashExplicitWrapper<Function2<        T3, T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>,                     arg3: T3, plc4: __):  LoDashExplicitWrapper<Function3<T1, T2,     T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, arg3: T3, plc4: __):  LoDashExplicitWrapper<Function2<    T2,     T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>,           arg2: T2, arg3: T3, plc4: __):  LoDashExplicitWrapper<Function2<T1,         T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, arg3: T3, plc4: __):  LoDashExplicitWrapper<Function1<            T4, R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>,                               arg4: T4):  LoDashExplicitWrapper<Function3<T1, T2, T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, plc3: __, arg4: T4):  LoDashExplicitWrapper<Function2<    T2, T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>,           arg2: T2, plc3: __, arg4: T4):  LoDashExplicitWrapper<Function2<T1,     T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, plc3: __, arg4: T4):  LoDashExplicitWrapper<Function1<        T3,     R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>,                     arg3: T3, arg4: T4):  LoDashExplicitWrapper<Function2<T1, T2,         R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, plc2: __, arg3: T3, arg4: T4):  LoDashExplicitWrapper<Function1<    T2,         R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>,           arg2: T2, arg3: T3, arg4: T4):  LoDashExplicitWrapper<Function1<T1,             R>>;
        <T1, T2, T3, T4, R>(this: LoDashExplicitWrapper<Function4<T1, T2, T3, T4, R>>, arg1: T1, arg2: T2, arg3: T3, arg4: T4):  LoDashExplicitWrapper<Function0<                R>>;
        // catch-all
        (...args: any[]): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // rearg

    interface LoDashStatic {
        /**
         * Creates a function that invokes func with arguments arranged according to the specified indexes where the
         * argument value at the first index is provided as the first argument, the argument value at the second index
         * is provided as the second argument, and so on.
         * @param func The function to rearrange arguments for.
         * @param indexes The arranged argument indexes, specified as individual indexes or arrays of indexes.
         * @return Returns the new function.
         */
        rearg(func: (...args: any[]) => any, ...indexes: Array<Many<number>>): (...args: any[]) => any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.rearg
         */
        rearg(...indexes: Array<Many<number>>): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.rearg
         */
        rearg(...indexes: Array<Many<number>>): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // rest

    interface LoDashStatic {
        /**
         * Creates a function that invokes func with the this binding of the created function and arguments from start
         * and beyond provided as an array.
         *
         * Note: This method is based on the rest parameter.
         *
         * @param func The function to apply a rest parameter to.
         * @param start The start position of the rest parameter.
         * @return Returns the new function.
         */
        rest(
            func: (...args: any[]) => any,
            start?: number
        ): (...args: any[]) => any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.rest
         */
        rest(start?: number): LoDashImplicitWrapper<(...args: any[]) => any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.rest
         */
        rest(start?: number): LoDashExplicitWrapper<(...args: any[]) => any>;
    }

    // spread

    interface LoDashStatic {
        /**
         * Creates a function that invokes func with the this binding of the created function and an array of arguments
         * much like Function#apply.
         *
         * Note: This method is based on the spread operator.
         *
         * @param func The function to spread arguments over.
         * @return Returns the new function.
         */
        spread<TResult>(func: (...args: any[]) => TResult): (...args: any[]) => TResult;

        /**
         * @see _.spread
         */
        spread<TResult>(func: (...args: any[]) => TResult, start: number): (...args: any[]) => TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.spread
         */
        spread<TResult>(this: LoDashImplicitWrapper<(...args: any[]) => TResult>): LoDashImplicitWrapper<(...args: any[]) => TResult>;

        /**
         * @see _.spread
         */
        spread<TResult>(this: LoDashImplicitWrapper<(...args: any[]) => TResult>, start: number): LoDashImplicitWrapper<(...args: any[]) => TResult>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.spread
         */
        spread<TResult>(this: LoDashExplicitWrapper<(...args: any[]) => TResult>): LoDashExplicitWrapper<(...args: any[]) => TResult>;

        /**
         * @see _.spread
         */
        spread<TResult>(this: LoDashExplicitWrapper<(...args: any[]) => TResult>, start: number): LoDashExplicitWrapper<(...args: any[]) => TResult>;
    }

    // throttle

    interface ThrottleSettings {
        /**
         * If you'd like to disable the leading-edge call, pass this as false.
         */
        leading?: boolean;

        /**
         * If you'd like to disable the execution on the trailing-edge, pass false.
         */
        trailing?: boolean;
    }

    interface LoDashStatic {
        /**
         * Creates a throttled function that only invokes func at most once per every wait milliseconds. The throttled
         * function comes with a cancel method to cancel delayed invocations and a flush method to immediately invoke
         * them. Provide an options object to indicate that func should be invoked on the leading and/or trailing edge
         * of the wait timeout. Subsequent calls to the throttled function return the result of the last func call.
         *
         * Note: If leading and trailing options are true, func is invoked on the trailing edge of the timeout only if
         * the the throttled function is invoked more than once during the wait timeout.
         *
         * @param func The function to throttle.
         * @param wait The number of milliseconds to throttle invocations to.
         * @param options The options object.
         * @param options.leading Specify invoking on the leading edge of the timeout.
         * @param options.trailing Specify invoking on the trailing edge of the timeout.
         * @return Returns the new throttled function.
         */
        throttle<T extends (...args: any[]) => any>(
            func: T,
            wait?: number,
            options?: ThrottleSettings
        ): T & Cancelable;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.throttle
         */
        throttle(
            wait?: number,
            options?: ThrottleSettings
        ): LoDashImplicitWrapper<TValue & Cancelable>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.throttle
         */
        throttle(
            wait?: number,
            options?: ThrottleSettings
        ): LoDashExplicitWrapper<TValue & Cancelable>;
    }

    // unary

    interface LoDashStatic {
        /**
         * Creates a function that accepts up to one argument, ignoring any
         * additional arguments.
         *
         * @category Function
         * @param func The function to cap arguments for.
         * @returns Returns the new function.
         * @example
         *
         * _.map(['6', '8', '10'], _.unary(parseInt));
         * // => [6, 8, 10]
         */
        unary<T, TResult>(func: (arg1: T, ...args: any[]) => TResult): (arg1: T) => TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.unary
         */
        unary<T, TResult>(this: LoDashImplicitWrapper<(arg1: T, ...args: any[]) => TResult>): LoDashImplicitWrapper<(arg1: T) => TResult>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.unary
         */
        unary<T, TResult>(this: LoDashExplicitWrapper<(arg1: T, ...args: any[]) => TResult>): LoDashExplicitWrapper<(arg1: T) => TResult>;
    }

    // wrap

    interface LoDashStatic {
        /**
         * Creates a function that provides value to the wrapper function as its first argument. Any additional
         * arguments provided to the function are appended to those provided to the wrapper function. The wrapper is
         * invoked with the this binding of the created function.
         *
         * @param value The value to wrap.
         * @param wrapper The wrapper function.
         * @return Returns the new function.
         */
        wrap<T, TArgs, TResult>(
            value: T,
            wrapper: (value: T, ...args: TArgs[]) => TResult
        ): (...args: TArgs[]) => TResult;

        /**
         * @see _.wrap
         */
        wrap<T, TResult>(
            value: T,
            wrapper: (value: T, ...args: any[]) => TResult
        ): (...args: any[]) => TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.wrap
         */
        wrap<TArgs, TResult>(
            wrapper: (value: TValue, ...args: TArgs[]) => TResult
        ): LoDashImplicitWrapper<(...args: TArgs[]) => TResult>;

        /**
         * @see _.wrap
         */
        wrap<TResult>(
            wrapper: (value: TValue, ...args: any[]) => TResult
        ): LoDashImplicitWrapper<(...args: any[]) => TResult>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.wrap
         */
        /**
         * @see _.wrap
         */
        wrap<TArgs, TResult>(
            wrapper: (value: TValue, ...args: TArgs[]) => TResult
        ): LoDashExplicitWrapper<(...args: TArgs[]) => TResult>;

        /**
         * @see _.wrap
         */
        wrap<TResult>(
            wrapper: (value: TValue, ...args: any[]) => TResult
        ): LoDashExplicitWrapper<(...args: any[]) => TResult>;
    }
}
