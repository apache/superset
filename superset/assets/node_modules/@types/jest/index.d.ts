// Type definitions for Jest 23.3
// Project: http://facebook.github.io/jest/
// Definitions by: Asana <https://asana.com>
//                 Ivo Stratev <https://github.com/NoHomey>
//                 jwbay <https://github.com/jwbay>
//                 Alexey Svetliakov <https://github.com/asvetliakov>
//                 Alex Jover Morales <https://github.com/alexjoverm>
//                 Allan Lukwago <https://github.com/epicallan>
//                 Ika <https://github.com/ikatyang>
//                 Waseem Dahman <https://github.com/wsmd>
//                 Jamie Mason <https://github.com/JamieMason>
//                 Douglas Duteil <https://github.com/douglasduteil>
//                 Ahn <https://github.com/ahnpnl>
//                 Josh Goldberg <https://github.com/joshuakgoldberg>
//                 Jeff Lau <https://github.com/UselessPickles>
//                 Andrew Makarov <https://github.com/r3nya>
//                 Martin Hochel <https://github.com/hotell>
//                 Sebastian Sebald <https://github.com/sebald>
//                 Andy <https://github.com/andys8>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

declare var beforeAll: jest.Lifecycle;
declare var beforeEach: jest.Lifecycle;
declare var afterAll: jest.Lifecycle;
declare var afterEach: jest.Lifecycle;
declare var describe: jest.Describe;
declare var fdescribe: jest.Describe;
declare var xdescribe: jest.Describe;
declare var it: jest.It;
declare var fit: jest.It;
declare var xit: jest.It;
declare var test: jest.It;
declare var xtest: jest.It;

declare const expect: jest.Expect;

interface NodeRequire {
    /**
     * Returns the actual module instead of a mock, bypassing all checks on
     * whether the module should receive a mock implementation or not.
     */
    requireActual(moduleName: string): any;
    /**
     * Returns a mock module instead of the actual module, bypassing all checks
     * on whether the module should be required normally or not.
     */
    requireMock(moduleName: string): any;
}

declare namespace jest {
    /**
     * Provides a way to add Jasmine-compatible matchers into your Jest context.
     */
    function addMatchers(matchers: jasmine.CustomMatcherFactories): typeof jest;
    /**
     * Disables automatic mocking in the module loader.
     */
    function autoMockOff(): typeof jest;
    /**
     * Enables automatic mocking in the module loader.
     */
    function autoMockOn(): typeof jest;
    /**
     * Clears the mock.calls and mock.instances properties of all mocks.
     * Equivalent to calling .mockClear() on every mocked function.
     */
    function clearAllMocks(): typeof jest;
    /**
     * Clears the mock.calls and mock.instances properties of all mocks.
     * Equivalent to calling .mockClear() on every mocked function.
     */
    function resetAllMocks(): typeof jest;
    /**
     * available since Jest 21.1.0
     * Restores all mocks back to their original value.
     * Equivalent to calling .mockRestore on every mocked function.
     * Beware that jest.restoreAllMocks() only works when mock was created with
     * jest.spyOn; other mocks will require you to manually restore them.
     */
    function restoreAllMocks(): typeof jest;
    /**
     * Removes any pending timers from the timer system. If any timers have
     * been scheduled, they will be cleared and will never have the opportunity
     * to execute in the future.
     */
    function clearAllTimers(): typeof jest;
    /**
     * Indicates that the module system should never return a mocked version
     * of the specified module, including all of the specificied module's dependencies.
     */
    function deepUnmock(moduleName: string): typeof jest;
    /**
     * Disables automatic mocking in the module loader.
     */
    function disableAutomock(): typeof jest;
    /**
     * Mocks a module with an auto-mocked version when it is being required.
     */
    function doMock(moduleName: string, factory?: any, options?: MockOptions): typeof jest;
    /**
     * Indicates that the module system should never return a mocked version
     * of the specified module from require() (e.g. that it should always return the real module).
     */
    function dontMock(moduleName: string): typeof jest;
    /**
     * Enables automatic mocking in the module loader.
     */
    function enableAutomock(): typeof jest;
    /**
     * Creates a mock function. Optionally takes a mock implementation.
     */
    function fn<T extends {}>(implementation: (...args: any[]) => T): Mock<T>;
    /**
     * Creates a mock function. Optionally takes a mock implementation.
     */
    function fn<T>(implementation?: (...args: any[]) => any): Mock<T>;
    /**
     * Use the automatic mocking system to generate a mocked version of the given module.
     */
    function genMockFromModule<T>(moduleName: string): T;
    /**
     * Returns whether the given function is a mock function.
     */
    function isMockFunction(fn: any): fn is Mock<any>;
    /**
     * Mocks a module with an auto-mocked version when it is being required.
     */
    function mock(moduleName: string, factory?: any, options?: MockOptions): typeof jest;
    /**
     * Resets the module registry - the cache of all required modules. This is
     * useful to isolate modules where local state might conflict between tests.
     */
    function resetModuleRegistry(): typeof jest;
    /**
     * Resets the module registry - the cache of all required modules. This is
     * useful to isolate modules where local state might conflict between tests.
     */
    function resetModules(): typeof jest;
    /**
     * Exhausts tasks queued by setImmediate().
     */
    function runAllImmediates(): typeof jest;
    /**
     * Exhausts the micro-task queue (usually interfaced in node via process.nextTick).
     */
    function runAllTicks(): typeof jest;
    /**
     * Exhausts the macro-task queue (i.e., all tasks queued by setTimeout() and setInterval()).
     */
    function runAllTimers(): typeof jest;
    /**
     * Executes only the macro-tasks that are currently pending (i.e., only the
     * tasks that have been queued by setTimeout() or setInterval() up to this point).
     * If any of the currently pending macro-tasks schedule new macro-tasks,
     * those new tasks will not be executed by this call.
     */
    function runOnlyPendingTimers(): typeof jest;
    /**
     * (renamed to `advanceTimersByTime` in Jest 21.3.0+) Executes only the macro
     * task queue (i.e. all tasks queued by setTimeout() or setInterval() and setImmediate()).
     */
    function runTimersToTime(msToRun: number): typeof jest;
    /**
     * Advances all timers by msToRun milliseconds. All pending "macro-tasks" that have been
     * queued via setTimeout() or setInterval(), and would be executed within this timeframe
     * will be executed.
     */
    function advanceTimersByTime(msToRun: number): typeof jest;
    /**
     * Explicitly supplies the mock object that the module system should return
     * for the specified module.
     */
    function setMock<T>(moduleName: string, moduleExports: T): typeof jest;
    /**
     * Set the default timeout interval for tests and before/after hooks in milliseconds.
     * Note: The default timeout interval is 5 seconds if this method is not called.
     */
    function setTimeout(timeout: number): typeof jest;
    /**
     * Creates a mock function similar to jest.fn but also tracks calls to `object[methodName]`
     *
     * Note: By default, jest.spyOn also calls the spied method. This is different behavior from most
     * other test libraries.
     *
     * @example
     *
     * const video = require('./video');
     *
     * test('plays video', () => {
     *   const spy = jest.spyOn(video, 'play');
     *   const isPlaying = video.play();
     *
     *   expect(spy).toHaveBeenCalled();
     *   expect(isPlaying).toBe(true);
     *
     *   spy.mockReset();
     *   spy.mockRestore();
     * });
     */
    function spyOn<T extends {}, M extends keyof T>(object: T, method: M, accessType?: 'get' | 'set'): SpyInstance<T[M]>;
    /**
     * Indicates that the module system should never return a mocked version of
     * the specified module from require() (e.g. that it should always return the real module).
     */
    function unmock(moduleName: string): typeof jest;
    /**
     * Instructs Jest to use fake versions of the standard timer functions.
     */
    function useFakeTimers(): typeof jest;
    /**
     * Instructs Jest to use the real versions of the standard timer functions.
     */
    function useRealTimers(): typeof jest;

    interface MockOptions {
        virtual?: boolean;
    }

    type EmptyFunction = () => void;

    interface DoneCallback {
        (...args: any[]): any;
        fail(error?: string | { message: string }): any;
    }

    type ProvidesCallback = (cb: DoneCallback) => any;

    type Lifecycle = (fn: ProvidesCallback, timeout?: number) => any;

    interface FunctionLike {
        readonly name: string;
    }

    interface Each {
        (cases: any[]): (name: string, fn: (...args: any[]) => any) => void;
        (strings: TemplateStringsArray, ...placeholders: any[]): (
            name: string,
            fn: (arg: any) => any
        ) => void;
    }

    /**
     * Creates a test closure
     */
    interface It {
        /**
         * Creates a test closure.
         *
         * @param name The name of your test
         * @param fn The function for your test
         * @param timeout The timeout for an async function test
         */
        (name: string, fn?: ProvidesCallback, timeout?: number): void;
        /**
         * Only runs this test in the current file.
         */
        only: It;
        /**
         * Skips running this test in the current file.
         */
        skip: It;
        /**
         * Experimental and should be avoided.
         */
        concurrent: It;
        /**
         * Use if you keep duplicating the same test with different data. `.each` allows you to write the
         * test once and pass data in.
         *
         * `.each` is available with two APIs:
         *
         * #### 1  `test.each(table)(name, fn)`
         *
         * - `table`: Array of Arrays with the arguments that are passed into the test fn for each row.
         * - `name`: String the title of the test block.
         * - `fn`: Function the test to be ran, this is the function that will receive the parameters in each row as function arguments.
         *
         *
         * #### 2  `test.each table(name, fn)`
         *
         * - `table`: Tagged Template Literal
         * - `name`: String the title of the test, use `$variable` to inject test data into the test title from the tagged template expressions.
         * - `fn`: Function the test to be ran, this is the function that will receive the test data object..
         *
         * @example
         *
         * // API 1
         * test.each([[1, 1, 2], [1, 2, 3], [2, 1, 3]])(
         *   '.add(%i, %i)',
         *   (a, b, expected) => {
         *     expect(a + b).toBe(expected);
         *   },
         * );
         *
         * // API 2
         * test.each`
         * a    | b    | expected
         * ${1} | ${1} | ${2}
         * ${1} | ${2} | ${3}
         * ${2} | ${1} | ${3}
         * `('returns $expected when $a is added $b', ({a, b, expected}) => {
         *    expect(a + b).toBe(expected);
         * });
         *
         */
        each: Each;
    }

    interface Describe {
        // tslint:disable-next-line ban-types
        (name: number | string | Function | FunctionLike, fn: EmptyFunction): void;
        /** Only runs the tests inside this `describe` for the current file */
        only: Describe;
        /** Skips running the tests inside this `describe` for the current file */
        skip: Describe;
        each: Each;
    }

    interface MatcherUtils {
        readonly expand: boolean;
        readonly isNot: boolean;
        utils: {
            readonly EXPECTED_COLOR: (text: string) => string;
            readonly RECEIVED_COLOR: (text: string) => string;
            ensureActualIsNumber(actual: any, matcherName?: string): void;
            ensureExpectedIsNumber(actual: any, matcherName?: string): void;
            ensureNoExpected(actual: any, matcherName?: string): void;
            ensureNumbers(actual: any, expected: any, matcherName?: string): void;
            /**
             * get the type of a value with handling of edge cases like `typeof []` and `typeof null`
             */
            getType(value: any): string;
            matcherHint(matcherName: string, received?: string, expected?: string, options?: { secondArgument?: string, isDirectExpectCall?: boolean }): string;
            pluralize(word: string, count: number): string;
            printExpected(value: any): string;
            printReceived(value: any): string;
            printWithType(name: string, received: any, print: (value: any) => string): string;
            stringify(object: {}, maxDepth?: number): string;
        };
        /**
         *  This is a deep-equality function that will return true if two objects have the same values (recursively).
         */
        equals(a: any, b: any): boolean;
    }

    interface ExpectExtendMap {
        [key: string]: CustomMatcher;
    }

    type CustomMatcher = (this: MatcherUtils, received: any, ...actual: any[]) => CustomMatcherResult | Promise<CustomMatcherResult>;

    interface CustomMatcherResult {
        pass: boolean;
        message: string | (() => string);
    }

    interface SnapshotSerializerOptions {
        callToJSON?: boolean;
        edgeSpacing?: string;
        spacing?: string;
        escapeRegex?: boolean;
        highlight?: boolean;
        indent?: number;
        maxDepth?: number;
        min?: boolean;
        plugins?: SnapshotSerializerPlugin[];
        printFunctionName?: boolean;
        theme?: SnapshotSerializerOptionsTheme;

        // see https://github.com/facebook/jest/blob/e56103cf142d2e87542ddfb6bd892bcee262c0e6/types/PrettyFormat.js
    }
    interface SnapshotSerializerOptionsTheme {
        comment?: string;
        content?: string;
        prop?: string;
        tag?: string;
        value?: string;
    }
    interface SnapshotSerializerColor {
        close: string;
        open: string;
    }
    interface SnapshotSerializerColors {
        comment: SnapshotSerializerColor;
        content: SnapshotSerializerColor;
        prop: SnapshotSerializerColor;
        tag: SnapshotSerializerColor;
        value: SnapshotSerializerColor;
    }
    interface SnapshotSerializerPlugin {
        print(val: any, serialize: ((val: any) => string), indent: ((str: string) => string), opts: SnapshotSerializerOptions, colors: SnapshotSerializerColors): string;
        test(val: any): boolean;
    }

    interface InverseAsymmetricMatchers {
        /**
         * `expect.not.arrayContaining(array)` matches a received array which
         * does not contain all of the elements in the expected array. That is,
         * the expected array is not a subset of the received array. It is the
         * inverse of `expect.arrayContaining`.
         */
        arrayContaining(arr: any[]): any;
        /**
         * `expect.not.objectContaining(object)` matches any received object
         * that does not recursively match the expected properties. That is, the
         * expected object is not a subset of the received object. Therefore,
         * it matches a received object which contains properties that are not
         * in the expected object. It is the inverse of `expect.objectContaining`.
         */
        objectContaining(obj: {}): any;
        /**
         * `expect.not.stringMatching(string | regexp)` matches the received
         * string that does not match the expected regexp. It is the inverse of
         * `expect.stringMatching`.
         */
        stringMatching(str: string | RegExp): any;
        /**
         * `expect.not.stringContaining(string)` matches the received string
         * that does not contain the exact expected string. It is the inverse of
         * `expect.stringContaining`.
         */
        stringContaining(str: string): any;
    }

    /**
     * The `expect` function is used every time you want to test a value.
     * You will rarely call `expect` by itself.
     */
    interface Expect {
        /**
         * The `expect` function is used every time you want to test a value.
         * You will rarely call `expect` by itself.
         *
         * @param actual The value to apply matchers against.
         */
        <T = any>(actual: T): Matchers<T>;
        /**
         * Matches anything but null or undefined. You can use it inside `toEqual` or `toBeCalledWith` instead
         * of a literal value. For example, if you want to check that a mock function is called with a
         * non-null argument:
         *
         * @example
         *
         * test('map calls its argument with a non-null argument', () => {
         *   const mock = jest.fn();
         *   [1].map(x => mock(x));
         *   expect(mock).toBeCalledWith(expect.anything());
         * });
         *
         */
        anything(): any;
        /**
         * Matches anything that was created with the given constructor.
         * You can use it inside `toEqual` or `toBeCalledWith` instead of a literal value.
         *
         * @example
         *
         * function randocall(fn) {
         *   return fn(Math.floor(Math.random() * 6 + 1));
         * }
         *
         * test('randocall calls its callback with a number', () => {
         *   const mock = jest.fn();
         *   randocall(mock);
         *   expect(mock).toBeCalledWith(expect.any(Number));
         * });
         */
        any(classType: any): any;
        /**
         * Matches any array made up entirely of elements in the provided array.
         * You can use it inside `toEqual` or `toBeCalledWith` instead of a literal value.
         */
        arrayContaining(arr: any[]): any;
        /**
         * Verifies that a certain number of assertions are called during a test.
         * This is often useful when testing asynchronous code, in order to
         * make sure that assertions in a callback actually got called.
         */
        assertions(num: number): void;
        /**
         * Verifies that at least one assertion is called during a test.
         * This is often useful when testing asynchronous code, in order to
         * make sure that assertions in a callback actually got called.
         */
        hasAssertions(): void;
        /**
         * You can use `expect.extend` to add your own matchers to Jest.
         */
        extend(obj: ExpectExtendMap): void;
        /**
         * Adds a module to format application-specific data structures for serialization.
         */
        addSnapshotSerializer(serializer: SnapshotSerializerPlugin): void;
        /**
         * Matches any object that recursively matches the provided keys.
         * This is often handy in conjunction with other asymmetric matchers.
         */
        objectContaining(obj: {}): any;
        /**
         * Matches any string that contains the exact provided string
         */
        stringMatching(str: string | RegExp): any;
        /**
         * Matches any received string that contains the exact expected string
         */
        stringContaining(str: string): any;

        not: InverseAsymmetricMatchers;
    }

    interface Matchers<R> {
        /**
         * Ensures the last call to a mock function was provided specific args.
         */
        lastCalledWith(...args: any[]): R;
        /**
         * Ensure that the last call to a mock function has returned a specified value.
         */
        lastReturnedWith(value: any): R;
        /**
         * If you know how to test something, `.not` lets you test its opposite.
         */
        not: Matchers<R>;
        /**
         * Ensure that a mock function is called with specific arguments on an Nth call.
         */
        nthCalledWith(nthCall: number, ...params: any[]): R;
        /**
         * Ensure that the nth call to a mock function has returned a specified value.
         */
        nthReturnedWith(n: number, value: any): R;
        /**
         * Use resolves to unwrap the value of a fulfilled promise so any other
         * matcher can be chained. If the promise is rejected the assertion fails.
         */
        resolves: Matchers<Promise<R>>;
        /**
         * Unwraps the reason of a rejected promise so any other matcher can be chained.
         * If the promise is fulfilled the assertion fails.
         */
        rejects: Matchers<Promise<R>>;
        /**
         * Checks that a value is what you expect. It uses `===` to check strict equality.
         * Don't use `toBe` with floating-point numbers.
         */
        toBe(expected: any): R;
        /**
         * Ensures that a mock function is called.
         */
        toBeCalled(): R;
        /**
         * Ensures that a mock function is called an exact number of times.
         */
        toBeCalledTimes(expected: number): R;
        /**
         * Ensure that a mock function is called with specific arguments.
         */
        toBeCalledWith(...args: any[]): R;
        /**
         * Using exact equality with floating point numbers is a bad idea.
         * Rounding means that intuitive things fail.
         * The default for numDigits is 2.
         */
        toBeCloseTo(expected: number, numDigits?: number): R;
        /**
         * Ensure that a variable is not undefined.
         */
        toBeDefined(): R;
        /**
         * When you don't care what a value is, you just want to
         * ensure a value is false in a boolean context.
         */
        toBeFalsy(): R;
        /**
         * For comparing floating point numbers.
         */
        toBeGreaterThan(expected: number): R;
        /**
         * For comparing floating point numbers.
         */
        toBeGreaterThanOrEqual(expected: number): R;
        /**
         * Ensure that an object is an instance of a class.
         * This matcher uses `instanceof` underneath.
         */
        toBeInstanceOf(expected: any): R;
        /**
         * For comparing floating point numbers.
         */
        toBeLessThan(expected: number): R;
        /**
         * For comparing floating point numbers.
         */
        toBeLessThanOrEqual(expected: number): R;
        /**
         * This is the same as `.toBe(null)` but the error messages are a bit nicer.
         * So use `.toBeNull()` when you want to check that something is null.
         */
        toBeNull(): R;
        /**
         * Use when you don't care what a value is, you just want to ensure a value
         * is true in a boolean context. In JavaScript, there are six falsy values:
         * `false`, `0`, `''`, `null`, `undefined`, and `NaN`. Everything else is truthy.
         */
        toBeTruthy(): R;
        /**
         * Used to check that a variable is undefined.
         */
        toBeUndefined(): R;
        /**
         * Used to check that a variable is NaN.
         */
        toBeNaN(): R;
        /**
         * Used when you want to check that an item is in a list.
         * For testing the items in the list, this uses `===`, a strict equality check.
         */
        toContain(expected: any): R;
        /**
         * Used when you want to check that an item is in a list.
         * For testing the items in the list, this  matcher recursively checks the
         * equality of all fields, rather than checking for object identity.
         */
        toContainEqual(expected: any): R;
        /**
         * Used when you want to check that two objects have the same value.
         * This matcher recursively checks the equality of all fields, rather than checking for object identity.
         */
        toEqual(expected: any): R;
        /**
         * Ensures that a mock function is called.
         */
        toHaveBeenCalled(): R;
        /**
         * Ensures that a mock function is called an exact number of times.
         */
        toHaveBeenCalledTimes(expected: number): R;
        /**
         * Ensure that a mock function is called with specific arguments.
         */
        toHaveBeenCalledWith(...params: any[]): R;
        /**
         * Ensure that a mock function is called with specific arguments on an Nth call.
         */
        toHaveBeenNthCalledWith(nthCall: number, ...params: any[]): R;
        /**
         * If you have a mock function, you can use `.toHaveBeenLastCalledWith`
         * to test what arguments it was last called with.
         */
        toHaveBeenLastCalledWith(...params: any[]): R;
        /**
         * Use to test the specific value that a mock function last returned.
         * If the last call to the mock function threw an error, then this matcher will fail
         * no matter what value you provided as the expected return value.
         */
        toHaveLastReturnedWith(expected: any): R;
        /**
         * Used to check that an object has a `.length` property
         * and it is set to a certain numeric value.
         */
        toHaveLength(expected: number): R;
        /**
         * Use to test the specific value that a mock function returned for the nth call.
         * If the nth call to the mock function threw an error, then this matcher will fail
         * no matter what value you provided as the expected return value.
         */
        toHaveNthReturnedWith(nthCall: number, expected: any): R;
        /**
         * Use to check if property at provided reference keyPath exists for an object.
         * For checking deeply nested properties in an object you may use dot notation or an array containing
         * the keyPath for deep references.
         *
         * Optionally, you can provide a value to check if it's equal to the value present at keyPath
         * on the target object. This matcher uses 'deep equality' (like `toEqual()`) and recursively checks
         * the equality of all fields.
         *
         * @example
         *
         * expect(houseForSale).toHaveProperty('kitchen.area', 20);
         */
        toHaveProperty(propertyPath: string | any[], value?: any): R;
        /**
         * Use to test that the mock function successfully returned (i.e., did not throw an error) at least one time
         */
        toHaveReturned(): R;
        /**
         * Use to ensure that a mock function returned successfully (i.e., did not throw an error) an exact number of times.
         * Any calls to the mock function that throw an error are not counted toward the number of times the function returned.
         */
        toHaveReturnedTimes(expected: number): R;
        /**
         * Use to ensure that a mock function returned a specific value.
         */
        toHaveReturnedWith(expected: any): R;
        /**
         * Check that a string matches a regular expression.
         */
        toMatch(expected: string | RegExp): R;
        /**
         * Used to check that a JavaScript object matches a subset of the properties of an object
         */
        toMatchObject(expected: {} | any[]): R;
        /**
         * This ensures that a value matches the most recent snapshot with property matchers.
         * Check out [the Snapshot Testing guide](http://facebook.github.io/jest/docs/snapshot-testing.html) for more information.
         */
        toMatchSnapshot<T extends {[P in keyof R]: any}>(propertyMatchers: Partial<T>, snapshotName?: string): R;
        /**
         * This ensures that a value matches the most recent snapshot.
         * Check out [the Snapshot Testing guide](http://facebook.github.io/jest/docs/snapshot-testing.html) for more information.
         */
        toMatchSnapshot(snapshotName?: string): R;
        /**
         * This ensures that a value matches the most recent snapshot with property matchers.
         * Instead of writing the snapshot value to a .snap file, it will be written into the source code automatically.
         * Check out [the Snapshot Testing guide](http://facebook.github.io/jest/docs/snapshot-testing.html) for more information.
         */
        toMatchInlineSnapshot<T extends {[P in keyof R]: any}>(propertyMatchers: Partial<T>, snapshot?: string): R;
        /**
         * This ensures that a value matches the most recent snapshot with property matchers.
         * Instead of writing the snapshot value to a .snap file, it will be written into the source code automatically.
         * Check out [the Snapshot Testing guide](http://facebook.github.io/jest/docs/snapshot-testing.html) for more information.
         */
        toMatchInlineSnapshot(snapshot?: string): R;
        /**
         * Ensure that a mock function has returned (as opposed to thrown) at least once.
         */
        toReturn(): R;
        /**
         * Ensure that a mock function has returned (as opposed to thrown) a specified number of times.
         */
        toReturnTimes(count: number): R;
        /**
         * Ensure that a mock function has returned a specified value at least once.
         */
        toReturnWith(value: any): R;
        /**
         * Use to test that objects have the same types as well as structure.
         */
        toStrictEqual(expected: {}): R;
        /**
         * Used to test that a function throws when it is called.
         */
        toThrow(error?: string | Constructable | RegExp | Error): R;
        /**
         * If you want to test that a specific error is thrown inside a function.
         */
        toThrowError(error?: string | Constructable | RegExp | Error): R;
        /**
         * Used to test that a function throws a error matching the most recent snapshot when it is called.
         */
        toThrowErrorMatchingSnapshot(): R;
        /**
         * Used to test that a function throws a error matching the most recent snapshot when it is called.
         * Instead of writing the snapshot value to a .snap file, it will be written into the source code automatically.
         */
        toThrowErrorMatchingInlineSnapshot(snapshot?: string): R;
    }

    interface Constructable {
        new (...args: any[]): any;
    }

    interface Mock<T = {}> extends Function, MockInstance<T> {
        new (...args: any[]): T;
        (...args: any[]): any;
    }

    interface SpyInstance<T = {}> extends MockInstance<T> {}

    /**
     * Wrap module with mock definitions
     *
     * @example
     *
     *  jest.mock("../api");
     *  import { Api } from "../api";
     *
     *  const myApi: jest.Mocked<Api> = new Api() as any;
     *  myApi.myApiMethod.mockImplementation(() => "test");
     */
    type Mocked<T> = {
        [P in keyof T]: T[P] & MockInstance<T[P]>;
    } & T;

    interface MockInstance<T> {
        /** Returns the mock name string set by calling `mockFn.mockName(value)`. */
        getMockName(): string;
        /** Provides access to the mock's metadata */
        mock: MockContext<T>;
        /**
         * Resets all information stored in the mockFn.mock.calls and mockFn.mock.instances arrays.
         *
         * Often this is useful when you want to clean up a mock's usage data between two assertions.
         *
         * Beware that `mockClear` will replace `mockFn.mock`, not just `mockFn.mock.calls` and `mockFn.mock.instances`.
         * You should therefore avoid assigning mockFn.mock to other variables, temporary or not, to make sure you
         * don't access stale data.
         */
        mockClear(): void;
        /**
         * Resets all information stored in the mock, including any initial implementation and mock name given.
         *
         * This is useful when you want to completely restore a mock back to its initial state.
         *
         * Beware that `mockReset` will replace `mockFn.mock`, not just `mockFn.mock.calls` and `mockFn.mock.instances`.
         * You should therefore avoid assigning mockFn.mock to other variables, temporary or not, to make sure you
         * don't access stale data.
         */
        mockReset(): void;
        /**
         * Does everything that `mockFn.mockReset()` does, and also restores the original (non-mocked) implementation.
         *
         * This is useful when you want to mock functions in certain test cases and restore the original implementation in others.
         *
         * Beware that `mockFn.mockRestore` only works when mock was created with `jest.spyOn`. Thus you have to take care of restoration
         * yourself when manually assigning `jest.fn()`.
         *
         * The [`restoreMocks`](https://jestjs.io/docs/en/configuration.html#restoremocks-boolean) configuration option is available
         * to restore mocks automatically between tests.
         */
        mockRestore(): void;
        /**
         * Accepts a function that should be used as the implementation of the mock. The mock itself will still record
         * all calls that go into and instances that come from itself – the only difference is that the implementation
         * will also be executed when the mock is called.
         *
         * Note: `jest.fn(implementation)` is a shorthand for `jest.fn().mockImplementation(implementation)`.
         */
        mockImplementation(fn?: (...args: any[]) => any): Mock<T>;
        /**
         * Accepts a function that will be used as an implementation of the mock for one call to the mocked function.
         * Can be chained so that multiple function calls produce different results.
         *
         * @example
         *
         * const myMockFn = jest
         *   .fn()
         *    .mockImplementationOnce(cb => cb(null, true))
         *    .mockImplementationOnce(cb => cb(null, false));
         *
         * myMockFn((err, val) => console.log(val)); // true
         *
         * myMockFn((err, val) => console.log(val)); // false
         */
        mockImplementationOnce(fn: (...args: any[]) => any): Mock<T>;
        /** Sets the name of the mock`. */
        mockName(name: string): Mock<T>;
        /**
         * Just a simple sugar function for:
         *
         * @example
         *
         *   jest.fn(function() {
         *     return this;
         *   });
         */
        mockReturnThis(): Mock<T>;
        /**
         * Accepts a value that will be returned whenever the mock function is called.
         *
         * @example
         *
         * const mock = jest.fn();
         * mock.mockReturnValue(42);
         * mock(); // 42
         * mock.mockReturnValue(43);
         * mock(); // 43
         */
        mockReturnValue(value: any): Mock<T>;
        /**
         * Accepts a value that will be returned for one call to the mock function. Can be chained so that
         * successive calls to the mock function return different values. When there are no more
         * `mockReturnValueOnce` values to use, calls will return a value specified by `mockReturnValue`.
         *
         * @example
         *
         * const myMockFn = jest.fn()
         *   .mockReturnValue('default')
         *   .mockReturnValueOnce('first call')
         *   .mockReturnValueOnce('second call');
         *
         * // 'first call', 'second call', 'default', 'default'
         * console.log(myMockFn(), myMockFn(), myMockFn(), myMockFn());
         *
         */
        mockReturnValueOnce(value: any): Mock<T>;
        /**
         * Simple sugar function for: `jest.fn().mockImplementation(() => Promise.resolve(value));`
         */
        mockResolvedValue(value: any): Mock<T>;
        /**
         * Simple sugar function for: `jest.fn().mockImplementationOnce(() => Promise.resolve(value));`
         *
         * @example
         *
         * test('async test', async () => {
         *  const asyncMock = jest
         *    .fn()
         *    .mockResolvedValue('default')
         *    .mockResolvedValueOnce('first call')
         *    .mockResolvedValueOnce('second call');
         *
         *  await asyncMock(); // first call
         *  await asyncMock(); // second call
         *  await asyncMock(); // default
         *  await asyncMock(); // default
         * });
         *
         */
        mockResolvedValueOnce(value: any): Mock<T>;
        /**
         * Simple sugar function for: `jest.fn().mockImplementation(() => Promise.reject(value));`
         *
         * @example
         *
         * test('async test', async () => {
         *   const asyncMock = jest.fn().mockRejectedValue(new Error('Async error'));
         *
         *   await asyncMock(); // throws "Async error"
         * });
         */
        mockRejectedValue(value: any): Mock<T>;

        /**
         * Simple sugar function for: `jest.fn().mockImplementationOnce(() => Promise.reject(value));`
         *
         * @example
         *
         * test('async test', async () => {
         *  const asyncMock = jest
         *    .fn()
         *    .mockResolvedValueOnce('first call')
         *    .mockRejectedValueOnce(new Error('Async error'));
         *
         *  await asyncMock(); // first call
         *  await asyncMock(); // throws "Async error"
         * });
         *
         */
        mockRejectedValueOnce(value: any): Mock<T>;
    }

    /**
     * Represents the result of a single call to a mock function.
     */
    interface MockResult {
        /**
         * True if the function threw.
         * False if the function returned.
         */
        isThrow: boolean;
        /**
         * The value that was either thrown or returned by the function.
         */
        value: any;
    }

    interface MockContext<T> {
        calls: any[][];
        instances: T[];
        invocationCallOrder: number[];
        /**
         * List of results of calls to the mock function.
         */
        results: MockResult[];
    }
}

// Jest ships with a copy of Jasmine. They monkey-patch its APIs and divergence/deprecation are expected.
// Relevant parts of Jasmine's API are below so they can be changed and removed over time.
// This file can't reference jasmine.d.ts since the globals aren't compatible.

declare function spyOn<T>(object: T, method: keyof T): jasmine.Spy;
/**
 * If you call the function pending anywhere in the spec body,
 * no matter the expectations, the spec will be marked pending.
 */
declare function pending(reason?: string): void;
/**
 * Fails a test when called within one.
 */
declare function fail(error?: any): void;
declare namespace jasmine {
    let DEFAULT_TIMEOUT_INTERVAL: number;
    function clock(): Clock;
    function any(aclass: any): Any;
    function anything(): Any;
    function arrayContaining(sample: any[]): ArrayContaining;
    function objectContaining(sample: any): ObjectContaining;
    function createSpy(name?: string, originalFn?: (...args: any[]) => any): Spy;
    function createSpyObj(baseName: string, methodNames: any[]): any;
    function createSpyObj<T>(baseName: string, methodNames: any[]): T;
    function pp(value: any): string;
    function addCustomEqualityTester(equalityTester: CustomEqualityTester): void;
    function addMatchers(matchers: CustomMatcherFactories): void;
    function stringMatching(value: string | RegExp): Any;

    interface Clock {
        install(): void;
        uninstall(): void;
        /**
         * Calls to any registered callback are triggered when the clock isticked forward
         * via the jasmine.clock().tick function, which takes a number of milliseconds.
         */
        tick(ms: number): void;
        mockDate(date?: Date): void;
    }

    interface Any {
        new (expectedClass: any): any;
        jasmineMatches(other: any): boolean;
        jasmineToString(): string;
    }

    interface ArrayContaining {
        new (sample: any[]): any;
        asymmetricMatch(other: any): boolean;
        jasmineToString(): string;
    }

    interface ObjectContaining {
        new (sample: any): any;
        jasmineMatches(other: any, mismatchKeys: any[], mismatchValues: any[]): boolean;
        jasmineToString(): string;
    }

    interface Spy {
        (...params: any[]): any;
        identity: string;
        and: SpyAnd;
        calls: Calls;
        mostRecentCall: { args: any[]; };
        argsForCall: any[];
        wasCalled: boolean;
    }

    interface SpyAnd {
        /**
         * By chaining the spy with and.callThrough, the spy will still track all
         * calls to it but in addition it will delegate to the actual implementation.
         */
        callThrough(): Spy;
        /**
         * By chaining the spy with and.returnValue, all calls to the function
         * will return a specific value.
         */
        returnValue(val: any): Spy;
        /**
         * By chaining the spy with and.returnValues, all calls to the function
         * will return specific values in order until it reaches the end of the return values list.
         */
        returnValues(...values: any[]): Spy;
        /**
         * By chaining the spy with and.callFake, all calls to the spy
         * will delegate to the supplied function.
         */
        callFake(fn: (...args: any[]) => any): Spy;
        /**
         * By chaining the spy with and.throwError, all calls to the spy
         * will throw the specified value.
         */
        throwError(msg: string): Spy;
        /**
         * When a calling strategy is used for a spy, the original stubbing
         * behavior can be returned at any time with and.stub.
         */
        stub(): Spy;
    }

    interface Calls {
        /**
         * By chaining the spy with calls.any(),
         * will return false if the spy has not been called at all,
         * and then true once at least one call happens.
         */
        any(): boolean;
        /**
         * By chaining the spy with calls.count(),
         * will return the number of times the spy was called
         */
        count(): number;
        /**
         * By chaining the spy with calls.argsFor(),
         * will return the arguments passed to call number index
         */
        argsFor(index: number): any[];
        /**
         * By chaining the spy with calls.allArgs(),
         * will return the arguments to all calls
         */
        allArgs(): any[];
        /**
         * By chaining the spy with calls.all(), will return the
         * context (the this) and arguments passed all calls
         */
        all(): CallInfo[];
        /**
         * By chaining the spy with calls.mostRecent(), will return the
         * context (the this) and arguments for the most recent call
         */
        mostRecent(): CallInfo;
        /**
         * By chaining the spy with calls.first(), will return the
         * context (the this) and arguments for the first call
         */
        first(): CallInfo;
        /**
         * By chaining the spy with calls.reset(), will clears all tracking for a spy
         */
        reset(): void;
    }

    interface CallInfo {
        /**
         * The context (the this) for the call
         */
        object: any;
        /**
         * All arguments passed to the call
         */
        args: any[];
        /**
         * The return value of the call
         */
        returnValue: any;
    }

    interface CustomMatcherFactories {
        [index: string]: CustomMatcherFactory;
    }

    type CustomMatcherFactory = (util: MatchersUtil, customEqualityTesters: CustomEqualityTester[]) => CustomMatcher;

    interface MatchersUtil {
        equals(a: any, b: any, customTesters?: CustomEqualityTester[]): boolean;
        contains<T>(haystack: ArrayLike<T> | string, needle: any, customTesters?: CustomEqualityTester[]): boolean;
        buildFailureMessage(matcherName: string, isNot: boolean, actual: any, ...expected: any[]): string;
    }

    type CustomEqualityTester = (first: any, second: any) => boolean;

    interface CustomMatcher {
        compare<T>(actual: T, expected: T, ...args: any[]): CustomMatcherResult;
        compare(actual: any, ...expected: any[]): CustomMatcherResult;
    }

    interface CustomMatcherResult {
        pass: boolean;
        message: string | (() => string);
    }

    interface ArrayLike<T> {
        length: number;
        [n: number]: T;
    }
}

declare namespace jest {
    // types for implementing custom interfaces, from https://github.com/facebook/jest/tree/dd6c5c4/types

    // https://facebook.github.io/jest/docs/en/configuration.html#transform-object-string-string
    // const transformer: Transformer;

    // https://facebook.github.io/jest/docs/en/configuration.html#reporters-array-modulename-modulename-options
    // const reporter: Reporter;

    // https://facebook.github.io/jest/docs/en/configuration.html#testrunner-string
    // const testRunner: TestFramework;

    // https://facebook.github.io/jest/docs/en/configuration.html#testresultsprocessor-string
    // const testResultsProcessor: TestResultsProcessor;

    // leave above declarations for referening type-dependencies
    // .vscode/settings.json: "typescript.referencesCodeLens.enabled": true

    // custom

    // flow's Maybe type https://flow.org/en/docs/types/primitives/#toc-maybe-types
    type Maybe<T> = void | null | undefined | T; // tslint:disable-line:void-return

    type TestResultsProcessor = (testResult: AggregatedResult) => AggregatedResult;

    type HasteResolver = any; // import HasteResolver from 'jest-resolve';
    type ModuleMocker = any; // import { ModuleMocker } from 'jest-mock';
    type ModuleMap = any; // import {ModuleMap} from 'jest-haste-map';
    type HasteFS = any; // import {FS as HasteFS} from 'jest-haste-map';
    type Runtime = any; // import Runtime from 'jest-runtime';
    type Script = any; // import {Script} from 'vm';

    // Config

    type Path = string;
    type Glob = string;

    interface HasteConfig {
        defaultPlatform?: Maybe<string>;
        hasteImplModulePath?: string;
        platforms?: string[];
        providesModuleNodeModules: string[];
    }

    type ReporterConfig = [string, object];

    type ConfigGlobals = object;

    type SnapshotUpdateState = 'all' | 'new' | 'none';

    interface DefaultOptions {
        automock: boolean;
        bail: boolean;
        browser: boolean;
        cache: boolean;
        cacheDirectory: Path;
        changedFilesWithAncestor: boolean;
        clearMocks: boolean;
        collectCoverage: boolean;
        collectCoverageFrom: Maybe<string[]>;
        coverageDirectory: Maybe<string>;
        coveragePathIgnorePatterns: string[];
        coverageReporters: string[];
        coverageThreshold: Maybe<{global: {[key: string]: number}}>;
        errorOnDeprecated: boolean;
        expand: boolean;
        filter: Maybe<Path>;
        forceCoverageMatch: Glob[];
        globals: ConfigGlobals;
        globalSetup: Maybe<string>;
        globalTeardown: Maybe<string>;
        haste: HasteConfig;
        detectLeaks: boolean;
        detectOpenHandles: boolean;
        moduleDirectories: string[];
        moduleFileExtensions: string[];
        moduleNameMapper: {[key: string]: string};
        modulePathIgnorePatterns: string[];
        noStackTrace: boolean;
        notify: boolean;
        notifyMode: string;
        preset: Maybe<string>;
        projects: Maybe<Array<string | ProjectConfig>>;
        resetMocks: boolean;
        resetModules: boolean;
        resolver: Maybe<Path>;
        restoreMocks: boolean;
        rootDir: Maybe<Path>;
        roots: Maybe<Path[]>;
        runner: string;
        runTestsByPath: boolean;
        setupFiles: Path[];
        setupTestFrameworkScriptFile: Maybe<Path>;
        skipFilter: boolean;
        snapshotSerializers: Path[];
        testEnvironment: string;
        testEnvironmentOptions: object;
        testFailureExitCode: string | number;
        testLocationInResults: boolean;
        testMatch: Glob[];
        testPathIgnorePatterns: string[];
        testRegex: string;
        testResultsProcessor: Maybe<string>;
        testRunner: Maybe<string>;
        testURL: string;
        timers: 'real' | 'fake';
        transform: Maybe<{[key: string]: string}>;
        transformIgnorePatterns: Glob[];
        watchPathIgnorePatterns: string[];
        useStderr: boolean;
        verbose: Maybe<boolean>;
        watch: boolean;
        watchman: boolean;
    }

    interface InitialOptions {
        automock?: boolean;
        bail?: boolean;
        browser?: boolean;
        cache?: boolean;
        cacheDirectory?: Path;
        clearMocks?: boolean;
        changedFilesWithAncestor?: boolean;
        changedSince?: string;
        collectCoverage?: boolean;
        collectCoverageFrom?: Glob[];
        collectCoverageOnlyFrom?: {[key: string]: boolean};
        coverageDirectory?: string;
        coveragePathIgnorePatterns?: string[];
        coverageReporters?: string[];
        coverageThreshold?: {global: {[key: string]: number}};
        detectLeaks?: boolean;
        detectOpenHandles?: boolean;
        displayName?: string;
        expand?: boolean;
        filter?: Path;
        findRelatedTests?: boolean;
        forceCoverageMatch?: Glob[];
        forceExit?: boolean;
        json?: boolean;
        globals?: ConfigGlobals;
        globalSetup?: Maybe<string>;
        globalTeardown?: Maybe<string>;
        haste?: HasteConfig;
        reporters?: Array<ReporterConfig | string>;
        logHeapUsage?: boolean;
        lastCommit?: boolean;
        listTests?: boolean;
        mapCoverage?: boolean;
        moduleDirectories?: string[];
        moduleFileExtensions?: string[];
        moduleLoader?: Path;
        moduleNameMapper?: {[key: string]: string};
        modulePathIgnorePatterns?: string[];
        modulePaths?: string[];
        name?: string;
        noStackTrace?: boolean;
        notify?: boolean;
        notifyMode?: string;
        onlyChanged?: boolean;
        outputFile?: Path;
        passWithNoTests?: boolean;
        preprocessorIgnorePatterns?: Glob[];
        preset?: Maybe<string>;
        projects?: Glob[];
        replname?: Maybe<string>;
        resetMocks?: boolean;
        resetModules?: boolean;
        resolver?: Maybe<Path>;
        restoreMocks?: boolean;
        rootDir?: Path;
        roots?: Path[];
        runner?: string;
        runTestsByPath?: boolean;
        scriptPreprocessor?: string;
        setupFiles?: Path[];
        setupTestFrameworkScriptFile?: Path;
        silent?: boolean;
        skipFilter?: boolean;
        skipNodeResolution?: boolean;
        snapshotSerializers?: Path[];
        errorOnDeprecated?: boolean;
        testEnvironment?: string;
        testEnvironmentOptions?: object;
        testFailureExitCode?: string | number;
        testLocationInResults?: boolean;
        testMatch?: Glob[];
        testNamePattern?: string;
        testPathDirs?: Path[];
        testPathIgnorePatterns?: string[];
        testRegex?: string;
        testResultsProcessor?: Maybe<string>;
        testRunner?: string;
        testURL?: string;
        timers?: 'real' | 'fake';
        transform?: {[key: string]: string};
        transformIgnorePatterns?: Glob[];
        watchPathIgnorePatterns?: string[];
        unmockedModulePathPatterns?: string[];
        updateSnapshot?: boolean;
        useStderr?: boolean;
        verbose?: Maybe<boolean>;
        watch?: boolean;
        watchAll?: boolean;
        watchman?: boolean;
        watchPlugins?: string[];
    }

    interface GlobalConfig {
        bail: boolean;
        collectCoverage: boolean;
        collectCoverageFrom: Glob[];
        collectCoverageOnlyFrom: Maybe<{[key: string]: boolean}>;
        coverageDirectory: string;
        coverageReporters: string[];
        coverageThreshold: {global: {[key: string]: number}};
        expand: boolean;
        forceExit: boolean;
        logHeapUsage: boolean;
        mapCoverage: boolean;
        noStackTrace: boolean;
        notify: boolean;
        projects: Glob[];
        replname: Maybe<string>;
        reporters: ReporterConfig[];
        rootDir: Path;
        silent: boolean;
        testNamePattern: string;
        testPathPattern: string;
        testResultsProcessor: Maybe<string>;
        updateSnapshot: SnapshotUpdateState;
        useStderr: boolean;
        verbose: Maybe<boolean>;
        watch: boolean;
        watchman: boolean;
    }

    interface ProjectConfig {
        automock: boolean;
        browser: boolean;
        cache: boolean;
        cacheDirectory: Path;
        clearMocks: boolean;
        coveragePathIgnorePatterns: string[];
        cwd: Path;
        detectLeaks: boolean;
        displayName: Maybe<string>;
        forceCoverageMatch: Glob[];
        globals: ConfigGlobals;
        haste: HasteConfig;
        moduleDirectories: string[];
        moduleFileExtensions: string[];
        moduleLoader: Path;
        moduleNameMapper: Array<[string, string]>;
        modulePathIgnorePatterns: string[];
        modulePaths: string[];
        name: string;
        resetMocks: boolean;
        resetModules: boolean;
        resolver: Maybe<Path>;
        rootDir: Path;
        roots: Path[];
        runner: string;
        setupFiles: Path[];
        setupTestFrameworkScriptFile: Path;
        skipNodeResolution: boolean;
        snapshotSerializers: Path[];
        testEnvironment: string;
        testEnvironmentOptions: object;
        testLocationInResults: boolean;
        testMatch: Glob[];
        testPathIgnorePatterns: string[];
        testRegex: string;
        testRunner: string;
        testURL: string;
        timers: 'real' | 'fake';
        transform: Array<[string, Path]>;
        transformIgnorePatterns: Glob[];
        unmockedModulePathPatterns: Maybe<string[]>;
        watchPathIgnorePatterns: string[];
    }

    // Console

    type LogMessage = string;
    interface LogEntry {
        message: LogMessage;
        origin: string;
        type: LogType;
    }
    type LogType = 'log' | 'info' | 'warn' | 'error';
    type ConsoleBuffer = LogEntry[];

    // Context

    interface Context {
        config: ProjectConfig;
        hasteFS: HasteFS;
        moduleMap: ModuleMap;
        resolver: HasteResolver;
    }

    // Environment

    interface FakeTimers {
        clearAllTimers(): void;
        runAllImmediates(): void;
        runAllTicks(): void;
        runAllTimers(): void;
        runTimersToTime(msToRun: number): void;
        advanceTimersByTime(msToRun: number): void;
        runOnlyPendingTimers(): void;
        runWithRealTimers(callback: any): void;
        useFakeTimers(): void;
        useRealTimers(): void;
    }

    interface $JestEnvironment {
        global: Global;
        fakeTimers: FakeTimers;
        testFilePath: string;
        moduleMocker: ModuleMocker;

        dispose(): void;
        runScript(script: Script): any;
    }

    type Environment = $JestEnvironment;

    // Global

    type Global = object;

    // Reporter

    interface ReporterOnStartOptions {
        estimatedTime: number;
        showStatus: boolean;
    }

    // TestResult

    interface RawFileCoverage {
        path: string;
        s: {[statementId: number]: number};
        b: {[branchId: number]: number};
        f: {[functionId: number]: number};
        l: {[lineId: number]: number};
        fnMap: {[functionId: number]: any};
        statementMap: {[statementId: number]: any};
        branchMap: {[branchId: number]: any};
        inputSourceMap?: object;
    }

    interface RawCoverage {
        [filePath: string]: RawFileCoverage;
    }

    interface FileCoverageTotal {
        total: number;
        covered: number;
        skipped: number;
        pct?: number;
    }

    interface CoverageSummary {
        lines: FileCoverageTotal;
        statements: FileCoverageTotal;
        branches: FileCoverageTotal;
        functions: FileCoverageTotal;
    }

    interface FileCoverage {
        getLineCoverage(): object;
        getUncoveredLines(): number[];
        getBranchCoverageByLine(): object;
        toJSON(): object;
        merge(other: object): void;
        computeSimpleTotals(property: string): FileCoverageTotal;
        computeBranchTotals(): FileCoverageTotal;
        resetHits(): void;
        toSummary(): CoverageSummary;
    }

    interface CoverageMap {
        merge(data: object): void;
        getCoverageSummary(): FileCoverage;
        data: RawCoverage;
        addFileCoverage(fileCoverage: RawFileCoverage): void;
        files(): string[];
        fileCoverageFor(file: string): FileCoverage;
    }

    interface SerializableError {
        code?: any;
        message: string;
        stack: Maybe<string>;
        type?: string;
    }

    type Status = 'passed' | 'failed' | 'skipped' | 'pending';

    type Bytes = number;
    type Milliseconds = number;

    interface AssertionResult {
        ancestorTitles: string[];
        duration?: Maybe<Milliseconds>;
        failureMessages: string[];
        fullName: string;
        numPassingAsserts: number;
        status: Status;
        title: string;
    }

    interface AggregatedResult {
        coverageMap?: Maybe<CoverageMap>;
        numFailedTests: number;
        numFailedTestSuites: number;
        numPassedTests: number;
        numPassedTestSuites: number;
        numPendingTests: number;
        numPendingTestSuites: number;
        numRuntimeErrorTestSuites: number;
        numTotalTests: number;
        numTotalTestSuites: number;
        snapshot: SnapshotSummary;
        startTime: number;
        success: boolean;
        testResults: TestResult[];
        wasInterrupted: boolean;
    }

    interface TestResult {
        console: Maybe<ConsoleBuffer>;
        coverage?: RawCoverage;
        memoryUsage?: Bytes;
        failureMessage: Maybe<string>;
        numFailingTests: number;
        numPassingTests: number;
        numPendingTests: number;
        perfStats: {
            end: Milliseconds,
            start: Milliseconds,
        };
        skipped: boolean;
        snapshot: {
            added: number,
            fileDeleted: boolean,
            matched: number,
            unchecked: number,
            unmatched: number,
            updated: number,
        };
        sourceMaps: {[sourcePath: string]: string};
        testExecError?: SerializableError;
        testFilePath: string;
        testResults: AssertionResult[];
    }

    interface SnapshotSummary {
        added: number;
        didUpdate: boolean;
        failure: boolean;
        filesAdded: number;
        filesRemoved: number;
        filesUnmatched: number;
        filesUpdated: number;
        matched: number;
        total: number;
        unchecked: number;
        unmatched: number;
        updated: number;
    }

    // TestRunner

    interface Test {
        context: Context;
        duration?: number;
        path: Path;
    }

    // tslint:disable-next-line:no-empty-interface
    interface Set<T> {} // To allow non-ES6 users the Set below
    interface Reporter {
        onTestResult?(test: Test, testResult: TestResult, aggregatedResult: AggregatedResult): void;
        onRunStart?(results: AggregatedResult, options: ReporterOnStartOptions): void;
        onTestStart?(test: Test): void;
        onRunComplete?(contexts: Set<Context>, results: AggregatedResult): Maybe<Promise<void>>;
        getLastError?(): Maybe<Error>;
    }

    type TestFramework = (
        globalConfig: GlobalConfig,
        config: ProjectConfig,
        environment: Environment,
        runtime: Runtime,
        testPath: string,
    ) => Promise<TestResult>;

    // Transform

    interface TransformedSource {
        code: string;
        map: Maybe<object | string>;
    }

    interface TransformOptions {
        instrument: boolean;
    }

    interface Transformer {
        canInstrument?: boolean;
        createTransformer?(options: any): Transformer;

        getCacheKey?(
            fileData: string,
            filePath: Path,
            configStr: string,
            options: TransformOptions,
        ): string;

        process(
            sourceText: string,
            sourcePath: Path,
            config: ProjectConfig,
            options?: TransformOptions,
        ): string | TransformedSource;
    }
}
