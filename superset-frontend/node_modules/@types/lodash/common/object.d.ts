import _ = require("../index");
declare module "../index" {
    // assign

    interface LoDashStatic {
        /**
         * Assigns own enumerable properties of source objects to the destination
         * object. Source objects are applied from left to right. Subsequent sources
         * overwrite property assignments of previous sources.
         *
         * **Note:** This method mutates `object` and is loosely based on
         * [`Object.assign`](https://mdn.io/Object/assign).
         *
         * @category Object
         * @param object The destination object.
         * @param [sources] The source objects.
         * @returns Returns `object`.
         * @example
         *
         * function Foo() {
         *   this.c = 3;
         * }
         *
         * function Bar() {
         *   this.e = 5;
         * }
         *
         * Foo.prototype.d = 4;
         * Bar.prototype.f = 6;
         *
         * _.assign({ 'a': 1 }, new Foo, new Bar);
         * // => { 'a': 1, 'c': 3, 'e': 5 }
         */
        assign<TObject, TSource>(
            object: TObject,
            source: TSource
        ): TObject & TSource;

        /**
         * @see assign
         */
        assign<TObject, TSource1, TSource2>(
            object: TObject,
            source1: TSource1,
            source2: TSource2
        ): TObject & TSource1 & TSource2;

        /**
         * @see assign
         */
        assign<TObject, TSource1, TSource2, TSource3>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): TObject & TSource1 & TSource2 & TSource3;

        /**
         * @see assign
         */
        assign<TObject, TSource1, TSource2, TSource3, TSource4>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): TObject & TSource1 & TSource2 & TSource3 & TSource4;

        /**
         * @see _.assign
         */
        assign<TObject>(object: TObject): TObject;

        /**
         * @see _.assign
         */
        assign(
            object: any,
            ...otherArgs: any[]
        ): any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.assign
         */
        assign<TSource>(
            source: TSource
        ): LoDashImplicitWrapper<TValue & TSource>;

        /**
         * @see assign
         */
        assign<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see assign
         */
        assign<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see assign
         */
        assign<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.assign
         */
        assign(): LoDashImplicitWrapper<TValue>;

        /**
         * @see _.assign
         */
        assign(...otherArgs: any[]): LoDashImplicitWrapper<any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.assign
         */
        assign<TSource>(
            source: TSource
        ): LoDashExplicitWrapper<TValue & TSource>;

        /**
         * @see assign
         */
        assign<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see assign
         */
        assign<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see assign
         */
        assign<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.assign
         */
        assign(): LoDashExplicitWrapper<TValue>;

        /**
         * @see _.assign
         */
        assign(...otherArgs: any[]): LoDashExplicitWrapper<any>;
    }

    // assignIn

    interface LoDashStatic {
        /**
         * This method is like `_.assign` except that it iterates over own and
         * inherited source properties.
         *
         * **Note:** This method mutates `object`.
         *
         * @alias extend
         * @category Object
         * @param object The destination object.
         * @param [sources] The source objects.
         * @returns Returns `object`.
         * @example
         *
         * function Foo() {
         *   this.b = 2;
         * }
         *
         * function Bar() {
         *   this.d = 4;
         * }
         *
         * Foo.prototype.c = 3;
         * Bar.prototype.e = 5;
         *
         * _.assignIn({ 'a': 1 }, new Foo, new Bar);
         * // => { 'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5 }
         */
        assignIn<TObject, TSource>(
            object: TObject,
            source: TSource
        ): TObject & TSource;

        /**
         * @see assignIn
         */
        assignIn<TObject, TSource1, TSource2>(
            object: TObject,
            source1: TSource1,
            source2: TSource2
        ): TObject & TSource1 & TSource2;

        /**
         * @see assignIn
         */
        assignIn<TObject, TSource1, TSource2, TSource3>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): TObject & TSource1 & TSource2 & TSource3;

        /**
         * @see assignIn
         */
        assignIn<TObject, TSource1, TSource2, TSource3, TSource4>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): TObject & TSource1 & TSource2 & TSource3 & TSource4;

        /**
         * @see _.assignIn
         */
        assignIn<TObject>(object: TObject): TObject;

        /**
         * @see _.assignIn
         */
        assignIn<TResult>(
            object: any,
            ...otherArgs: any[]
        ): TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.assignIn
         */
        assignIn<TSource>(
            source: TSource
        ): LoDashImplicitWrapper<TValue & TSource>;

        /**
         * @see assignIn
         */
        assignIn<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see assignIn
         */
        assignIn<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see assignIn
         */
        assignIn<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.assignIn
         */
        assignIn(): LoDashImplicitWrapper<TValue>;

        /**
         * @see _.assignIn
         */
        assignIn<TResult>(...otherArgs: any[]): LoDashImplicitWrapper<TResult>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.assignIn
         */
        assignIn<TSource>(
            source: TSource
        ): LoDashExplicitWrapper<TValue & TSource>;

        /**
         * @see assignIn
         */
        assignIn<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see assignIn
         */
        assignIn<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see assignIn
         */
        assignIn<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.assignIn
         */
        assignIn(): LoDashExplicitWrapper<TValue>;

        /**
         * @see _.assignIn
         */
        assignIn(...otherArgs: any[]): LoDashExplicitWrapper<any>;
    }

    // assignInWith

    type AssignCustomizer = (objectValue: any, sourceValue: any, key?: string, object?: {}, source?: {}) => any;

    interface LoDashStatic {
        /**
         * This method is like `_.assignIn` except that it accepts `customizer` which
         * is invoked to produce the assigned values. If `customizer` returns `undefined`
         * assignment is handled by the method instead. The `customizer` is invoked
         * with five arguments: (objValue, srcValue, key, object, source).
         *
         * **Note:** This method mutates `object`.
         *
         * @alias extendWith
         * @category Object
         * @param object The destination object.
         * @param sources The source objects.
         * @param [customizer] The function to customize assigned values.
         * @returns Returns `object`.
         * @example
         *
         * function customizer(objValue, srcValue) {
         *   return _.isUndefined(objValue) ? srcValue : objValue;
         * }
         *
         * var defaults = _.partialRight(_.assignInWith, customizer);
         *
         * defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
         * // => { 'a': 1, 'b': 2 }
         */
        assignInWith<TObject, TSource>(
            object: TObject,
            source: TSource,
            customizer: AssignCustomizer
        ): TObject & TSource;

        /**
         * @see assignInWith
         */
        assignInWith<TObject, TSource1, TSource2>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            customizer: AssignCustomizer
        ): TObject & TSource1 & TSource2;

        /**
         * @see assignInWith
         */
        assignInWith<TObject, TSource1, TSource2, TSource3>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: AssignCustomizer
        ): TObject & TSource1 & TSource2 & TSource3;

        /**
         * @see assignInWith
         */
        assignInWith<TObject, TSource1, TSource2, TSource3, TSource4>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: AssignCustomizer
        ): TObject & TSource1 & TSource2 & TSource3 & TSource4;

        /**
         * @see _.assignInWith
         */
        assignInWith<TObject>(object: TObject): TObject;

        /**
         * @see _.assignInWith
         */
        assignInWith<TResult>(
            object: any,
            ...otherArgs: any[]
        ): TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.assignInWith
         */
        assignInWith<TSource>(
            source: TSource,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource>;

        /**
         * @see assignInWith
         */
        assignInWith<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see assignInWith
         */
        assignInWith<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see assignInWith
         */
        assignInWith<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.assignInWith
         */
        assignInWith(): LoDashImplicitWrapper<TValue>;

        /**
         * @see _.assignInWith
         */
        assignInWith<TResult>(...otherArgs: any[]): LoDashImplicitWrapper<TResult>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.assignInWith
         */
        assignInWith<TSource>(
            source: TSource,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource>;

        /**
         * @see assignInWith
         */
        assignInWith<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see assignInWith
         */
        assignInWith<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see assignInWith
         */
        assignInWith<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.assignInWith
         */
        assignInWith(): LoDashExplicitWrapper<TValue>;

        /**
         * @see _.assignInWith
         */
        assignInWith(...otherArgs: any[]): LoDashExplicitWrapper<any>;
    }

    // assignWith

    interface LoDashStatic {
        /**
         * This method is like `_.assign` except that it accepts `customizer` which
         * is invoked to produce the assigned values. If `customizer` returns `undefined`
         * assignment is handled by the method instead. The `customizer` is invoked
         * with five arguments: (objValue, srcValue, key, object, source).
         *
         * **Note:** This method mutates `object`.
         *
         * @category Object
         * @param object The destination object.
         * @param sources The source objects.
         * @param [customizer] The function to customize assigned values.
         * @returns Returns `object`.
         * @example
         *
         * function customizer(objValue, srcValue) {
         *   return _.isUndefined(objValue) ? srcValue : objValue;
         * }
         *
         * var defaults = _.partialRight(_.assignWith, customizer);
         *
         * defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
         * // => { 'a': 1, 'b': 2 }
         */
        assignWith<TObject, TSource>(
            object: TObject,
            source: TSource,
            customizer: AssignCustomizer
        ): TObject & TSource;

        /**
         * @see assignWith
         */
        assignWith<TObject, TSource1, TSource2>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            customizer: AssignCustomizer
        ): TObject & TSource1 & TSource2;

        /**
         * @see assignWith
         */
        assignWith<TObject, TSource1, TSource2, TSource3>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: AssignCustomizer
        ): TObject & TSource1 & TSource2 & TSource3;

        /**
         * @see assignWith
         */
        assignWith<TObject, TSource1, TSource2, TSource3, TSource4>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: AssignCustomizer
        ): TObject & TSource1 & TSource2 & TSource3 & TSource4;

        /**
         * @see _.assignWith
         */
        assignWith<TObject>(object: TObject): TObject;

        /**
         * @see _.assignWith
         */
        assignWith<TResult>(
            object: any,
            ...otherArgs: any[]
        ): TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.assignWith
         */
        assignWith<TSource>(
            source: TSource,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource>;

        /**
         * @see assignWith
         */
        assignWith<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see assignWith
         */
        assignWith<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see assignWith
         */
        assignWith<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.assignWith
         */
        assignWith(): LoDashImplicitWrapper<TValue>;

        /**
         * @see _.assignWith
         */
        assignWith<TResult>(...otherArgs: any[]): LoDashImplicitWrapper<TResult>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.assignWith
         */
        assignWith<TSource>(
            source: TSource,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource>;

        /**
         * @see assignWith
         */
        assignWith<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see assignWith
         */
        assignWith<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see assignWith
         */
        assignWith<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.assignWith
         */
        assignWith(): LoDashExplicitWrapper<TValue>;

        /**
         * @see _.assignWith
         */
        assignWith(...otherArgs: any[]): LoDashExplicitWrapper<any>;
    }

    // at

    interface LoDashStatic {
        /**
         * Creates an array of elements corresponding to the given keys, or indexes, of collection. Keys may be
         * specified as individual arguments or as arrays of keys.
         *
         * @param object The object to iterate over.
         * @param props The property names or indexes of elements to pick, specified individually or in arrays.
         * @return Returns the new array of picked elements.
         */
        at<T>(
            object: List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined,
            ...props: PropertyPath[]
        ): T[];

        /**
         * @see _.at
         */
        at<T extends object>(
            object: T | null | undefined,
            ...props: Array<Many<keyof T>>
        ): Array<T[keyof T]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.at
         */
        at<T>(
            this: LoDashImplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            ...props: PropertyPath[]
        ): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.at
         */
        at<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            ...props: Array<Many<keyof T>>
        ): LoDashImplicitWrapper<Array<T[keyof T]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.at
         */
        at<T>(
            this: LoDashExplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            ...props: PropertyPath[]
        ): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.at
         */
        at<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            ...props: Array<Many<keyof T>>
        ): LoDashExplicitWrapper<Array<T[keyof T]>>;
    }

    // create

    interface LoDashStatic {
        /**
         * Creates an object that inherits from the given prototype object. If a properties object is provided its own
         * enumerable properties are assigned to the created object.
         *
         * @param prototype The object to inherit from.
         * @param properties The properties to assign to the object.
         * @return Returns the new object.
         */
        create<T extends object, U extends object>(
            prototype: T,
            properties?: U
        ): T & U;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.create
         */
        create<U extends object>(properties?: U): LoDashImplicitWrapper<TValue & U>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.create
         */
        create<U extends object>(properties?: U): LoDashExplicitWrapper<TValue & U>;
    }

    // defaults

    interface LoDashStatic {
        /**
         * Assigns own enumerable properties of source object(s) to the destination object for all destination
         * properties that resolve to undefined. Once a property is set, additional values of the same property are
         * ignored.
         *
         * Note: This method mutates object.
         *
         * @param object The destination object.
         * @param sources The source objects.
         * @return The destination object.
         */
        defaults<TObject, TSource>(
            object: TObject,
            source: TSource
        ): NonNullable<TSource & TObject>;

        /**
         * @see _.defaults
         */
        defaults<TObject, TSource1, TSource2>(
            object: TObject,
            source1: TSource1,
            source2: TSource2
        ): NonNullable<TSource2 & TSource1 & TObject>;

        /**
         * @see _.defaults
         */
        defaults<TObject, TSource1, TSource2, TSource3>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): NonNullable<TSource3 & TSource2 & TSource1 & TObject>;

        /**
         * @see _.defaults
         */
        defaults<TObject, TSource1, TSource2, TSource3, TSource4>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): NonNullable<TSource4 & TSource3 & TSource2 & TSource1 & TObject>;

        /**
         * @see _.defaults
         */
        defaults<TObject>(object: TObject): NonNullable<TObject>;

        /**
         * @see _.defaults
         */
        defaults(
            object: any,
            ...sources: any[]
        ): any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.defaults
         */
        defaults<TSource>(
            source: TSource
        ): LoDashImplicitWrapper<NonNullable<TSource & TValue>>;

        /**
         * @see _.defaults
         */
        defaults<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2
        ): LoDashImplicitWrapper<NonNullable<TSource2 & TSource1 & TValue>>;

        /**
         * @see _.defaults
         */
        defaults<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): LoDashImplicitWrapper<NonNullable<TSource3 & TSource2 & TSource1 & TValue>>;

        /**
         * @see _.defaults
         */
        defaults<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): LoDashImplicitWrapper<NonNullable<TSource4 & TSource3 & TSource2 & TSource1 & TValue>>;

        /**
         * @see _.defaults
         */
        defaults(): LoDashImplicitWrapper<NonNullable<TValue>>;

        /**
         * @see _.defaults
         */
        defaults(...sources: any[]): LoDashImplicitWrapper<any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.defaults
         */
        defaults<TSource>(
            source: TSource
        ): LoDashExplicitWrapper<NonNullable<TSource & TValue>>;

        /**
         * @see _.defaults
         */
        defaults<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2
        ): LoDashExplicitWrapper<NonNullable<TSource2 & TSource1 & TValue>>;

        /**
         * @see _.defaults
         */
        defaults<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): LoDashExplicitWrapper<NonNullable<TSource3 & TSource2 & TSource1 & TValue>>;

        /**
         * @see _.defaults
         */
        defaults<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): LoDashExplicitWrapper<NonNullable<TSource4 & TSource3 & TSource2 & TSource1 & TValue>>;

        /**
         * @see _.defaults
         */
        defaults(): LoDashExplicitWrapper<NonNullable<TValue>>;

        /**
         * @see _.defaults
         */
        defaults(...sources: any[]): LoDashExplicitWrapper<any>;
    }

    // defaultsDeep

    interface LoDashStatic {
        /**
         * This method is like _.defaults except that it recursively assigns default properties.
         * @param object The destination object.
         * @param sources The source objects.
         * @return Returns object.
         **/
        defaultsDeep(
            object: any,
            ...sources: any[]): any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.defaultsDeep
         **/
        defaultsDeep(...sources: any[]): LoDashImplicitWrapper<any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.defaultsDeep
         **/
        defaultsDeep(...sources: any[]): LoDashExplicitWrapper<any>;
    }

    // entries

    interface LoDashStatic {
        /**
         * @see _.toPairs
         */
        entries<T>(object?: Dictionary<T> | NumericDictionary<T>): Array<[string, T]>;

        /**
         * @see _.toPairs
         */
        entries(object?: object): Array<[string, any]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.toPairs
         */
        entries<T>(this: LoDashImplicitWrapper<Dictionary<T> | NumericDictionary<T>>): LoDashImplicitWrapper<Array<[string, T]>>;

        /**
         * @see _.toPairs
         */
        entries(): LoDashImplicitWrapper<Array<[string, any]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.toPairs
         */
        entries<T>(this: LoDashExplicitWrapper<Dictionary<T> | NumericDictionary<T>>): LoDashExplicitWrapper<Array<[string, T]>>;

        /**
         * @see _.toPairs
         */
        entries(): LoDashExplicitWrapper<Array<[string, any]>>;
    }

    // entriesIn

    interface LoDashStatic {
        /**
         * @see _.entriesIn
         */
        entriesIn<T>(object?: Dictionary<T> | NumericDictionary<T>): Array<[string, T]>;

        /**
         * @see _.entriesIn
         */
        entriesIn(object?: object): Array<[string, any]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.entriesIn
         */
        entriesIn<T>(this: LoDashImplicitWrapper<Dictionary<T> | NumericDictionary<T>>): LoDashImplicitWrapper<Array<[string, T]>>;

        /**
         * @see _.entriesIn
         */
        entriesIn(): LoDashImplicitWrapper<Array<[string, any]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.entriesIn
         */
        entriesIn<T>(this: LoDashExplicitWrapper<Dictionary<T> | NumericDictionary<T>>): LoDashExplicitWrapper<Array<[string, T]>>;

        /**
         * @see _.entriesIn
         */
        entriesIn(): LoDashExplicitWrapper<Array<[string, any]>>;
    }

    // extend

    interface LoDashStatic {
        /**
         * @see _.extend
         */
        extend<TObject, TSource>(
            object: TObject,
            source: TSource
        ): TObject & TSource;

        /**
         * @see _.extend
         */
        extend<TObject, TSource1, TSource2>(
            object: TObject,
            source1: TSource1,
            source2: TSource2
        ): TObject & TSource1 & TSource2;

        /**
         * @see _.extend
         */
        extend<TObject, TSource1, TSource2, TSource3>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): TObject & TSource1 & TSource2 & TSource3;

        /**
         * @see _.extend
         */
        extend<TObject, TSource1, TSource2, TSource3, TSource4>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): TObject & TSource1 & TSource2 & TSource3 & TSource4;

        /**
         * @see _.extend
         */
        extend<TObject>(object: TObject): TObject;

        /**
         * @see _.extend
         */
        extend<TResult>(
            object: any,
            ...otherArgs: any[]
        ): TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.extend
         */
        extend<TSource>(
            source: TSource
        ): LoDashImplicitWrapper<TValue & TSource>;

        /**
         * @see _.extend
         */
        extend<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see _.extend
         */
        extend<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see _.extend
         */
        extend<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.extend
         */
        extend(): LoDashImplicitWrapper<TValue>;

        /**
         * @see _.extend
         */
        extend(...otherArgs: any[]): LoDashImplicitWrapper<any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.extend
         */
        extend<TSource>(
            source: TSource
        ): LoDashExplicitWrapper<TValue & TSource>;

        /**
         * @see _.extend
         */
        extend<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see _.extend
         */
        extend<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see _.extend
         */
        extend<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.extend
         */
        extend(): LoDashExplicitWrapper<TValue>;

        /**
         * @see _.extend
         */
        extend(...otherArgs: any[]): LoDashExplicitWrapper<any>;
    }

    // extendWith

    interface LoDashStatic {
        /**
         * @see _.extendWith
         */
        extendWith<TObject, TSource>(
            object: TObject,
            source: TSource,
            customizer: AssignCustomizer
        ): TObject & TSource;

        /**
         * @see _.extendWith
         */
        extendWith<TObject, TSource1, TSource2>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            customizer: AssignCustomizer
        ): TObject & TSource1 & TSource2;

        /**
         * @see _.extendWith
         */
        extendWith<TObject, TSource1, TSource2, TSource3>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: AssignCustomizer
        ): TObject & TSource1 & TSource2 & TSource3;

        /**
         * @see _.extendWith
         */
        extendWith<TObject, TSource1, TSource2, TSource3, TSource4>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: AssignCustomizer
        ): TObject & TSource1 & TSource2 & TSource3 & TSource4;

        /**
         * @see _.extendWith
         */
        extendWith<TObject>(object: TObject): TObject;

        /**
         * @see _.extendWith
         */
        extendWith<TResult>(
            object: any,
            ...otherArgs: any[]
        ): TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.extendWith
         */
        extendWith<TSource>(
            source: TSource,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource>;

        /**
         * @see _.extendWith
         */
        extendWith<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see _.extendWith
         */
        extendWith<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see _.extendWith
         */
        extendWith<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: AssignCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.extendWith
         */
        extendWith(): LoDashImplicitWrapper<TValue>;

        /**
         * @see _.extendWith
         */
        extendWith(...otherArgs: any[]): LoDashImplicitWrapper<any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.extendWith
         */
        extendWith<TSource>(
            source: TSource,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource>;

        /**
         * @see _.extendWith
         */
        extendWith<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see _.extendWith
         */
        extendWith<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see _.extendWith
         */
        extendWith<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: AssignCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.extendWith
         */
        extendWith(): LoDashExplicitWrapper<TValue>;

        /**
         * @see _.extendWith
         */
        extendWith(...otherArgs: any[]): LoDashExplicitWrapper<any>;
    }

    // findKey

    interface LoDashStatic {
        /**
         * This method is like _.find except that it returns the key of the first element predicate returns truthy for
         * instead of the element itself.
         *
         * @param object The object to search.
         * @param predicate The function invoked per iteration.
         * @return Returns the key of the matched element, else undefined.
         */
        findKey<T>(
            object: T | null | undefined,
            predicate?: ObjectIteratee<T>
        ): string | undefined;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.findKey
         */
        findKey<T>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate?: ObjectIteratee<T>
        ): string | undefined;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.findKey
         */
        findKey<T>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate?: ObjectIteratee<T>
        ): LoDashExplicitWrapper<string | undefined>;
    }

    // findLastKey

    interface LoDashStatic {
        /**
         * This method is like _.findKey except that it iterates over elements of a collection in the opposite order.
         *
         * @param object The object to search.
         * @param predicate The function invoked per iteration.
         * @return Returns the key of the matched element, else undefined.
         */
        findLastKey<T>(
            object: T | null | undefined,
            predicate?: ObjectIteratee<T>
        ): string | undefined;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.findLastKey
         */
        findLastKey<T>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate?: ObjectIteratee<T>
        ): string | undefined;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.findLastKey
         */
        findLastKey<T>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate?: ObjectIteratee<T>
        ): LoDashExplicitWrapper<string | undefined>;
    }

    // forIn

    interface LoDashStatic {
        /**
         * Iterates over own and inherited enumerable properties of an object invoking iteratee for each property. The
         * iteratee is invoked with three arguments: (value, key, object). Iteratee functions may
         * exit iteration early by explicitly returning false.
         *
         * @param object The object to iterate over.
         * @param iteratee The function invoked per iteration.
         * @return Returns object.
         */
        forIn<T>(
            object: T,
            iteratee?: ObjectIterator<T, any>
        ): T;

        /**
         * @see _.forIn
         */
        forIn<T>(
            object: T | null | undefined,
            iteratee?: ObjectIterator<T, any>
        ): T | null | undefined;
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.forIn
         */
        forIn<T>(
            this: LoDashWrapper<T | null | undefined>,
            iteratee?: ObjectIterator<T, any>
        ): this;
    }

    // forInRight

    interface LoDashStatic {
        /**
         * This method is like _.forIn except that it iterates over properties of object in the opposite order.
         *
         * @param object The object to iterate over.
         * @param iteratee The function invoked per iteration.
         * @return Returns object.
         */
        forInRight<T>(
            object: T,
            iteratee?: ObjectIterator<T, any>
        ): T;

        /**
         * @see _.forInRight
         */
        forInRight<T>(
            object: T | null | undefined,
            iteratee?: ObjectIterator<T, any>
        ): T | null | undefined;
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.forInRight
         */
        forInRight<T>(
            this: LoDashWrapper<T | null | undefined>,
            iteratee?: ObjectIterator<T, any>
        ): this;
    }

    // forOwn

    interface LoDashStatic {
        /**
         * Iterates over own enumerable properties of an object invoking iteratee for each property. The iteratee is
         * invoked with three arguments: (value, key, object). Iteratee functions may exit
         * iteration early by explicitly returning false.
         *
         * @param object The object to iterate over.
         * @param iteratee The function invoked per iteration.
         * @return Returns object.
         */
        forOwn<T>(
            object: T,
            iteratee?: ObjectIterator<T, any>
        ): T;

        /**
         * @see _.forOwn
         */
        forOwn<T>(
            object: T | null | undefined,
            iteratee?: ObjectIterator<T, any>
        ): T | null | undefined;
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.forOwn
         */
        forOwn<T>(
            this: LoDashWrapper<T | null | undefined>,
            iteratee?: ObjectIterator<T, any>
        ): this;
    }

    // forOwnRight

    interface LoDashStatic {
        /**
         * This method is like _.forOwn except that it iterates over properties of object in the opposite order.
         *
         * @param object The object to iterate over.
         * @param iteratee The function invoked per iteration.
         * @return Returns object.
         */
        forOwnRight<T>(
            object: T,
            iteratee?: ObjectIterator<T, any>
        ): T;

        /**
         * @see _.forOwnRight
         */
        forOwnRight<T>(
            object: T | null | undefined,
            iteratee?: ObjectIterator<T, any>
        ): T | null | undefined;
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.forOwnRight
         */
        forOwnRight<T>(
            this: LoDashWrapper<T | null | undefined>,
            iteratee?: ObjectIterator<T, any>
        ): this;
    }

    // functions

    interface LoDashStatic {
        /**
         * Creates an array of function property names from own enumerable properties
         * of `object`.
         *
         * @category Object
         * @param object The object to inspect.
         * @returns Returns the new array of property names.
         * @example
         *
         * function Foo() {
         *   this.a = _.constant('a');
         *   this.b = _.constant('b');
         * }
         *
         * Foo.prototype.c = _.constant('c');
         *
         * _.functions(new Foo);
         * // => ['a', 'b']
         */
        functions(object: any): string[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.functions
         */
        functions(): LoDashImplicitWrapper<string[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.functions
         */
        functions(): LoDashExplicitWrapper<string[]>;
    }

    // functionsIn

    interface LoDashStatic {
        /**
         * Creates an array of function property names from own and inherited
         * enumerable properties of `object`.
         *
         * @category Object
         * @param object The object to inspect.
         * @returns Returns the new array of property names.
         * @example
         *
         * function Foo() {
         *   this.a = _.constant('a');
         *   this.b = _.constant('b');
         * }
         *
         * Foo.prototype.c = _.constant('c');
         *
         * _.functionsIn(new Foo);
         * // => ['a', 'b', 'c']
         */
        functionsIn<T extends {}>(object: any): string[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.functionsIn
         */
        functionsIn(): LoDashImplicitWrapper<string[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.functionsIn
         */
        functionsIn(): LoDashExplicitWrapper<string[]>;
    }

    // get

    interface LoDashStatic {
        /**
         * Gets the property value at path of object. If the resolved value is undefined the defaultValue is used
         * in its place.
         *
         * @param object The object to query.
         * @param path The path of the property to get.
         * @param defaultValue The value returned if the resolved value is undefined.
         * @return Returns the resolved value.
         */
        get<TObject extends object, TKey extends keyof TObject>(
            object: TObject,
            path: TKey | [TKey]
        ): TObject[TKey];

        /**
         * @see _.get
         */
        get<TObject extends object, TKey extends keyof TObject>(
            object: TObject | null | undefined,
            path: TKey | [TKey]
        ): TObject[TKey] | undefined;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey extends keyof TObject, TDefault>(
            object: TObject | null | undefined,
            path: TKey | [TKey],
            defaultValue: TDefault
        ): Exclude<TObject[TKey], undefined> | TDefault;

          /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1]>(
            object: TObject | null | undefined,
            path: [TKey1, TKey2]
        ): TObject[TKey1][TKey2] | undefined;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TDefault>(
            object: TObject | null | undefined,
            path: [TKey1, TKey2],
            defaultValue: TDefault
        ): Exclude<TObject[TKey1][TKey2], undefined> | TDefault;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2]>(
            object: TObject | null | undefined,
            path: [TKey1, TKey2, TKey3]
        ): TObject[TKey1][TKey2][TKey3] | undefined;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TDefault>(
            object: TObject | null | undefined,
            path: [TKey1, TKey2, TKey3],
            defaultValue: TDefault
        ): Exclude<TObject[TKey1][TKey2][TKey3], undefined> | TDefault;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TKey4 extends keyof TObject[TKey1][TKey2][TKey3]>(
            object: TObject | null | undefined,
            path: [TKey1, TKey2, TKey3, TKey4]
        ): TObject[TKey1][TKey2][TKey3][TKey4] | undefined;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TKey4 extends keyof TObject[TKey1][TKey2][TKey3], TDefault>(
            object: TObject | null | undefined,
            path: [TKey1, TKey2, TKey3, TKey4],
            defaultValue: TDefault
        ): Exclude<TObject[TKey1][TKey2][TKey3][TKey4], undefined> | TDefault;

        /**
         * @see _.get
         */
        get<T>(
            object: NumericDictionary<T>,
            path: number
        ): T;

        /**
         * @see _.get
         */
        get<T>(
            object: NumericDictionary<T> | null | undefined,
            path: number
        ): T | undefined;

        /**
         * @see _.get
         */
        get<T, TDefault>(
            object: NumericDictionary<T> | null | undefined,
            path: number,
            defaultValue: TDefault
        ): T | TDefault;

        /**
         * @see _.get
         */
        get<TDefault>(
            object: null | undefined,
            path: PropertyPath,
            defaultValue: TDefault
        ): TDefault;

        /**
         * @see _.get
         */
        get(
            object: null | undefined,
            path: PropertyPath
        ): undefined;

        /**
         * @see _.get
         */
        get(
            object: any,
            path: PropertyPath,
            defaultValue?: any
        ): any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.get
         */
        get<TKey extends keyof TValue>(
            path: TKey | [TKey]
        ): TValue[TKey];

        /**
         * @see _.get
         */
        get<TObject extends object, TKey extends keyof TObject>(
            this: LoDashImplicitWrapper<TObject | null | undefined>,
            path: TKey | [TKey],
        ): TObject[TKey] | undefined;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey extends keyof TObject, TDefault>(
            this: LoDashImplicitWrapper<TObject | null | undefined>,
            path: TKey | [TKey],
            defaultValue: TDefault
        ): Exclude<TObject[TKey], undefined> | TDefault;

        /**
         * @see _.get
         */
        get<TKey1 extends keyof TValue, TKey2 extends keyof TValue[TKey1]>(
            path: [TKey1, TKey2]
        ): TValue[TKey1][TKey2];

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1]>(
            this: LoDashImplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2],
        ): TObject[TKey1][TKey2] | undefined;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TDefault>(
            this: LoDashImplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2, TKey3],
            defaultValue: TDefault
        ): Exclude<TObject[TKey1][TKey2][TKey3], undefined> | TDefault;

        /**
         * @see _.get
         */
        get<TKey1 extends keyof TValue, TKey2 extends keyof TValue[TKey1], TKey3 extends keyof TValue[TKey1][TKey2], TKey4 extends keyof TValue[TKey1][TKey2][TKey3]>(
            path: [TKey1, TKey2, TKey3, TKey4]
        ): TValue[TKey1][TKey2][TKey3][TKey4];

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TKey4 extends keyof TObject[TKey1][TKey2][TKey3]>(
            this: LoDashImplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2, TKey3, TKey4],
        ): TObject[TKey1][TKey2][TKey3][TKey4] | undefined;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TKey4 extends keyof TObject[TKey1][TKey2][TKey3], TDefault>(
            this: LoDashImplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2, TKey3, TKey4],
            defaultValue: TDefault
        ): Exclude<TObject[TKey1][TKey2][TKey3][TKey4], undefined> | TDefault;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TKey4 extends keyof TObject[TKey1][TKey2][TKey3], TDefault>(
            this: LoDashImplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2, TKey3, TKey4],
            defaultValue: TDefault
        ): Exclude<TObject[TKey1][TKey2][TKey3][TKey4], undefined> | TDefault;

        /**
         * @see _.get
         */
        get<TKey1 extends keyof TValue, TKey2 extends keyof TValue[TKey1], TKey3 extends keyof TValue[TKey1][TKey2], TKey4 extends keyof TValue[TKey1][TKey2][TKey3]>(
            path: [TKey1, TKey2, TKey3, TKey4]
        ): TValue[TKey1][TKey2][TKey3][TKey4];

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TKey4 extends keyof TObject[TKey1][TKey2][TKey3]>(
            this: LoDashImplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2, TKey3, TKey4],
        ): TObject[TKey1][TKey2][TKey3][TKey4] | undefined;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TKey4 extends keyof TObject[TKey1][TKey2][TKey3], TDefault>(
            this: LoDashImplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2, TKey3, TKey4],
            defaultValue: TDefault
        ): Exclude<TObject[TKey1][TKey2][TKey3][TKey4], undefined> | TDefault;

        /**
         * @see _.get
         */
        get<T>(
            this: LoDashImplicitWrapper<NumericDictionary<T>>,
            path: number
        ): T;

        /**
         * @see _.get
         */
        get<T>(
            this: LoDashImplicitWrapper<NumericDictionary<T> | null | undefined>,
            path: number
        ): T | undefined;

        /**
         * @see _.get
         */
        get<T, TDefault>(
            this: LoDashImplicitWrapper<NumericDictionary<T> | null | undefined>,
            path: number,
            defaultValue: TDefault
        ): T | TDefault;

        /**
         * @see _.get
         */
        get<TDefault>(
            this: LoDashImplicitWrapper<null | undefined>,
            path: PropertyPath,
            defaultValue: TDefault
        ): TDefault;

        /**
         * @see _.get
         */
        get(
            this: LoDashImplicitWrapper<null | undefined>,
            path: PropertyPath
        ): undefined;

        /**
         * @see _.get
         */
        get<TResult>(
            path: PropertyPath,
            defaultValue?: any
        ): any;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.get
         */
        get<TKey extends keyof TValue>(
            path: TKey | [TKey]
        ): LoDashExplicitWrapper<TValue[TKey]>;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey extends keyof TObject>(
            this: LoDashExplicitWrapper<TObject | null | undefined>,
            path: TKey | [TKey],
        ): LoDashExplicitWrapper<TObject[TKey] | undefined>;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey extends keyof TObject, TDefault>(
            this: LoDashExplicitWrapper<TObject | null | undefined>,
            path: TKey | [TKey],
            defaultValue: TDefault
        ): LoDashExplicitWrapper<Exclude<TObject[TKey], undefined> | TDefault>;

        /**
         * @see _.get
         */
        get<TKey1 extends keyof TValue, TKey2 extends keyof TValue[TKey1]>(
            path: [TKey1, TKey2]
        ): LoDashExplicitWrapper<TValue[TKey1][TKey2]>;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1]>(
            this: LoDashExplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2],
        ): LoDashExplicitWrapper<TObject[TKey1][TKey2] | undefined>;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TDefault>(
            this: LoDashExplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2],
            defaultValue: TDefault
        ): LoDashExplicitWrapper<Exclude<TObject[TKey1][TKey2], undefined> | TDefault>;

        /**
         * @see _.get
         */
        get<TKey1 extends keyof TValue, TKey2 extends keyof TValue[TKey1], TKey3 extends keyof TValue[TKey1][TKey2]>(
            path: [TKey1, TKey2, TKey3]
        ): LoDashExplicitWrapper<TValue[TKey1][TKey2][TKey3]>;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2]>(
            this: LoDashExplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2, TKey3],
        ): LoDashExplicitWrapper<TObject[TKey1][TKey2][TKey3] | undefined>;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TDefault>(
            this: LoDashExplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2, TKey3],
            defaultValue: TDefault
        ): LoDashExplicitWrapper<Exclude<TObject[TKey1][TKey2][TKey3], undefined> | TDefault>;

         /**
         * @see _.get
         */
        get<TKey1 extends keyof TValue, TKey2 extends keyof TValue[TKey1], TKey3 extends keyof TValue[TKey1][TKey2], TKey4 extends keyof TValue[TKey1][TKey2][TKey3]>(
            path: [TKey1, TKey2, TKey3, TKey4]
        ): LoDashExplicitWrapper<TValue[TKey1][TKey2][TKey3][TKey4]>;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TKey4 extends keyof TObject[TKey1][TKey2][TKey3]>(
            this: LoDashExplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2, TKey3, TKey4],
        ): LoDashExplicitWrapper<TObject[TKey1][TKey2][TKey3][TKey4] | undefined>;

        /**
         * @see _.get
         */
        get<TObject extends object, TKey1 extends keyof TObject, TKey2 extends keyof TObject[TKey1], TKey3 extends keyof TObject[TKey1][TKey2], TKey4 extends keyof TObject[TKey1][TKey2][TKey3], TDefault>(
            this: LoDashExplicitWrapper<TObject | null | undefined>,
            path: [TKey1, TKey2, TKey3, TKey4],
            defaultValue: TDefault
        ): LoDashExplicitWrapper<Exclude<TObject[TKey1][TKey2][TKey3][TKey4], undefined> | TDefault>;

        /**
         * @see _.get
         */
        get<T>(
            this: LoDashExplicitWrapper<NumericDictionary<T>>,
            path: number
        ): LoDashExplicitWrapper<T>;

        /**
         * @see _.get
         */
        get<T>(
            this: LoDashExplicitWrapper<NumericDictionary<T> | null | undefined>,
            path: number
        ): LoDashExplicitWrapper<T | undefined>;

        /**
         * @see _.get
         */
        get<T, TDefault>(
            this: LoDashExplicitWrapper<NumericDictionary<T> | null | undefined>,
            path: number,
            defaultValue: TDefault
        ): LoDashExplicitWrapper<T | undefined>;

        /**
         * @see _.get
         */
        get<TDefault>(
            this: LoDashExplicitWrapper<null | undefined>,
            path: PropertyPath,
            defaultValue: TDefault
        ): LoDashExplicitWrapper<TDefault>;

        /**
         * @see _.get
         */
        get(
            this: LoDashExplicitWrapper<null | undefined>,
            path: PropertyPath
        ): LoDashExplicitWrapper<undefined>;

        /**
         * @see _.get
         */
        get(
            path: PropertyPath,
            defaultValue?: any
        ): LoDashExplicitWrapper<any>;
    }

    // has

    interface LoDashStatic {
        /**
         * Checks if `path` is a direct property of `object`.
         *
         * @category Object
         * @param object The object to query.
         * @param path The path to check.
         * @returns Returns `true` if `path` exists, else `false`.
         * @example
         *
         * var object = { 'a': { 'b': { 'c': 3 } } };
         * var other = _.create({ 'a': _.create({ 'b': _.create({ 'c': 3 }) }) });
         *
         * _.has(object, 'a');
         * // => true
         *
         * _.has(object, 'a.b.c');
         * // => true
         *
         * _.has(object, ['a', 'b', 'c']);
         * // => true
         *
         * _.has(other, 'a');
         * // => false
         */
        has<T>(
            object: T,
            path: PropertyPath
        ): boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.has
         */
        has(path: PropertyPath): boolean;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.has
         */
        has(path: PropertyPath): LoDashExplicitWrapper<boolean>;
    }

    // hasIn

    interface LoDashStatic {
        /**
         * Checks if `path` is a direct or inherited property of `object`.
         *
         * @category Object
         * @param object The object to query.
         * @param path The path to check.
         * @returns Returns `true` if `path` exists, else `false`.
         * @example
         *
         * var object = _.create({ 'a': _.create({ 'b': _.create({ 'c': 3 }) }) });
         *
         * _.hasIn(object, 'a');
         * // => true
         *
         * _.hasIn(object, 'a.b.c');
         * // => true
         *
         * _.hasIn(object, ['a', 'b', 'c']);
         * // => true
         *
         * _.hasIn(object, 'b');
         * // => false
         */
        hasIn<T>(
            object: T,
            path: PropertyPath
        ): boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.hasIn
         */
        hasIn(path: PropertyPath): boolean;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.hasIn
         */
        hasIn(path: PropertyPath): LoDashExplicitWrapper<boolean>;
    }

    // invert

    interface LoDashStatic {
        /**
         * Creates an object composed of the inverted keys and values of object. If object contains duplicate values,
         * subsequent values overwrite property assignments of previous values unless multiValue is true.
         *
         * @param object The object to invert.
         * @param multiValue Allow multiple values per key.
         * @return Returns the new inverted object.
         */
        invert(
            object: object
        ): Dictionary<string>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.invert
         */
        invert(): LoDashImplicitWrapper<Dictionary<string>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.invert
         */
        invert(): LoDashExplicitWrapper<Dictionary<string>>;
    }

    // invertBy

    interface LoDashStatic {
        /**
         * This method is like _.invert except that the inverted object is generated from the results of running each
         * element of object through iteratee. The corresponding inverted value of each inverted key is an array of
         * keys responsible for generating the inverted value. The iteratee is invoked with one argument: (value).
         *
         * @param object The object to invert.
         * @param interatee The iteratee invoked per element.
         * @return Returns the new inverted object.
         */
        invertBy<T>(
            object: List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined,
            interatee?: ValueIteratee<T>
        ): Dictionary<string[]>;

        /**
         * @see _.invertBy
         */
        invertBy<T extends object>(
            object: T | null | undefined,
            interatee?: ValueIteratee<T[keyof T]>
        ): Dictionary<string[]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.invertBy
         */
        invertBy<T>(
            this: LoDashImplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            interatee?: ValueIteratee<T>
        ): LoDashImplicitWrapper<Dictionary<string[]>>;

        /**
         * @see _.invertBy
         */
        invertBy<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            interatee?: ValueIteratee<T[keyof T]>
        ): LoDashImplicitWrapper<Dictionary<string[]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.invertBy
         */
        invertBy<T>(
            this: LoDashExplicitWrapper<List<T> | Dictionary<T> | NumericDictionary<T> | null | undefined>,
            interatee?: ValueIteratee<T>
        ): LoDashExplicitWrapper<Dictionary<string[]>>;

        /**
         * @see _.invertBy
         */
        invertBy<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            interatee?: ValueIteratee<T[keyof T]>
        ): LoDashExplicitWrapper<Dictionary<string[]>>;
    }

    // invoke

    interface LoDashStatic {
        /**
        * Invokes the method at path of object.
        * @param object The object to query.
        * @param path The path of the method to invoke.
        * @param args The arguments to invoke the method with.
        **/
        invoke(
            object: any,
            path: PropertyPath,
            ...args: any[]): any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
        * @see _.invoke
        **/
        invoke(
            path: PropertyPath,
            ...args: any[]): any;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
        * @see _.invoke
        **/
        invoke(
            path: PropertyPath,
            ...args: any[]): LoDashExplicitWrapper<any>;
    }

    // keys

    interface LoDashStatic {
        /**
         * Creates an array of the own enumerable property names of object.
         *
         * Note: Non-object values are coerced to objects. See the ES spec for more details.
         *
         * @param object The object to query.
         * @return Returns the array of property names.
         */
        keys(object?: any): string[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.keys
         */
        keys(): LoDashImplicitWrapper<string[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.keys
         */
        keys(): LoDashExplicitWrapper<string[]>;
    }

    // keysIn

    interface LoDashStatic {
        /**
         * Creates an array of the own and inherited enumerable property names of object.
         *
         * Note: Non-object values are coerced to objects.
         *
         * @param object The object to query.
         * @return An array of property names.
         */
        keysIn(object?: any): string[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.keysIn
         */
        keysIn(): LoDashImplicitWrapper<string[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.keysIn
         */
        keysIn(): LoDashExplicitWrapper<string[]>;
    }

    // mapKeys

    interface LoDashStatic {
        /**
         * The opposite of _.mapValues; this method creates an object with the same values as object and keys generated
         * by running each own enumerable property of object through iteratee.
         *
         * @param object The object to iterate over.
         * @param iteratee The function invoked per iteration.
         * @return Returns the new mapped object.
         */
        mapKeys<T>(
            object: List<T> | null | undefined,
            iteratee?: ListIteratee<T>
        ): Dictionary<T>;

        /**
         * @see _.mapKeys
         */
        mapKeys<T extends object>(
            object: T | null | undefined,
            iteratee?: ObjectIteratee<T>
        ): Dictionary<T[keyof T]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.mapKeys
         */
        mapKeys<T>(
            this: LoDashImplicitWrapper<List<T> | null | undefined>,
            iteratee?: ListIteratee<T>
        ): LoDashImplicitWrapper<Dictionary<T>>;

        /**
         * @see _.mapKeys
         */
        mapKeys<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratee?: ObjectIteratee<T>
        ): LoDashImplicitWrapper<Dictionary<T[keyof T]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.mapKeys
         */
        mapKeys<T>(
            this: LoDashExplicitWrapper<List<T> | null | undefined>,
            iteratee?: ListIteratee<T>
        ): LoDashExplicitWrapper<Dictionary<T>>;

        /**
         * @see _.mapKeys
         */
        mapKeys<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratee?: ObjectIteratee<T>
        ): LoDashExplicitWrapper<Dictionary<T[keyof T]>>;
    }

    // mapValues

    interface LoDashStatic {
        /**
        * Creates an object with the same keys as object and values generated by running each own
        * enumerable property of object through iteratee. The iteratee function is
        * invoked with three arguments: (value, key, object).
        *
        * @param object The object to iterate over.
        * @param iteratee  The function invoked per iteration.
        * @return Returns the new mapped object.
        */
        mapValues<TResult>(obj: string | null | undefined, callback: StringIterator<TResult>): NumericDictionary<TResult>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T, TResult>(obj: Dictionary<T> | NumericDictionary<T> | null | undefined, callback: DictionaryIterator<T, TResult>): Dictionary<TResult>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object, TResult>(obj: T | null | undefined, callback: ObjectIterator<T, TResult>): { [P in keyof T]: TResult };

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T>(obj: Dictionary<T> | NumericDictionary<T> | null | undefined, iteratee: object): Dictionary<boolean>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(obj: T | null | undefined, iteratee: object): { [P in keyof T]: boolean };

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T, TKey extends keyof T>(obj: Dictionary<T> | NumericDictionary<T> | null | undefined, iteratee: TKey): Dictionary<T[TKey]>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T>(obj: Dictionary<T> | NumericDictionary<T> | null | undefined, iteratee: string): Dictionary<any>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(obj: T | null | undefined, iteratee: string): { [P in keyof T]: any };

        /**
         * @see _.mapValues
         */
        mapValues(obj: string | null | undefined): NumericDictionary<string>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T>(obj: Dictionary<T> | NumericDictionary<T> | null | undefined): Dictionary<T>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(obj: T): T;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(obj: T | null | undefined): PartialObject<T>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.mapValues
         */
        mapValues<TResult>(
            this: LoDashImplicitWrapper<string | null | undefined>,
            callback: StringIterator<TResult>
        ): LoDashImplicitWrapper<NumericDictionary<TResult>>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T, TResult>(
            this: LoDashImplicitWrapper<Dictionary<T> | NumericDictionary<T> | null | undefined>,
            callback: DictionaryIterator<T, TResult>
        ): LoDashImplicitWrapper<Dictionary<TResult>>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object, TResult>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            callback: ObjectIterator<T, TResult>
        ): LoDashImplicitWrapper<{ [P in keyof T]: TResult }>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T>(
            this: LoDashImplicitWrapper<Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee: object
        ): LoDashImplicitWrapper<Dictionary<boolean>>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratee: object
        ): LoDashImplicitWrapper<{ [P in keyof T]: boolean }>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T, TKey extends keyof T>(
            this: LoDashImplicitWrapper<Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee: TKey
        ): LoDashImplicitWrapper<Dictionary<T[TKey]>>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T>(
            this: LoDashImplicitWrapper<Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee: string
        ): LoDashImplicitWrapper<Dictionary<any>>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            iteratee: string
        ): LoDashImplicitWrapper<{ [P in keyof T]: any }>;

        /**
         * @see _.mapValues
         */
        mapValues(this: LoDashImplicitWrapper<string | null | undefined>): LoDashImplicitWrapper<NumericDictionary<string>>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T>(this: LoDashImplicitWrapper<Dictionary<T> | NumericDictionary<T> | null | undefined>): LoDashImplicitWrapper<Dictionary<T>>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(this: LoDashImplicitWrapper<T>): LoDashImplicitWrapper<T>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(this: LoDashImplicitWrapper<T | null | undefined>): LoDashImplicitWrapper<PartialObject<T>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.mapValues
         */
        mapValues<TResult>(
            this: LoDashExplicitWrapper<string | null | undefined>,
            callback: StringIterator<TResult>
        ): LoDashExplicitWrapper<NumericDictionary<TResult>>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T, TResult>(
            this: LoDashExplicitWrapper<Dictionary<T> | NumericDictionary<T> | null | undefined>,
            callback: DictionaryIterator<T, TResult>
        ): LoDashExplicitWrapper<Dictionary<TResult>>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object, TResult>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            callback: ObjectIterator<T, TResult>
        ): LoDashExplicitWrapper<{ [P in keyof T]: TResult }>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T>(
            this: LoDashExplicitWrapper<Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee: object
        ): LoDashExplicitWrapper<Dictionary<boolean>>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratee: object
        ): LoDashExplicitWrapper<{ [P in keyof T]: boolean }>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T, TKey extends keyof T>(
            this: LoDashExplicitWrapper<Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee: TKey
        ): LoDashExplicitWrapper<Dictionary<T[TKey]>>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T>(
            this: LoDashExplicitWrapper<Dictionary<T> | NumericDictionary<T> | null | undefined>,
            iteratee: string
        ): LoDashExplicitWrapper<Dictionary<any>>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            iteratee: string
        ): LoDashExplicitWrapper<{ [P in keyof T]: any }>;

        /**
         * @see _.mapValues
         */
        mapValues(this: LoDashExplicitWrapper<string | null | undefined>): LoDashExplicitWrapper<NumericDictionary<string>>;

        /**
         * @see _.mapValues
         * TODO: This would be better if we had a separate overload for obj: NumericDictionary that returned a NumericDictionary,
         *       but TypeScript cannot select overload signatures based on number vs string index key type.
         */
        mapValues<T>(this: LoDashExplicitWrapper<Dictionary<T> | NumericDictionary<T> | null | undefined>): LoDashExplicitWrapper<Dictionary<T>>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(this: LoDashExplicitWrapper<T>): LoDashExplicitWrapper<T>;

        /**
         * @see _.mapValues
         */
        mapValues<T extends object>(this: LoDashExplicitWrapper<T | null | undefined>): LoDashExplicitWrapper<PartialObject<T>>;
    }

    // merge

    interface LoDashStatic {
        /**
         * Recursively merges own and inherited enumerable properties of source
         * objects into the destination object, skipping source properties that resolve
         * to `undefined`. Array and plain object properties are merged recursively.
         * Other objects and value types are overridden by assignment. Source objects
         * are applied from left to right. Subsequent sources overwrite property
         * assignments of previous sources.
         *
         * **Note:** This method mutates `object`.
         *
         * @category Object
         * @param object The destination object.
         * @param [sources] The source objects.
         * @returns Returns `object`.
         * @example
         *
         * var users = {
         *   'data': [{ 'user': 'barney' }, { 'user': 'fred' }]
         * };
         *
         * var ages = {
         *   'data': [{ 'age': 36 }, { 'age': 40 }]
         * };
         *
         * _.merge(users, ages);
         * // => { 'data': [{ 'user': 'barney', 'age': 36 }, { 'user': 'fred', 'age': 40 }] }
         */
        merge<TObject, TSource>(
            object: TObject,
            source: TSource
        ): TObject & TSource;

        /**
         * @see _.merge
         */
        merge<TObject, TSource1, TSource2>(
            object: TObject,
            source1: TSource1,
            source2: TSource2
        ): TObject & TSource1 & TSource2;

        /**
         * @see _.merge
         */
        merge<TObject, TSource1, TSource2, TSource3>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): TObject & TSource1 & TSource2 & TSource3;

        /**
         * @see _.merge
         */
        merge<TObject, TSource1, TSource2, TSource3, TSource4>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): TObject & TSource1 & TSource2 & TSource3 & TSource4;

        /**
         * @see _.merge
         */
        merge(
            object: any,
            ...otherArgs: any[]
        ): any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.merge
         */
        merge<TSource>(
            source: TSource
        ): LoDashImplicitWrapper<TValue & TSource>;

        /**
         * @see _.merge
         */
        merge<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see _.merge
         */
        merge<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see _.merge
         */
        merge<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.merge
         */
        merge(
            ...otherArgs: any[]
        ): LoDashImplicitWrapper<any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.merge
         */
        merge<TSource>(
            source: TSource
        ): LoDashExplicitWrapper<TValue & TSource>;

        /**
         * @see _.merge
         */
        merge<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see _.merge
         */
        merge<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see _.merge
         */
        merge<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.merge
         */
        merge(
            ...otherArgs: any[]
        ): LoDashExplicitWrapper<any>;
    }

    // mergeWith

    type MergeWithCustomizer = { bivariantHack(value: any, srcValue: any, key: string, object: any, source: any): any; }["bivariantHack"];

    interface LoDashStatic {
        /**
         * This method is like `_.merge` except that it accepts `customizer` which
         * is invoked to produce the merged values of the destination and source
         * properties. If `customizer` returns `undefined` merging is handled by the
         * method instead. The `customizer` is invoked with seven arguments:
         * (objValue, srcValue, key, object, source, stack).
         *
         * @category Object
         * @param object The destination object.
         * @param sources The source objects.
         * @param customizer The function to customize assigned values.
         * @returns Returns `object`.
         * @example
         *
         * function customizer(objValue, srcValue) {
         *   if (_.isArray(objValue)) {
         *     return objValue.concat(srcValue);
         *   }
         * }
         *
         * var object = {
         *   'fruits': ['apple'],
         *   'vegetables': ['beet']
         * };
         *
         * var other = {
         *   'fruits': ['banana'],
         *   'vegetables': ['carrot']
         * };
         *
         * _.merge(object, other, customizer);
         * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot'] }
         */
        mergeWith<TObject, TSource>(
            object: TObject,
            source: TSource,
            customizer: MergeWithCustomizer
        ): TObject & TSource;

        /**
         * @see _.mergeWith
         */
        mergeWith<TObject, TSource1, TSource2>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            customizer: MergeWithCustomizer
        ): TObject & TSource1 & TSource2;

        /**
         * @see _.mergeWith
         */
        mergeWith<TObject, TSource1, TSource2, TSource3>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: MergeWithCustomizer
        ): TObject & TSource1 & TSource2 & TSource3;

        /**
         * @see _.mergeWith
         */
        mergeWith<TObject, TSource1, TSource2, TSource3, TSource4>(
            object: TObject,
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: MergeWithCustomizer
        ): TObject & TSource1 & TSource2 & TSource3 & TSource4;

        /**
         * @see _.mergeWith
         */
        mergeWith(
            object: any,
            ...otherArgs: any[]
        ): any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.mergeWith
         */
        mergeWith<TSource>(
            source: TSource,
            customizer: MergeWithCustomizer
        ): LoDashImplicitWrapper<TValue & TSource>;

        /**
         * @see _.mergeWith
         */
        mergeWith<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2,
            customizer: MergeWithCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see _.mergeWith
         */
        mergeWith<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: MergeWithCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see _.mergeWith
         */
        mergeWith<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: MergeWithCustomizer
        ): LoDashImplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.mergeWith
         */
        mergeWith(
            ...otherArgs: any[]
        ): LoDashImplicitWrapper<any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.mergeWith
         */
        mergeWith<TSource>(
            source: TSource,
            customizer: MergeWithCustomizer
        ): LoDashExplicitWrapper<TValue & TSource>;

        /**
         * @see _.mergeWith
         */
        mergeWith<TSource1, TSource2>(
            source1: TSource1,
            source2: TSource2,
            customizer: MergeWithCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2>;

        /**
         * @see _.mergeWith
         */
        mergeWith<TSource1, TSource2, TSource3>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            customizer: MergeWithCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3>;

        /**
         * @see _.mergeWith
         */
        mergeWith<TSource1, TSource2, TSource3, TSource4>(
            source1: TSource1,
            source2: TSource2,
            source3: TSource3,
            source4: TSource4,
            customizer: MergeWithCustomizer
        ): LoDashExplicitWrapper<TValue & TSource1 & TSource2 & TSource3 & TSource4>;

        /**
         * @see _.mergeWith
         */
        mergeWith(
            ...otherArgs: any[]
        ): LoDashExplicitWrapper<any>;
    }

    // omit

    interface LoDashStatic {
        /**
         * The opposite of `_.pick`; this method creates an object composed of the
         * own and inherited enumerable properties of `object` that are not omitted.
         *
         * @category Object
         * @param object The source object.
         * @param [paths] The property names to omit, specified
         *  individually or in arrays..
         * @returns Returns the new object.
         * @example
         *
         * var object = { 'a': 1, 'b': '2', 'c': 3 };
         *
         * _.omit(object, ['a', 'c']);
         * // => { 'b': '2' }
         */
        omit<T extends AnyKindOfDictionary>(
            object: T | null | undefined,
            ...paths: Array<Many<PropertyName>>
        ): T;

        /**
         * @see _.omit
         */
        omit<T extends object, K extends keyof T>(
            object: T | null | undefined,
            ...paths: Array<Many<K>>
        ): Omit<T, K>;

        /**
         * @see _.omit
         */
        omit<T extends object>(
            object: T | null | undefined,
            ...paths: Array<Many<PropertyName>>
        ): PartialObject<T>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.omit
         */
        omit<T extends AnyKindOfDictionary>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            ...paths: Array<Many<PropertyName>>
        ): LoDashImplicitWrapper<T>;

        /**
         * @see _.omit
         */
        omit<T extends object, K extends keyof T>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            ...paths: Array<Many<K>>
        ): LoDashImplicitWrapper<Omit<T, K>>;

        /**
         * @see _.omit
         */
        omit<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            ...paths: Array<Many<PropertyName>>
        ): LoDashImplicitWrapper<PartialObject<T>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.omit
         */
        omit<T extends AnyKindOfDictionary>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            ...paths: Array<Many<PropertyName>>
        ): LoDashExplicitWrapper<T>;

        /**
         * @see _.omit
         */
        omit<T extends object, K extends keyof T>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            ...paths: Array<Many<K>>
        ): LoDashExplicitWrapper<Omit<T, K>>;

        /**
         * @see _.omit
         */
        omit<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            ...paths: Array<Many<PropertyName>>
        ): LoDashExplicitWrapper<PartialObject<T>>;
    }

    // omitBy

    interface LoDashStatic {
        /**
         * The opposite of `_.pickBy`; this method creates an object composed of the
         * own and inherited enumerable properties of `object` that `predicate`
         * doesn't return truthy for.
         *
         * @category Object
         * @param object The source object.
         * @param [predicate=_.identity] The function invoked per property.
         * @returns Returns the new object.
         * @example
         *
         * var object = { 'a': 1, 'b': '2', 'c': 3 };
         *
         * _.omitBy(object, _.isNumber);
         * // => { 'b': '2' }
         */
        omitBy<T>(
            object: Dictionary<T> | null | undefined,
            predicate?: ValueKeyIteratee<T>
        ): Dictionary<T>;

        /**
         * @see _.omitBy
         */
        omitBy<T>(
            object: NumericDictionary<T> | null | undefined,
            predicate?: ValueKeyIteratee<T>
        ): NumericDictionary<T>;

        /**
         * @see _.omitBy
         */
        omitBy<T extends object>(
            object: T | null | undefined,
            predicate: ValueKeyIteratee<T[keyof T]>
        ): PartialObject<T>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.omitBy
         */
        omitBy<T>(
            this: LoDashImplicitWrapper<Dictionary<T> | null | undefined>,
            predicate?: ValueKeyIteratee<T>
        ): LoDashImplicitWrapper<Dictionary<T>>;

        /**
         * @see _.omitBy
         */
        omitBy<T>(
            this: LoDashImplicitWrapper<NumericDictionary<T> | null | undefined>,
            predicate?: ValueKeyIteratee<T>
        ): LoDashImplicitWrapper<NumericDictionary<T>>;

        /**
         * @see _.omitBy
         */
        omitBy<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate: ValueKeyIteratee<T[keyof T]>
        ): LoDashImplicitWrapper<PartialObject<T>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.omitBy
         */
        omitBy<T>(
            this: LoDashExplicitWrapper<Dictionary<T> | null | undefined>,
            predicate?: ValueKeyIteratee<T>
        ): LoDashExplicitWrapper<Dictionary<T>>;

        /**
         * @see _.omitBy
         */
        omitBy<T>(
            this: LoDashExplicitWrapper<NumericDictionary<T> | null | undefined>,
            predicate?: ValueKeyIteratee<T>
        ): LoDashExplicitWrapper<NumericDictionary<T>>;

        /**
         * @see _.omitBy
         */
        omitBy<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate: ValueKeyIteratee<T[keyof T]>
        ): LoDashExplicitWrapper<PartialObject<T>>;
    }

    // pick

    interface LoDashStatic {
        /**
         * Creates an object composed of the picked `object` properties.
         *
         * @category Object
         * @param object The source object.
         * @param [props] The property names to pick, specified
         *  individually or in arrays.
         * @returns Returns the new object.
         * @example
         *
         * var object = { 'a': 1, 'b': '2', 'c': 3 };
         *
         * _.pick(object, ['a', 'c']);
         * // => { 'a': 1, 'c': 3 }
         */
        pick<T extends object, U extends keyof T>(
            object: T,
             ...props: Array<Many<U>>
        ): Pick<T, U>;

        /**
         * @see _.pick
         */
        pick<T>(
            object: T | null | undefined,
            ...props: PropertyPath[]
        ): PartialDeep<T>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.pick
         */
        pick<T extends object, U extends keyof T>(
            this: LoDashImplicitWrapper<T>,
            ...props: Array<Many<U>>
        ): LoDashImplicitWrapper<Pick<T, U>>;

        /**
         * @see _.pick
         */
        pick<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            ...props: PropertyPath[]
        ): LoDashImplicitWrapper<PartialObject<T>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.pick
         */
        pick<T extends object, U extends keyof T>(
            this: LoDashExplicitWrapper<T>,
            ...props: Array<Many<U>>
        ): LoDashExplicitWrapper<Pick<T, U>>;

        /**
         * @see _.pick
         */
        pick<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            ...props: PropertyPath[]
        ): LoDashExplicitWrapper<PartialObject<T>>;
    }

    // pickBy

    interface LoDashStatic {
        /**
         * Creates an object composed of the `object` properties `predicate` returns
         * truthy for. The predicate is invoked with two arguments: (value, key).
         *
         * @category Object
         * @param object The source object.
         * @param [predicate=_.identity] The function invoked per property.
         * @returns Returns the new object.
         * @example
         *
         * var object = { 'a': 1, 'b': '2', 'c': 3 };
         *
         * _.pickBy(object, _.isNumber);
         * // => { 'a': 1, 'c': 3 }
         */
        pickBy<T, S extends T>(
            object: Dictionary<T> | null | undefined,
            predicate: ValueKeyIterateeTypeGuard<T, S>
        ): Dictionary<S>;

        /**
         * @see _.pickBy
         */
        pickBy<T, S extends T>(
            object: NumericDictionary<T> | null | undefined,
            predicate: ValueKeyIterateeTypeGuard<T, S>
        ): NumericDictionary<S>;

        /**
         * @see _.pickBy
         */
        pickBy<T>(
            object: Dictionary<T> | null | undefined,
            predicate?: ValueKeyIteratee<T>
        ): Dictionary<T>;

        /**
         * @see _.pickBy
         */
        pickBy<T>(
            object: NumericDictionary<T> | null | undefined,
            predicate?: ValueKeyIteratee<T>
        ): NumericDictionary<T>;

        /**
         * @see _.pickBy
         */
        pickBy<T extends object>(
            object: T | null | undefined,
            predicate?: ValueKeyIteratee<T[keyof T]>
        ): PartialObject<T>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.pickBy
         */
        pickBy<T, S extends T>(
            this: LoDashImplicitWrapper<Dictionary<T> | null | undefined>,
            predicate: ValueKeyIterateeTypeGuard<T, S>
        ): LoDashImplicitWrapper<Dictionary<S>>;

        /**
         * @see _.pickBy
         */
        pickBy<T, S extends T>(
            this: LoDashImplicitWrapper<NumericDictionary<T> | null | undefined>,
            predicate: ValueKeyIterateeTypeGuard<T, S>
        ): LoDashImplicitWrapper<NumericDictionary<S>>;

        /**
         * @see _.pickBy
         */
        pickBy<T>(
            this: LoDashImplicitWrapper<Dictionary<T> | null | undefined>,
            predicate?: ValueKeyIteratee<T>
        ): LoDashImplicitWrapper<Dictionary<T>>;

        /**
         * @see _.pickBy
         */
        pickBy<T>(
            this: LoDashImplicitWrapper<NumericDictionary<T> | null | undefined>,
            predicate?: ValueKeyIteratee<T>
        ): LoDashImplicitWrapper<NumericDictionary<T>>;

        /**
         * @see _.pickBy
         */
        pickBy<T extends object>(
            this: LoDashImplicitWrapper<T | null | undefined>,
            predicate?: ValueKeyIteratee<T[keyof T]>
        ): LoDashImplicitWrapper<PartialObject<T>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.pickBy
         */
        pickBy<T, S extends T>(
            this: LoDashExplicitWrapper<Dictionary<T> | null | undefined>,
            predicate: ValueKeyIterateeTypeGuard<T, S>
        ): LoDashExplicitWrapper<Dictionary<S>>;

        /**
         * @see _.pickBy
         */
        pickBy<T, S extends T>(
            this: LoDashExplicitWrapper<NumericDictionary<T> | null | undefined>,
            predicate: ValueKeyIterateeTypeGuard<T, S>
        ): LoDashExplicitWrapper<NumericDictionary<S>>;

        /**
         * @see _.pickBy
         */
        pickBy<T>(
            this: LoDashExplicitWrapper<Dictionary<T> | null | undefined>,
            predicate?: ValueKeyIteratee<T>
        ): LoDashExplicitWrapper<Dictionary<T>>;

        /**
         * @see _.pickBy
         */
        pickBy<T>(
            this: LoDashExplicitWrapper<NumericDictionary<T> | null | undefined>,
            predicate?: ValueKeyIteratee<T>
        ): LoDashExplicitWrapper<NumericDictionary<T>>;

        /**
         * @see _.pickBy
         */
        pickBy<T extends object>(
            this: LoDashExplicitWrapper<T | null | undefined>,
            predicate?: ValueKeyIteratee<T[keyof T]>
        ): LoDashExplicitWrapper<PartialObject<T>>;
    }

    // result

    interface LoDashStatic {
        /**
         * This method is like _.get except that if the resolved value is a function it’s invoked with the this binding
         * of its parent object and its result is returned.
         *
         * @param object The object to query.
         * @param path The path of the property to resolve.
         * @param defaultValue The value returned if the resolved value is undefined.
         * @return Returns the resolved value.
         */
        result<TResult>(
            object: any,
            path: PropertyPath,
            defaultValue?: TResult|((...args: any[]) => TResult)
        ): TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.result
         */
        result<TResult>(
            path: PropertyPath,
            defaultValue?: TResult|((...args: any[]) => TResult)
        ): TResult;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.result
         */
        result<TResult>(
            path: PropertyPath,
            defaultValue?: TResult|((...args: any[]) => TResult)
        ): LoDashExplicitWrapper<TResult>;
    }

    // set

    interface LoDashStatic {
        /**
         * Sets the value at path of object. If a portion of path doesn’t exist it’s created. Arrays are created for
         * missing index properties while objects are created for all other missing properties. Use _.setWith to
         * customize path creation.
         *
         * @param object The object to modify.
         * @param path The path of the property to set.
         * @param value The value to set.
         * @return Returns object.
         */
        set<T extends object>(
            object: T,
            path: PropertyPath,
            value: any
        ): T;

        /**
         * @see _.set
         */
        set<TResult>(
            object: object,
            path: PropertyPath,
            value: any
        ): TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.set
         */
        set(
            path: PropertyPath,
            value: any
        ): this;

        /**
         * @see _.set
         */
        set<TResult>(
            path: PropertyPath,
            value: any
        ): LoDashImplicitWrapper<TResult>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.set
         */
        set(
            path: PropertyPath,
            value: any
        ): this;

        /**
         * @see _.set
         */
        set<TResult>(
            path: PropertyPath,
            value: any
        ): LoDashExplicitWrapper<TResult>;
    }

    // setWith

    type SetWithCustomizer<T> = (nsValue: any, key: string, nsObject: T) => any;

    interface LoDashStatic {
        /**
         * This method is like _.set except that it accepts customizer which is invoked to produce the objects of
         * path. If customizer returns undefined path creation is handled by the method instead. The customizer is
         * invoked with three arguments: (nsValue, key, nsObject).
         *
         * @param object The object to modify.
         * @param path The path of the property to set.
         * @param value The value to set.
         * @param customizer The function to customize assigned values.
         * @return Returns object.
         */
        setWith<T extends object>(
            object: T,
            path: PropertyPath,
            value: any,
            customizer?: SetWithCustomizer<T>
        ): T;

        setWith<T extends object, TResult>(
            object: T,
            path: PropertyPath,
            value: any,
            customizer?: SetWithCustomizer<T>
        ): TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.setWith
         */
        setWith(
            path: PropertyPath,
            value: any,
            customizer?: SetWithCustomizer<TValue>
        ): this;

        /**
         * @see _.setWith
         */
        setWith<TResult>(
            path: PropertyPath,
            value: any,
            customizer?: SetWithCustomizer<TValue>
        ): LoDashImplicitWrapper<TResult>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.setWith
         */
        setWith(
            path: PropertyPath,
            value: any,
            customizer?: SetWithCustomizer<TValue>
        ): this;

        /**
         * @see _.setWith
         */
        setWith<TResult>(
            path: PropertyPath,
            value: any,
            customizer?: SetWithCustomizer<TValue>
        ): LoDashExplicitWrapper<TResult>;
    }

    // toPairs

    interface LoDashStatic {
        /**
         * Creates an array of own enumerable key-value pairs for object.
         *
         * @param object The object to query.
         * @return Returns the new array of key-value pairs.
         */
        toPairs<T>(object?: Dictionary<T> | NumericDictionary<T>): Array<[string, T]>;

        /**
         * @see _.toPairs
         */
        toPairs(object?: object): Array<[string, any]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.toPairs
         */
        toPairs<T>(this: LoDashImplicitWrapper<Dictionary<T> | NumericDictionary<T>>): LoDashImplicitWrapper<Array<[string, T]>>;

        /**
         * @see _.toPairs
         */
        toPairs(): LoDashImplicitWrapper<Array<[string, any]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.toPairs
         */
        toPairs<T>(this: LoDashExplicitWrapper<Dictionary<T> | NumericDictionary<T>>): LoDashExplicitWrapper<Array<[string, T]>>;

        /**
         * @see _.toPairs
         */
        toPairs(): LoDashExplicitWrapper<Array<[string, any]>>;
    }

    // toPairsIn

    interface LoDashStatic {
        /**
         * Creates an array of own and inherited enumerable key-value pairs for object.
         *
         * @param object The object to query.
         * @return Returns the new array of key-value pairs.
         */
        toPairsIn<T>(object?: Dictionary<T> | NumericDictionary<T>): Array<[string, T]>;

        /**
         * @see _.toPairsIn
         */
        toPairsIn(object?: object): Array<[string, any]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.toPairsIn
         */
        toPairsIn<T>(this: LoDashImplicitWrapper<Dictionary<T> | NumericDictionary<T>>): LoDashImplicitWrapper<Array<[string, T]>>;

        /**
         * @see _.toPairsIn
         */
        toPairsIn(): LoDashImplicitWrapper<Array<[string, any]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.toPairsIn
         */
        toPairsIn<T>(this: LoDashExplicitWrapper<Dictionary<T> | NumericDictionary<T>>): LoDashExplicitWrapper<Array<[string, T]>>;

        /**
         * @see _.toPairsIn
         */
        toPairsIn(): LoDashExplicitWrapper<Array<[string, any]>>;
    }

    // transform

    interface LoDashStatic {
        /**
         * An alternative to _.reduce; this method transforms object to a new accumulator object which is the result of
         * running each of its own enumerable properties through iteratee, with each invocation potentially mutating
         * the accumulator object. The iteratee is invoked with four arguments: (accumulator,
         * value, key, object). Iteratee functions may exit iteration early by explicitly returning false.
         *
         * @param object The object to iterate over.
         * @param iteratee The function invoked per iteration.
         * @param accumulator The custom accumulator value.
         * @return Returns the accumulated value.
         */
        transform<T, TResult>(
            object: T[],
            iteratee: MemoVoidArrayIterator<T, TResult[]>,
            accumulator?: TResult[]
        ): TResult[];

        /**
         * @see _.transform
         */
        transform<T, TResult>(
            object: T[],
            iteratee: MemoVoidArrayIterator<T, Dictionary<TResult>>,
            accumulator: Dictionary<TResult>
        ): Dictionary<TResult>;

        /**
         * @see _.transform
         */
        transform<T, TResult>(
            object: Dictionary<T>,
            iteratee: MemoVoidDictionaryIterator<T, Dictionary<TResult>>,
            accumulator?: Dictionary<TResult>
        ): Dictionary<TResult>;

        /**
         * @see _.transform
         */
        transform<T, TResult>(
            object: Dictionary<T>,
            iteratee: MemoVoidDictionaryIterator<T, TResult[]>,
            accumulator: TResult[]
        ): TResult[];

        /**
         * @see _.transform
         */
        transform(
            object: any[],
        ): any[];

        /**
         * @see _.transform
         */
        transform(
            object: object,
        ): Dictionary<any>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.transform
         */
        transform<T, TResult>(
            this: LoDashImplicitWrapper<T[]>,
            iteratee: MemoVoidArrayIterator<T, TResult[]>,
            accumulator?: TResult[]
        ): LoDashImplicitWrapper<TResult[]>;

        /**
         * @see _.transform
         */
        transform<T, TResult>(
            this: LoDashImplicitWrapper<T[]>,
            iteratee: MemoVoidArrayIterator<T, Dictionary<TResult>>,
            accumulator: Dictionary<TResult>
        ): LoDashImplicitWrapper<Dictionary<TResult>>;

        /**
         * @see _.transform
         */
        transform<T, TResult>(
            this: LoDashImplicitWrapper<Dictionary<T>>,
            iteratee: MemoVoidDictionaryIterator<T, Dictionary<TResult>>,
            accumulator?: Dictionary<TResult>
        ): LoDashImplicitWrapper<Dictionary<TResult>>;

        /**
         * @see _.transform
         */
        transform<T, TResult>(
            this: LoDashImplicitWrapper<Dictionary<T>>,
            iteratee: MemoVoidDictionaryIterator<T, TResult[]>,
            accumulator: TResult[]
        ): LoDashImplicitWrapper<TResult[]>;

        /**
         * @see _.transform
         */
        transform(
            this: LoDashImplicitWrapper<any[]>,
        ): LoDashImplicitWrapper<any[]>;

        /**
         * @see _.transform
         */
        transform(): LoDashImplicitWrapper<Dictionary<any>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.transform
         */
        transform<T, TResult>(
            this: LoDashExplicitWrapper<T[]>,
            iteratee: MemoVoidArrayIterator<T, TResult[]>,
            accumulator?: TResult[]
        ): LoDashExplicitWrapper<TResult[]>;

        /**
         * @see _.transform
         */
        transform<T, TResult>(
            this: LoDashExplicitWrapper<T[]>,
            iteratee: MemoVoidArrayIterator<T, Dictionary<TResult>>,
            accumulator?: Dictionary<TResult>
        ): LoDashExplicitWrapper<Dictionary<TResult>>;

        /**
         * @see _.transform
         */
        transform<T, TResult>(
            this: LoDashExplicitWrapper<Dictionary<T>>,
            iteratee: MemoVoidDictionaryIterator<T, Dictionary<TResult>>,
            accumulator?: Dictionary<TResult>
        ): LoDashExplicitWrapper<Dictionary<TResult>>;

        /**
         * @see _.transform
         */
        transform<T, TResult>(
            this: LoDashExplicitWrapper<Dictionary<T>>,
            iteratee: MemoVoidDictionaryIterator<T, TResult[]>,
            accumulator?: TResult[]
        ): LoDashExplicitWrapper<TResult[]>;

        /**
         * @see _.transform
         */
        transform(
            this: LoDashExplicitWrapper<any[]>,
        ): LoDashExplicitWrapper<any[]>;

        /**
         * @see _.transform
         */
        transform(): LoDashExplicitWrapper<Dictionary<any>>;
    }

    // unset

    interface LoDashStatic {
        /**
         * Removes the property at path of object.
         *
         * Note: This method mutates object.
         *
         * @param object The object to modify.
         * @param path The path of the property to unset.
         * @return Returns true if the property is deleted, else false.
         */
        unset(
            object: any,
            path: PropertyPath
        ): boolean;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.unset
         */
        unset(path: PropertyPath): LoDashImplicitWrapper<boolean>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.unset
         */
        unset(path: PropertyPath): LoDashExplicitWrapper<boolean>;
    }

    // update

    interface LoDashStatic {
        /**
         * This method is like _.set except that accepts updater to produce the value to set. Use _.updateWith to
         * customize path creation. The updater is invoked with one argument: (value).
         *
         * @param object The object to modify.
         * @param path The path of the property to set.
         * @param updater The function to produce the updated value.
         * @return Returns object.
         */
        update(
            object: object,
            path: PropertyPath,
            updater: (value: any) => any
        ): any;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.update
         */
        update(
            path: PropertyPath,
            updater: (value: any) => any
        ): LoDashImplicitWrapper<any>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.update
         */
        update(
            path: PropertyPath,
            updater: (value: any) => any
        ): LoDashExplicitWrapper<any>;
    }

    // updateWith

    interface LoDashStatic {
        /**
         * This method is like `_.update` except that it accepts `customizer` which is
         * invoked to produce the objects of `path`.  If `customizer` returns `undefined`
         * path creation is handled by the method instead. The `customizer` is invoked
         * with three arguments: (nsValue, key, nsObject).
         *
         * **Note:** This method mutates `object`.
         *
         * @since 4.6.0
         * @category Object
         * @param object The object to modify.
         * @param path The path of the property to set.
         * @param updater The function to produce the updated value.
         * @param [customizer] The function to customize assigned values.
         * @returns Returns `object`.
         * @example
         *
         * var object = {};
         *
         * _.updateWith(object, '[0][1]', _.constant('a'), Object);
         * // => { '0': { '1': 'a' } }
         */
        updateWith<T extends object>(
            object: T,
            path: PropertyPath,
            updater: (oldValue: any) => any,
            customizer?: SetWithCustomizer<T>
        ): T;

        /**
         * @see _.updateWith
         */
        updateWith<T extends object, TResult>(
            object: T,
            path: PropertyPath,
            updater: (oldValue: any) => any,
            customizer?: SetWithCustomizer<T>
        ): TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.updateWith
         */
        updateWith(
            path: PropertyPath,
            updater: (oldValue: any) => any,
            customizer?: SetWithCustomizer<TValue>
        ): this;

        /**
         * @see _.updateWith
         */
        updateWith<TResult>(
            path: PropertyPath,
            updater: (oldValue: any) => any,
            customizer?: SetWithCustomizer<TValue>
        ): LoDashImplicitWrapper<TResult>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.updateWith
         */
        updateWith(
            path: PropertyPath,
            updater: (oldValue: any) => any,
            customizer?: SetWithCustomizer<TValue>
        ): this;

        /**
         * @see _.updateWith
         */
        updateWith<TResult>(
            path: PropertyPath,
            updater: (oldValue: any) => any,
            customizer?: SetWithCustomizer<TValue>
        ): LoDashExplicitWrapper<TResult>;
    }

    // values

    interface LoDashStatic {
        /**
         * Creates an array of the own enumerable property values of object.
         *
         * @param object The object to query.
         * @return Returns an array of property values.
         */
        values<T>(object: Dictionary<T> | NumericDictionary<T> | List<T> | null | undefined): T[];

        /**
         * @see _.values
         */
        values<T extends object>(object: T | null | undefined): Array<T[keyof T]>;

        /**
         * @see _.values
         */
        values(object: any): any[];
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.values
         */
        values<T>(this: LoDashImplicitWrapper<Dictionary<T> | NumericDictionary<T> | List<T> | null | undefined>): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.values
         */
        values<T extends object>(this: LoDashImplicitWrapper<T | null | undefined>): LoDashImplicitWrapper<Array<T[keyof T]>>;

        /**
         * @see _.values
         */
        values(): LoDashImplicitWrapper<any[]>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.values
         */
        values<T>(this: LoDashExplicitWrapper<Dictionary<T> | NumericDictionary<T> | List<T> | null | undefined>): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.values
         */
        values<T extends object>(this: LoDashExplicitWrapper<T | null | undefined>): LoDashExplicitWrapper<Array<T[keyof T]>>;

        /**
         * @see _.values
         */
        values(): LoDashExplicitWrapper<any[]>;
    }

    // valuesIn

    interface LoDashStatic {
        /**
         * Creates an array of the own and inherited enumerable property values of object.
         *
         * @param object The object to query.
         * @return Returns the array of property values.
         */
        valuesIn<T>(object: Dictionary<T>|NumericDictionary<T>|List<T> | null | undefined): T[];

        /**
         * @see _.valuesIn
         */
        valuesIn<T extends object>(object: T | null | undefined): Array<T[keyof T]>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.valuesIn
         */
        valuesIn<T>(this: LoDashImplicitWrapper<Dictionary<T> | NumericDictionary<T> | List<T> | null | undefined>): LoDashImplicitWrapper<T[]>;

        /**
         * @see _.valuesIn
         */
        valuesIn<T extends object>(this: LoDashImplicitWrapper<T | null | undefined>): LoDashImplicitWrapper<Array<T[keyof T]>>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.valuesIn
         */
        valuesIn<T>(this: LoDashExplicitWrapper<Dictionary<T> | NumericDictionary<T> | List<T> | null | undefined>): LoDashExplicitWrapper<T[]>;

        /**
         * @see _.valuesIn
         */
        valuesIn<T extends object>(this: LoDashExplicitWrapper<T | null | undefined>): LoDashExplicitWrapper<Array<T[keyof T]>>;
    }
}
