// Type definitions for Node.js 10.12
// Project: http://nodejs.org/
// Definitions by: Microsoft TypeScript <https://github.com/Microsoft>
//                 DefinitelyTyped <https://github.com/DefinitelyTyped>
//                 Alberto Schiabel <https://github.com/jkomyno>
//                 Alexander T. <https://github.com/a-tarasyuk>
//                 Alvis HT Tang <https://github.com/alvis>
//                 Andrew Makarov <https://github.com/r3nya>
//                 Bruno Scheufler <https://github.com/brunoscheufler>
//                 Chigozirim C. <https://github.com/smac89>
//                 Christian Vaagland Tellnes <https://github.com/tellnes>
//                 Deividas Bakanas <https://github.com/DeividasBakanas>
//                 Eugene Y. Q. Shen <https://github.com/eyqs>
//                 Flarna <https://github.com/Flarna>
//                 Hannes Magnusson <https://github.com/Hannes-Magnusson-CK>
//                 Hoàng Văn Khải <https://github.com/KSXGitHub>
//                 Huw <https://github.com/hoo29>
//                 Kelvin Jin <https://github.com/kjin>
//                 Klaus Meinhardt <https://github.com/ajafff>
//                 Lishude <https://github.com/islishude>
//                 Mariusz Wiktorczyk <https://github.com/mwiktorczyk>
//                 Matthieu Sieben <https://github.com/matthieusieben>
//                 Mohsen Azimi <https://github.com/mohsen1>
//                 Nicolas Even <https://github.com/n-e>
//                 Nicolas Voigt <https://github.com/octo-sniffle>
//                 Parambir Singh <https://github.com/parambirs>
//                 Sebastian Silbermann <https://github.com/eps1lon>
//                 Simon Schick <https://github.com/SimonSchick>
//                 Thomas den Hollander <https://github.com/ThomasdenH>
//                 Wilco Bakker <https://github.com/WilcoBakker>
//                 wwwy3y3 <https://github.com/wwwy3y3>
//                 Zane Hannan AU <https://github.com/ZaneHannanAU>
//                 Jeremie Rodriguez <https://github.com/jeremiergz>
//                 Samuel Ainsworth <https://github.com/samuela>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/** inspector module types */
/// <reference path="./inspector.d.ts" />

// This needs to be global to avoid TS2403 in case lib.dom.d.ts is present in the same build
interface Console {
    Console: NodeJS.ConsoleConstructor;
    /**
     * A simple assertion test that verifies whether `value` is truthy.
     * If it is not, an `AssertionError` is thrown.
     * If provided, the error `message` is formatted using `util.format()` and used as the error message.
     */
    assert(value: any, message?: string, ...optionalParams: any[]): void;
    /**
     * When `stdout` is a TTY, calling `console.clear()` will attempt to clear the TTY.
     * When `stdout` is not a TTY, this method does nothing.
     */
    clear(): void;
    /**
     * Maintains an internal counter specific to `label` and outputs to `stdout` the number of times `console.count()` has been called with the given `label`.
     */
    count(label?: string): void;
    /**
     * Resets the internal counter specific to `label`.
     */
    countReset(label?: string): void;
    /**
     * The `console.debug()` function is an alias for {@link console.log()}.
     */
    debug(message?: any, ...optionalParams: any[]): void;
    /**
     * Uses {@link util.inspect()} on `obj` and prints the resulting string to `stdout`.
     * This function bypasses any custom `inspect()` function defined on `obj`.
     */
    dir(obj: any, options?: NodeJS.InspectOptions): void;
    /**
     * This method calls {@link console.log()} passing it the arguments received. Please note that this method does not produce any XML formatting
     */
    dirxml(...data: any[]): void;
    /**
     * Prints to `stderr` with newline.
     */
    error(message?: any, ...optionalParams: any[]): void;
    /**
     * Increases indentation of subsequent lines by two spaces.
     * If one or more `label`s are provided, those are printed first without the additional indentation.
     */
    group(...label: any[]): void;
    /**
     * The `console.groupCollapsed()` function is an alias for {@link console.group()}.
     */
    groupCollapsed(): void;
    /**
     * Decreases indentation of subsequent lines by two spaces.
     */
    groupEnd(): void;
    /**
     * The {@link console.info()} function is an alias for {@link console.log()}.
     */
    info(message?: any, ...optionalParams: any[]): void;
    /**
     * Prints to `stdout` with newline.
     */
    log(message?: any, ...optionalParams: any[]): void;
    /**
     * This method does not display anything unless used in the inspector.
     *  Prints to `stdout` the array `array` formatted as a table.
     */
    table(tabularData: any, properties?: string[]): void;
    /**
     * Starts a timer that can be used to compute the duration of an operation. Timers are identified by a unique `label`.
     */
    time(label?: string): void;
    /**
     * Stops a timer that was previously started by calling {@link console.time()} and prints the result to `stdout`.
     */
    timeEnd(label?: string): void;
    /**
     * For a timer that was previously started by calling {@link console.time()}, prints the elapsed time and other `data` arguments to `stdout`.
     */
    timeLog(label: string, ...data: any[]): void;
    /**
     * Prints to `stderr` the string 'Trace :', followed by the {@link util.format()} formatted message and stack trace to the current position in the code.
     */
    trace(message?: any, ...optionalParams: any[]): void;
    /**
     * The {@link console.warn()} function is an alias for {@link console.error()}.
     */
    warn(message?: any, ...optionalParams: any[]): void;

    // --- Inspector mode only ---
    /**
     * This method does not display anything unless used in the inspector.
     *  Starts a JavaScript CPU profile with an optional label.
     */
    profile(label?: string): void;
    /**
     * This method does not display anything unless used in the inspector.
     *  Stops the current JavaScript CPU profiling session if one has been started and prints the report to the Profiles panel of the inspector.
     */
    profileEnd(): void;
    /**
     * This method does not display anything unless used in the inspector.
     *  Adds an event with the label `label` to the Timeline panel of the inspector.
     */
    timeStamp(label?: string): void;
}

interface Error {
    stack?: string;
}

// Declare "static" methods in Error
interface ErrorConstructor {
    /** Create .stack property on a target object */
    captureStackTrace(targetObject: Object, constructorOpt?: Function): void;

    /**
     * Optional override for formatting stack traces
     *
     * @see https://github.com/v8/v8/wiki/Stack%20Trace%20API#customizing-stack-traces
     */
    prepareStackTrace?: (err: Error, stackTraces: NodeJS.CallSite[]) => any;

    stackTraceLimit: number;
}

// compat for TypeScript 1.8 and default es5 target
// if you use with --target es3 or --target es5 and use below definitions,
// use the lib.es6.d.ts that is bundled with TypeScript 1.8.
interface MapConstructor { }
interface WeakMapConstructor { }
interface SetConstructor { }
interface WeakSetConstructor { }

interface Set<T> {}
interface ReadonlySet<T> {}

// Forward-declare needed types from lib.es2015.d.ts (in case users are using `--lib es5`)
interface Iterable<T> { }
interface Iterator<T> {
    next(value?: any): IteratorResult<T>;
}
interface IteratorResult<T> { }
interface AsyncIterableIterator<T> {}
interface SymbolConstructor {
    readonly observable: symbol;
    readonly iterator: symbol;
    readonly asyncIterator: symbol;
}
declare var Symbol: SymbolConstructor;
interface SharedArrayBuffer {
    readonly byteLength: number;
    slice(begin?: number, end?: number): SharedArrayBuffer;
}

// Node.js ESNEXT support
interface String {
    /** Removes whitespace from the left end of a string. */
    trimLeft(): string;
    /** Removes whitespace from the right end of a string. */
    trimRight(): string;
}

/*-----------------------------------------------*
 *                                               *
 *                   GLOBAL                      *
 *                                               *
 ------------------------------------------------*/
declare var process: NodeJS.Process;
declare var global: NodeJS.Global;
declare var console: Console;

declare var __filename: string;
declare var __dirname: string;

declare function setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout;
declare namespace setTimeout {
    function __promisify__(ms: number): Promise<void>;
    function __promisify__<T>(ms: number, value: T): Promise<T>;
}
declare function clearTimeout(timeoutId: NodeJS.Timeout): void;
declare function setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout;
declare function clearInterval(intervalId: NodeJS.Timeout): void;
declare function setImmediate(callback: (...args: any[]) => void, ...args: any[]): NodeJS.Immediate;
declare namespace setImmediate {
    function __promisify__(): Promise<void>;
    function __promisify__<T>(value: T): Promise<T>;
}
declare function clearImmediate(immediateId: NodeJS.Immediate): void;

// TODO: change to `type NodeRequireFunction = (id: string) => any;` in next mayor version.
interface NodeRequireFunction {
    /* tslint:disable-next-line:callable-types */
    (id: string): any;
}

interface NodeRequire extends NodeRequireFunction {
    resolve: RequireResolve;
    cache: any;
    extensions: NodeExtensions;
    main: NodeModule | undefined;
}

interface RequireResolve {
    (id: string, options?: { paths?: string[]; }): string;
    paths(request: string): string[] | null;
}

interface NodeExtensions {
    '.js': (m: NodeModule, filename: string) => any;
    '.json': (m: NodeModule, filename: string) => any;
    '.node': (m: NodeModule, filename: string) => any;
    [ext: string]: (m: NodeModule, filename: string) => any;
}

declare var require: NodeRequire;

interface NodeModule {
    exports: any;
    require: NodeRequireFunction;
    id: string;
    filename: string;
    loaded: boolean;
    parent: NodeModule | null;
    children: NodeModule[];
    paths: string[];
}

declare var module: NodeModule;

// Same as module.exports
declare var exports: any;
declare const SlowBuffer: {
    new(str: string, encoding?: string): Buffer;
    new(size: number): Buffer;
    new(size: Uint8Array): Buffer;
    new(array: any[]): Buffer;
    prototype: Buffer;
    isBuffer(obj: any): boolean;
    byteLength(string: string, encoding?: string): number;
    concat(list: Buffer[], totalLength?: number): Buffer;
};

// Buffer class
type BufferEncoding = "ascii" | "utf8" | "utf16le" | "ucs2" | "base64" | "latin1" | "binary" | "hex";
interface Buffer extends Uint8Array {
    constructor: typeof Buffer;
    write(string: string, offset?: number, length?: number, encoding?: string): number;
    toString(encoding?: string, start?: number, end?: number): string;
    toJSON(): { type: 'Buffer', data: any[] };
    equals(otherBuffer: Uint8Array): boolean;
    compare(otherBuffer: Uint8Array, targetStart?: number, targetEnd?: number, sourceStart?: number, sourceEnd?: number): number;
    copy(targetBuffer: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
    slice(start?: number, end?: number): Buffer;
    writeUIntLE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    writeUIntBE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    writeIntLE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    writeIntBE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    readUIntLE(offset: number, byteLength: number, noAssert?: boolean): number;
    readUIntBE(offset: number, byteLength: number, noAssert?: boolean): number;
    readIntLE(offset: number, byteLength: number, noAssert?: boolean): number;
    readIntBE(offset: number, byteLength: number, noAssert?: boolean): number;
    readUInt8(offset: number, noAssert?: boolean): number;
    readUInt16LE(offset: number, noAssert?: boolean): number;
    readUInt16BE(offset: number, noAssert?: boolean): number;
    readUInt32LE(offset: number, noAssert?: boolean): number;
    readUInt32BE(offset: number, noAssert?: boolean): number;
    readInt8(offset: number, noAssert?: boolean): number;
    readInt16LE(offset: number, noAssert?: boolean): number;
    readInt16BE(offset: number, noAssert?: boolean): number;
    readInt32LE(offset: number, noAssert?: boolean): number;
    readInt32BE(offset: number, noAssert?: boolean): number;
    readFloatLE(offset: number, noAssert?: boolean): number;
    readFloatBE(offset: number, noAssert?: boolean): number;
    readDoubleLE(offset: number, noAssert?: boolean): number;
    readDoubleBE(offset: number, noAssert?: boolean): number;
    swap16(): Buffer;
    swap32(): Buffer;
    swap64(): Buffer;
    writeUInt8(value: number, offset: number, noAssert?: boolean): number;
    writeUInt16LE(value: number, offset: number, noAssert?: boolean): number;
    writeUInt16BE(value: number, offset: number, noAssert?: boolean): number;
    writeUInt32LE(value: number, offset: number, noAssert?: boolean): number;
    writeUInt32BE(value: number, offset: number, noAssert?: boolean): number;
    writeInt8(value: number, offset: number, noAssert?: boolean): number;
    writeInt16LE(value: number, offset: number, noAssert?: boolean): number;
    writeInt16BE(value: number, offset: number, noAssert?: boolean): number;
    writeInt32LE(value: number, offset: number, noAssert?: boolean): number;
    writeInt32BE(value: number, offset: number, noAssert?: boolean): number;
    writeFloatLE(value: number, offset: number, noAssert?: boolean): number;
    writeFloatBE(value: number, offset: number, noAssert?: boolean): number;
    writeDoubleLE(value: number, offset: number, noAssert?: boolean): number;
    writeDoubleBE(value: number, offset: number, noAssert?: boolean): number;
    fill(value: any, offset?: number, end?: number): this;
    indexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: string): number;
    lastIndexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: string): number;
    entries(): IterableIterator<[number, number]>;
    includes(value: string | number | Buffer, byteOffset?: number, encoding?: string): boolean;
    keys(): IterableIterator<number>;
    values(): IterableIterator<number>;
}

/**
 * Raw data is stored in instances of the Buffer class.
 * A Buffer is similar to an array of integers but corresponds to a raw memory allocation outside the V8 heap.  A Buffer cannot be resized.
 * Valid string encodings: 'ascii'|'utf8'|'utf16le'|'ucs2'(alias of 'utf16le')|'base64'|'binary'(deprecated)|'hex'
 */
declare const Buffer: {
    /**
     * Allocates a new buffer containing the given {str}.
     *
     * @param str String to store in buffer.
     * @param encoding encoding to use, optional.  Default is 'utf8'
     * @deprecated since v10.0.0 - Use `Buffer.from(string[, encoding])` instead.
     */
    new(str: string, encoding?: string): Buffer;
    /**
     * Allocates a new buffer of {size} octets.
     *
     * @param size count of octets to allocate.
     * @deprecated since v10.0.0 - Use `Buffer.alloc()` instead (also see `Buffer.allocUnsafe()`).
     */
    new(size: number): Buffer;
    /**
     * Allocates a new buffer containing the given {array} of octets.
     *
     * @param array The octets to store.
     * @deprecated since v10.0.0 - Use `Buffer.from(array)` instead.
     */
    new(array: Uint8Array): Buffer;
    /**
     * Produces a Buffer backed by the same allocated memory as
     * the given {ArrayBuffer}/{SharedArrayBuffer}.
     *
     *
     * @param arrayBuffer The ArrayBuffer with which to share memory.
     * @deprecated since v10.0.0 - Use `Buffer.from(arrayBuffer[, byteOffset[, length]])` instead.
     */
    new(arrayBuffer: ArrayBuffer | SharedArrayBuffer): Buffer;
    /**
     * Allocates a new buffer containing the given {array} of octets.
     *
     * @param array The octets to store.
     * @deprecated since v10.0.0 - Use `Buffer.from(array)` instead.
     */
    new(array: any[]): Buffer;
    /**
     * Copies the passed {buffer} data onto a new {Buffer} instance.
     *
     * @param buffer The buffer to copy.
     * @deprecated since v10.0.0 - Use `Buffer.from(buffer)` instead.
     */
    new(buffer: Buffer): Buffer;
    prototype: Buffer;
    /**
     * When passed a reference to the .buffer property of a TypedArray instance,
     * the newly created Buffer will share the same allocated memory as the TypedArray.
     * The optional {byteOffset} and {length} arguments specify a memory range
     * within the {arrayBuffer} that will be shared by the Buffer.
     *
     * @param arrayBuffer The .buffer property of any TypedArray or a new ArrayBuffer()
     */
    from(arrayBuffer: ArrayBuffer | SharedArrayBuffer, byteOffset?: number, length?: number): Buffer;
    /**
     * Creates a new Buffer using the passed {data}
     * @param data data to create a new Buffer
     */
    from(data: any[]): Buffer;
    from(data: Uint8Array): Buffer;
    /**
     * Creates a new Buffer containing the given JavaScript string {str}.
     * If provided, the {encoding} parameter identifies the character encoding.
     * If not provided, {encoding} defaults to 'utf8'.
     */
    from(str: string, encoding?: string): Buffer;
    /**
     * Creates a new Buffer using the passed {data}
     * @param values to create a new Buffer
     */
    of(...items: number[]): Buffer;
    /**
     * Returns true if {obj} is a Buffer
     *
     * @param obj object to test.
     */
    isBuffer(obj: any): obj is Buffer;
    /**
     * Returns true if {encoding} is a valid encoding argument.
     * Valid string encodings in Node 0.12: 'ascii'|'utf8'|'utf16le'|'ucs2'(alias of 'utf16le')|'base64'|'binary'(deprecated)|'hex'
     *
     * @param encoding string to test.
     */
    isEncoding(encoding: string): boolean | undefined;
    /**
     * Gives the actual byte length of a string. encoding defaults to 'utf8'.
     * This is not the same as String.prototype.length since that returns the number of characters in a string.
     *
     * @param string string to test.
     * @param encoding encoding used to evaluate (defaults to 'utf8')
     */
    byteLength(string: string | NodeJS.TypedArray | DataView | ArrayBuffer | SharedArrayBuffer, encoding?: string): number;
    /**
     * Returns a buffer which is the result of concatenating all the buffers in the list together.
     *
     * If the list has no items, or if the totalLength is 0, then it returns a zero-length buffer.
     * If the list has exactly one item, then the first item of the list is returned.
     * If the list has more than one item, then a new Buffer is created.
     *
     * @param list An array of Buffer objects to concatenate
     * @param totalLength Total length of the buffers when concatenated.
     *   If totalLength is not provided, it is read from the buffers in the list. However, this adds an additional loop to the function, so it is faster to provide the length explicitly.
     */
    concat(list: Uint8Array[], totalLength?: number): Buffer;
    /**
     * The same as buf1.compare(buf2).
     */
    compare(buf1: Uint8Array, buf2: Uint8Array): number;
    /**
     * Allocates a new buffer of {size} octets.
     *
     * @param size count of octets to allocate.
     * @param fill if specified, buffer will be initialized by calling buf.fill(fill).
     *    If parameter is omitted, buffer will be filled with zeros.
     * @param encoding encoding used for call to buf.fill while initalizing
     */
    alloc(size: number, fill?: string | Buffer | number, encoding?: string): Buffer;
    /**
     * Allocates a new buffer of {size} octets, leaving memory not initialized, so the contents
     * of the newly created Buffer are unknown and may contain sensitive data.
     *
     * @param size count of octets to allocate
     */
    allocUnsafe(size: number): Buffer;
    /**
     * Allocates a new non-pooled buffer of {size} octets, leaving memory not initialized, so the contents
     * of the newly created Buffer are unknown and may contain sensitive data.
     *
     * @param size count of octets to allocate
     */
    allocUnsafeSlow(size: number): Buffer;
    /**
     * This is the number of bytes used to determine the size of pre-allocated, internal Buffer instances used for pooling. This value may be modified.
     */
    poolSize: number;
};

/*----------------------------------------------*
*                                               *
*               GLOBAL INTERFACES               *
*                                               *
*-----------------------------------------------*/
declare namespace NodeJS {
    interface InspectOptions {
        showHidden?: boolean;
        depth?: number | null;
        colors?: boolean;
        customInspect?: boolean;
        showProxy?: boolean;
        maxArrayLength?: number | null;
        breakLength?: number;
        compact?: boolean;
        sorted?: boolean | ((a: string, b: string) => number);
    }

    interface ConsoleConstructorOptions {
        stdout: WritableStream;
        stderr?: WritableStream;
        ignoreErrors?: boolean;
        colorMode?: boolean | 'auto';
    }

    interface ConsoleConstructor {
        prototype: Console;
        new(stdout: WritableStream, stderr?: WritableStream, ignoreErrors?: boolean): Console;
        new(options: ConsoleConstructorOptions): Console;
    }

    interface CallSite {
        /**
         * Value of "this"
         */
        getThis(): any;

        /**
         * Type of "this" as a string.
         * This is the name of the function stored in the constructor field of
         * "this", if available.  Otherwise the object's [[Class]] internal
         * property.
         */
        getTypeName(): string | null;

        /**
         * Current function
         */
        getFunction(): Function | undefined;

        /**
         * Name of the current function, typically its name property.
         * If a name property is not available an attempt will be made to try
         * to infer a name from the function's context.
         */
        getFunctionName(): string | null;

        /**
         * Name of the property [of "this" or one of its prototypes] that holds
         * the current function
         */
        getMethodName(): string | null;

        /**
         * Name of the script [if this function was defined in a script]
         */
        getFileName(): string | null;

        /**
         * Current line number [if this function was defined in a script]
         */
        getLineNumber(): number | null;

        /**
         * Current column number [if this function was defined in a script]
         */
        getColumnNumber(): number | null;

        /**
         * A call site object representing the location where eval was called
         * [if this function was created using a call to eval]
         */
        getEvalOrigin(): string | undefined;

        /**
         * Is this a toplevel invocation, that is, is "this" the global object?
         */
        isToplevel(): boolean;

        /**
         * Does this call take place in code defined by a call to eval?
         */
        isEval(): boolean;

        /**
         * Is this call in native V8 code?
         */
        isNative(): boolean;

        /**
         * Is this a constructor call?
         */
        isConstructor(): boolean;
    }

    interface ErrnoException extends Error {
        errno?: number;
        code?: string;
        path?: string;
        syscall?: string;
        stack?: string;
    }

    class EventEmitter {
        addListener(event: string | symbol, listener: (...args: any[]) => void): this;
        on(event: string | symbol, listener: (...args: any[]) => void): this;
        once(event: string | symbol, listener: (...args: any[]) => void): this;
        removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
        off(event: string | symbol, listener: (...args: any[]) => void): this;
        removeAllListeners(event?: string | symbol): this;
        setMaxListeners(n: number): this;
        getMaxListeners(): number;
        listeners(event: string | symbol): Function[];
        rawListeners(event: string | symbol): Function[];
        emit(event: string | symbol, ...args: any[]): boolean;
        listenerCount(type: string | symbol): number;
        // Added in Node 6...
        prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
        prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
        eventNames(): Array<string | symbol>;
    }

    interface ReadableStream extends EventEmitter {
        readable: boolean;
        read(size?: number): string | Buffer;
        setEncoding(encoding: string): this;
        pause(): this;
        resume(): this;
        isPaused(): boolean;
        pipe<T extends WritableStream>(destination: T, options?: { end?: boolean; }): T;
        unpipe(destination?: WritableStream): this;
        unshift(chunk: string): void;
        unshift(chunk: Buffer): void;
        wrap(oldStream: ReadableStream): this;
        [Symbol.asyncIterator](): AsyncIterableIterator<string | Buffer>;
    }

    interface WritableStream extends EventEmitter {
        writable: boolean;
        write(buffer: Buffer | string, cb?: Function): boolean;
        write(str: string, encoding?: string, cb?: Function): boolean;
        end(cb?: Function): void;
        end(buffer: Buffer, cb?: Function): void;
        end(str: string, cb?: Function): void;
        end(str: string, encoding?: string, cb?: Function): void;
    }

    interface ReadWriteStream extends ReadableStream, WritableStream { }

    interface Events extends EventEmitter { }

    interface Domain extends Events {
        run(fn: Function): void;
        add(emitter: Events): void;
        remove(emitter: Events): void;
        bind(cb: (err: Error, data: any) => any): any;
        intercept(cb: (data: any) => any): any;

        addListener(event: string, listener: (...args: any[]) => void): this;
        on(event: string, listener: (...args: any[]) => void): this;
        once(event: string, listener: (...args: any[]) => void): this;
        removeListener(event: string, listener: (...args: any[]) => void): this;
        removeAllListeners(event?: string): this;
    }

    interface MemoryUsage {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
    }

    interface CpuUsage {
        user: number;
        system: number;
    }

    interface ProcessRelease {
        name: string;
        sourceUrl?: string;
        headersUrl?: string;
        libUrl?: string;
        lts?: string;
    }

    interface ProcessVersions {
        http_parser: string;
        node: string;
        v8: string;
        ares: string;
        uv: string;
        zlib: string;
        modules: string;
        openssl: string;
    }

    type Platform = 'aix'
        | 'android'
        | 'darwin'
        | 'freebsd'
        | 'linux'
        | 'openbsd'
        | 'sunos'
        | 'win32'
        | 'cygwin';

    type Signals =
        "SIGABRT" | "SIGALRM" | "SIGBUS" | "SIGCHLD" | "SIGCONT" | "SIGFPE" | "SIGHUP" | "SIGILL" | "SIGINT" | "SIGIO" |
        "SIGIOT" | "SIGKILL" | "SIGPIPE" | "SIGPOLL" | "SIGPROF" | "SIGPWR" | "SIGQUIT" | "SIGSEGV" | "SIGSTKFLT" |
        "SIGSTOP" | "SIGSYS" | "SIGTERM" | "SIGTRAP" | "SIGTSTP" | "SIGTTIN" | "SIGTTOU" | "SIGUNUSED" | "SIGURG" |
        "SIGUSR1" | "SIGUSR2" | "SIGVTALRM" | "SIGWINCH" | "SIGXCPU" | "SIGXFSZ" | "SIGBREAK" | "SIGLOST" | "SIGINFO";

    type MultipleResolveType = 'resolve' | 'reject';

    type BeforeExitListener = (code: number) => void;
    type DisconnectListener = () => void;
    type ExitListener = (code: number) => void;
    type RejectionHandledListener = (promise: Promise<any>) => void;
    type UncaughtExceptionListener = (error: Error) => void;
    type UnhandledRejectionListener = (reason: any, promise: Promise<any>) => void;
    type WarningListener = (warning: Error) => void;
    type MessageListener = (message: any, sendHandle: any) => void;
    type SignalsListener = (signal: Signals) => void;
    type NewListenerListener = (type: string | symbol, listener: (...args: any[]) => void) => void;
    type RemoveListenerListener = (type: string | symbol, listener: (...args: any[]) => void) => void;
    type MultipleResolveListener = (type: MultipleResolveType, promise: Promise<any>, value: any) => void;

    interface Socket extends ReadWriteStream {
        isTTY?: true;
    }

    interface ProcessEnv {
        [key: string]: string | undefined;
    }

    interface WriteStream extends Socket {
        readonly writableHighWaterMark: number;
        readonly writableLength: number;
        columns?: number;
        rows?: number;
        _write(chunk: any, encoding: string, callback: Function): void;
        _destroy(err: Error | null, callback: Function): void;
        _final(callback: Function): void;
        setDefaultEncoding(encoding: string): this;
        cork(): void;
        uncork(): void;
        destroy(error?: Error): void;
    }
    interface ReadStream extends Socket {
        readonly readableHighWaterMark: number;
        readonly readableLength: number;
        isRaw?: boolean;
        setRawMode?(mode: boolean): void;
        _read(size: number): void;
        _destroy(err: Error | null, callback: Function): void;
        push(chunk: any, encoding?: string): boolean;
        destroy(error?: Error): void;
    }

    interface Process extends EventEmitter {
        stdout: WriteStream;
        stderr: WriteStream;
        stdin: ReadStream;
        openStdin(): Socket;
        argv: string[];
        argv0: string;
        execArgv: string[];
        execPath: string;
        abort(): void;
        chdir(directory: string): void;
        cwd(): string;
        debugPort: number;
        emitWarning(warning: string | Error, name?: string, ctor?: Function): void;
        env: ProcessEnv;
        exit(code?: number): never;
        exitCode: number;
        getgid(): number;
        setgid(id: number | string): void;
        getuid(): number;
        setuid(id: number | string): void;
        geteuid(): number;
        seteuid(id: number | string): void;
        getegid(): number;
        setegid(id: number | string): void;
        getgroups(): number[];
        setgroups(groups: Array<string | number>): void;
        setUncaughtExceptionCaptureCallback(cb: ((err: Error) => void) | null): void;
        hasUncaughtExceptionCaptureCallback(): boolean;
        version: string;
        versions: ProcessVersions;
        config: {
            target_defaults: {
                cflags: any[];
                default_configuration: string;
                defines: string[];
                include_dirs: string[];
                libraries: string[];
            };
            variables: {
                clang: number;
                host_arch: string;
                node_install_npm: boolean;
                node_install_waf: boolean;
                node_prefix: string;
                node_shared_openssl: boolean;
                node_shared_v8: boolean;
                node_shared_zlib: boolean;
                node_use_dtrace: boolean;
                node_use_etw: boolean;
                node_use_openssl: boolean;
                target_arch: string;
                v8_no_strict_aliasing: number;
                v8_use_snapshot: boolean;
                visibility: string;
            };
        };
        kill(pid: number, signal?: string | number): void;
        pid: number;
        ppid: number;
        title: string;
        arch: string;
        platform: Platform;
        mainModule?: NodeModule;
        memoryUsage(): MemoryUsage;
        cpuUsage(previousValue?: CpuUsage): CpuUsage;
        nextTick(callback: Function, ...args: any[]): void;
        release: ProcessRelease;
        umask(mask?: number): number;
        uptime(): number;
        hrtime(time?: [number, number]): [number, number];
        domain: Domain;

        // Worker
        send?(message: any, sendHandle?: any): void;
        disconnect(): void;
        connected: boolean;

        /**
         * The `process.allowedNodeEnvironmentFlags` property is a special,
         * read-only `Set` of flags allowable within the [`NODE_OPTIONS`][]
         * environment variable.
         */
        allowedNodeEnvironmentFlags: ReadonlySet<string>;

        /**
         * EventEmitter
         *   1. beforeExit
         *   2. disconnect
         *   3. exit
         *   4. message
         *   5. rejectionHandled
         *   6. uncaughtException
         *   7. unhandledRejection
         *   8. warning
         *   9. message
         *  10. <All OS Signals>
         *  11. newListener/removeListener inherited from EventEmitter
         */
        addListener(event: "beforeExit", listener: BeforeExitListener): this;
        addListener(event: "disconnect", listener: DisconnectListener): this;
        addListener(event: "exit", listener: ExitListener): this;
        addListener(event: "rejectionHandled", listener: RejectionHandledListener): this;
        addListener(event: "uncaughtException", listener: UncaughtExceptionListener): this;
        addListener(event: "unhandledRejection", listener: UnhandledRejectionListener): this;
        addListener(event: "warning", listener: WarningListener): this;
        addListener(event: "message", listener: MessageListener): this;
        addListener(event: Signals, listener: SignalsListener): this;
        addListener(event: "newListener", listener: NewListenerListener): this;
        addListener(event: "removeListener", listener: RemoveListenerListener): this;
        addListener(event: "multipleResolves", listener: MultipleResolveListener): this;

        emit(event: "beforeExit", code: number): boolean;
        emit(event: "disconnect"): boolean;
        emit(event: "exit", code: number): boolean;
        emit(event: "rejectionHandled", promise: Promise<any>): boolean;
        emit(event: "uncaughtException", error: Error): boolean;
        emit(event: "unhandledRejection", reason: any, promise: Promise<any>): boolean;
        emit(event: "warning", warning: Error): boolean;
        emit(event: "message", message: any, sendHandle: any): this;
        emit(event: Signals, signal: Signals): boolean;
        emit(event: "newListener", eventName: string | symbol, listener: (...args: any[]) => void): this;
        emit(event: "removeListener", eventName: string, listener: (...args: any[]) => void): this;
        emit(event: "multipleResolves", listener: MultipleResolveListener): this;

        on(event: "beforeExit", listener: BeforeExitListener): this;
        on(event: "disconnect", listener: DisconnectListener): this;
        on(event: "exit", listener: ExitListener): this;
        on(event: "rejectionHandled", listener: RejectionHandledListener): this;
        on(event: "uncaughtException", listener: UncaughtExceptionListener): this;
        on(event: "unhandledRejection", listener: UnhandledRejectionListener): this;
        on(event: "warning", listener: WarningListener): this;
        on(event: "message", listener: MessageListener): this;
        on(event: Signals, listener: SignalsListener): this;
        on(event: "newListener", listener: NewListenerListener): this;
        on(event: "removeListener", listener: RemoveListenerListener): this;
        on(event: "multipleResolves", listener: MultipleResolveListener): this;

        once(event: "beforeExit", listener: BeforeExitListener): this;
        once(event: "disconnect", listener: DisconnectListener): this;
        once(event: "exit", listener: ExitListener): this;
        once(event: "rejectionHandled", listener: RejectionHandledListener): this;
        once(event: "uncaughtException", listener: UncaughtExceptionListener): this;
        once(event: "unhandledRejection", listener: UnhandledRejectionListener): this;
        once(event: "warning", listener: WarningListener): this;
        once(event: "message", listener: MessageListener): this;
        once(event: Signals, listener: SignalsListener): this;
        once(event: "newListener", listener: NewListenerListener): this;
        once(event: "removeListener", listener: RemoveListenerListener): this;
        once(event: "multipleResolves", listener: MultipleResolveListener): this;

        prependListener(event: "beforeExit", listener: BeforeExitListener): this;
        prependListener(event: "disconnect", listener: DisconnectListener): this;
        prependListener(event: "exit", listener: ExitListener): this;
        prependListener(event: "rejectionHandled", listener: RejectionHandledListener): this;
        prependListener(event: "uncaughtException", listener: UncaughtExceptionListener): this;
        prependListener(event: "unhandledRejection", listener: UnhandledRejectionListener): this;
        prependListener(event: "warning", listener: WarningListener): this;
        prependListener(event: "message", listener: MessageListener): this;
        prependListener(event: Signals, listener: SignalsListener): this;
        prependListener(event: "newListener", listener: NewListenerListener): this;
        prependListener(event: "removeListener", listener: RemoveListenerListener): this;
        prependListener(event: "multipleResolves", listener: MultipleResolveListener): this;

        prependOnceListener(event: "beforeExit", listener: BeforeExitListener): this;
        prependOnceListener(event: "disconnect", listener: DisconnectListener): this;
        prependOnceListener(event: "exit", listener: ExitListener): this;
        prependOnceListener(event: "rejectionHandled", listener: RejectionHandledListener): this;
        prependOnceListener(event: "uncaughtException", listener: UncaughtExceptionListener): this;
        prependOnceListener(event: "unhandledRejection", listener: UnhandledRejectionListener): this;
        prependOnceListener(event: "warning", listener: WarningListener): this;
        prependOnceListener(event: "message", listener: MessageListener): this;
        prependOnceListener(event: Signals, listener: SignalsListener): this;
        prependOnceListener(event: "newListener", listener: NewListenerListener): this;
        prependOnceListener(event: "removeListener", listener: RemoveListenerListener): this;
        prependOnceListener(event: "multipleResolves", listener: MultipleResolveListener): this;

        listeners(event: "beforeExit"): BeforeExitListener[];
        listeners(event: "disconnect"): DisconnectListener[];
        listeners(event: "exit"): ExitListener[];
        listeners(event: "rejectionHandled"): RejectionHandledListener[];
        listeners(event: "uncaughtException"): UncaughtExceptionListener[];
        listeners(event: "unhandledRejection"): UnhandledRejectionListener[];
        listeners(event: "warning"): WarningListener[];
        listeners(event: "message"): MessageListener[];
        listeners(event: Signals): SignalsListener[];
        listeners(event: "newListener"): NewListenerListener[];
        listeners(event: "removeListener"): RemoveListenerListener[];
        listeners(event: "multipleResolves"): MultipleResolveListener[];
    }

    interface Global {
        Array: typeof Array;
        ArrayBuffer: typeof ArrayBuffer;
        Boolean: typeof Boolean;
        Buffer: typeof Buffer;
        DataView: typeof DataView;
        Date: typeof Date;
        Error: typeof Error;
        EvalError: typeof EvalError;
        Float32Array: typeof Float32Array;
        Float64Array: typeof Float64Array;
        Function: typeof Function;
        GLOBAL: Global;
        Infinity: typeof Infinity;
        Int16Array: typeof Int16Array;
        Int32Array: typeof Int32Array;
        Int8Array: typeof Int8Array;
        Intl: typeof Intl;
        JSON: typeof JSON;
        Map: MapConstructor;
        Math: typeof Math;
        NaN: typeof NaN;
        Number: typeof Number;
        Object: typeof Object;
        Promise: Function;
        RangeError: typeof RangeError;
        ReferenceError: typeof ReferenceError;
        RegExp: typeof RegExp;
        Set: SetConstructor;
        String: typeof String;
        Symbol: Function;
        SyntaxError: typeof SyntaxError;
        TypeError: typeof TypeError;
        URIError: typeof URIError;
        Uint16Array: typeof Uint16Array;
        Uint32Array: typeof Uint32Array;
        Uint8Array: typeof Uint8Array;
        Uint8ClampedArray: Function;
        WeakMap: WeakMapConstructor;
        WeakSet: WeakSetConstructor;
        clearImmediate: (immediateId: Immediate) => void;
        clearInterval: (intervalId: Timeout) => void;
        clearTimeout: (timeoutId: Timeout) => void;
        console: typeof console;
        decodeURI: typeof decodeURI;
        decodeURIComponent: typeof decodeURIComponent;
        encodeURI: typeof encodeURI;
        encodeURIComponent: typeof encodeURIComponent;
        escape: (str: string) => string;
        eval: typeof eval;
        global: Global;
        isFinite: typeof isFinite;
        isNaN: typeof isNaN;
        parseFloat: typeof parseFloat;
        parseInt: typeof parseInt;
        process: Process;
        root: Global;
        setImmediate: (callback: (...args: any[]) => void, ...args: any[]) => Immediate;
        setInterval: (callback: (...args: any[]) => void, ms: number, ...args: any[]) => Timeout;
        setTimeout: (callback: (...args: any[]) => void, ms: number, ...args: any[]) => Timeout;
        undefined: typeof undefined;
        unescape: (str: string) => string;
        gc: () => void;
        v8debug?: any;
    }

    interface Timer {
        ref(): void;
        refresh(): void;
        unref(): void;
    }

    class Immediate {
        ref(): void;
        unref(): void;
        _onImmediate: Function; // to distinguish it from the Timeout class
    }

    class Timeout implements Timer {
        ref(): void;
        refresh(): void;
        unref(): void;
    }

    class Module {
        static runMain(): void;
        static wrap(code: string): string;
        static createRequireFromPath(path: string): (path: string) => any;
        static builtinModules: string[];

        static Module: typeof Module;

        exports: any;
        require: NodeRequireFunction;
        id: string;
        filename: string;
        loaded: boolean;
        parent: Module | null;
        children: Module[];
        paths: string[];

        constructor(id: string, parent?: Module);
    }

    type TypedArray = Uint8Array | Uint8ClampedArray | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;
}

interface IterableIterator<T> { }

/*----------------------------------------------*
*                                               *
*                   MODULES                     *
*                                               *
*-----------------------------------------------*/
declare module "buffer" {
    export const INSPECT_MAX_BYTES: number;
    const BuffType: typeof Buffer;
    const SlowBuffType: typeof SlowBuffer;
    export { BuffType as Buffer, SlowBuffType as SlowBuffer };
}

declare module "querystring" {
    interface StringifyOptions {
        encodeURIComponent?: Function;
    }

    interface ParseOptions {
        maxKeys?: number;
        decodeURIComponent?: Function;
    }

    interface ParsedUrlQuery { [key: string]: string | string[]; }

    function stringify(obj?: {}, sep?: string, eq?: string, options?: StringifyOptions): string;
    function parse(str: string, sep?: string, eq?: string, options?: ParseOptions): ParsedUrlQuery;
    function escape(str: string): string;
    function unescape(str: string): string;
}

declare module "events" {
    class internal extends NodeJS.EventEmitter { }

    namespace internal {
         class EventEmitter extends internal {
            /** @deprecated since v4.0.0 */
            static listenerCount(emitter: EventEmitter, event: string | symbol): number;
            static defaultMaxListeners: number;

            addListener(event: string | symbol, listener: (...args: any[]) => void): this;
            on(event: string | symbol, listener: (...args: any[]) => void): this;
            once(event: string | symbol, listener: (...args: any[]) => void): this;
            prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
            prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
            removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
            off(event: string | symbol, listener: (...args: any[]) => void): this;
            removeAllListeners(event?: string | symbol): this;
            setMaxListeners(n: number): this;
            getMaxListeners(): number;
            listeners(event: string | symbol): Function[];
            rawListeners(event: string | symbol): Function[];
            emit(event: string | symbol, ...args: any[]): boolean;
            eventNames(): Array<string | symbol>;
            listenerCount(type: string | symbol): number;
        }
    }

    export = internal;
}

declare module "http" {
    import * as events from "events";
    import * as net from "net";
    import * as stream from "stream";
    import { URL } from "url";

    // incoming headers will never contain number
    interface IncomingHttpHeaders {
        'accept'?: string;
        'access-control-allow-origin'?: string;
        'access-control-allow-credentials'?: string;
        'access-control-expose-headers'?: string;
        'access-control-max-age'?: string;
        'access-control-allow-methods'?: string;
        'access-control-allow-headers'?: string;
        'accept-patch'?: string;
        'accept-ranges'?: string;
        'age'?: string;
        'allow'?: string;
        'alt-svc'?: string;
        'authorization'?: string;
        'cache-control'?: string;
        'connection'?: string;
        'content-disposition'?: string;
        'content-encoding'?: string;
        'content-language'?: string;
        'content-length'?: string;
        'content-location'?: string;
        'content-range'?: string;
        'content-type'?: string;
        'cookie'?: string;
        'date'?: string;
        'expect'?: string;
        'expires'?: string;
        'forwarded'?: string;
        'from'?: string;
        'host'?: string;
        'if-match'?: string;
        'if-modified-since'?: string;
        'if-none-match'?: string;
        'if-unmodified-since'?: string;
        'last-modified'?: string;
        'location'?: string;
        'pragma'?: string;
        'proxy-authenticate'?: string;
        'proxy-authorization'?: string;
        'public-key-pins'?: string;
        'range'?: string;
        'referer'?: string;
        'retry-after'?: string;
        'set-cookie'?: string[];
        'strict-transport-security'?: string;
        'trailer'?: string;
        'transfer-encoding'?: string;
        'tk'?: string;
        'upgrade'?: string;
        'user-agent'?: string;
        'vary'?: string;
        'via'?: string;
        'warning'?: string;
        'www-authenticate'?: string;
        [header: string]: string | string[] | undefined;
    }

    // outgoing headers allows numbers (as they are converted internally to strings)
    interface OutgoingHttpHeaders {
        [header: string]: number | string | string[] | undefined;
    }

    interface ClientRequestArgs {
        protocol?: string;
        host?: string;
        hostname?: string;
        family?: number;
        port?: number | string;
        defaultPort?: number | string;
        localAddress?: string;
        socketPath?: string;
        method?: string;
        path?: string;
        headers?: OutgoingHttpHeaders;
        auth?: string;
        agent?: Agent | boolean;
        _defaultAgent?: Agent;
        timeout?: number;
        // https://github.com/nodejs/node/blob/master/lib/_http_client.js#L278
        createConnection?: (options: ClientRequestArgs, oncreate: (err: Error, socket: net.Socket) => void) => net.Socket;
    }

    class Server extends net.Server {
        constructor(requestListener?: (req: IncomingMessage, res: ServerResponse) => void);

        setTimeout(msecs?: number, callback?: () => void): this;
        setTimeout(callback: () => void): this;
        maxHeadersCount: number;
        timeout: number;
        keepAliveTimeout: number;
    }

    // https://github.com/nodejs/node/blob/master/lib/_http_outgoing.js
    class OutgoingMessage extends stream.Writable {
        upgrading: boolean;
        chunkedEncoding: boolean;
        shouldKeepAlive: boolean;
        useChunkedEncodingByDefault: boolean;
        sendDate: boolean;
        finished: boolean;
        headersSent: boolean;
        connection: net.Socket;

        constructor();

        setTimeout(msecs: number, callback?: () => void): this;
        setHeader(name: string, value: number | string | string[]): void;
        getHeader(name: string): number | string | string[] | undefined;
        getHeaders(): OutgoingHttpHeaders;
        getHeaderNames(): string[];
        hasHeader(name: string): boolean;
        removeHeader(name: string): void;
        addTrailers(headers: OutgoingHttpHeaders | Array<[string, string]>): void;
        flushHeaders(): void;
    }

    // https://github.com/nodejs/node/blob/master/lib/_http_server.js#L108-L256
    class ServerResponse extends OutgoingMessage {
        statusCode: number;
        statusMessage: string;

        constructor(req: IncomingMessage);

        assignSocket(socket: net.Socket): void;
        detachSocket(socket: net.Socket): void;
        // https://github.com/nodejs/node/blob/master/test/parallel/test-http-write-callbacks.js#L53
        // no args in writeContinue callback
        writeContinue(callback?: () => void): void;
        writeHead(statusCode: number, reasonPhrase?: string, headers?: OutgoingHttpHeaders): void;
        writeHead(statusCode: number, headers?: OutgoingHttpHeaders): void;
    }

    // https://github.com/nodejs/node/blob/master/lib/_http_client.js#L77
    class ClientRequest extends OutgoingMessage {
        connection: net.Socket;
        socket: net.Socket;
        aborted: number;

        constructor(url: string | URL | ClientRequestArgs, cb?: (res: IncomingMessage) => void);

        abort(): void;
        onSocket(socket: net.Socket): void;
        setTimeout(timeout: number, callback?: () => void): this;
        setNoDelay(noDelay?: boolean): void;
        setSocketKeepAlive(enable?: boolean, initialDelay?: number): void;
    }

    class IncomingMessage extends stream.Readable {
        constructor(socket: net.Socket);

        httpVersion: string;
        httpVersionMajor: number;
        httpVersionMinor: number;
        connection: net.Socket;
        headers: IncomingHttpHeaders;
        rawHeaders: string[];
        trailers: { [key: string]: string | undefined };
        rawTrailers: string[];
        setTimeout(msecs: number, callback: () => void): this;
        /**
         * Only valid for request obtained from http.Server.
         */
        method?: string;
        /**
         * Only valid for request obtained from http.Server.
         */
        url?: string;
        /**
         * Only valid for response obtained from http.ClientRequest.
         */
        statusCode?: number;
        /**
         * Only valid for response obtained from http.ClientRequest.
         */
        statusMessage?: string;
        socket: net.Socket;
        destroy(error?: Error): void;
    }

    interface AgentOptions {
        /**
         * Keep sockets around in a pool to be used by other requests in the future. Default = false
         */
        keepAlive?: boolean;
        /**
         * When using HTTP KeepAlive, how often to send TCP KeepAlive packets over sockets being kept alive. Default = 1000.
         * Only relevant if keepAlive is set to true.
         */
        keepAliveMsecs?: number;
        /**
         * Maximum number of sockets to allow per host. Default for Node 0.10 is 5, default for Node 0.12 is Infinity
         */
        maxSockets?: number;
        /**
         * Maximum number of sockets to leave open in a free state. Only relevant if keepAlive is set to true. Default = 256.
         */
        maxFreeSockets?: number;
        /**
         * Socket timeout in milliseconds. This will set the timeout after the socket is connected.
         */
        timeout?: number;
    }

    class Agent {
        maxFreeSockets: number;
        maxSockets: number;
        sockets: any;
        requests: any;

        constructor(opts?: AgentOptions);

        /**
         * Destroy any sockets that are currently in use by the agent.
         * It is usually not necessary to do this. However, if you are using an agent with KeepAlive enabled,
         * then it is best to explicitly shut down the agent when you know that it will no longer be used. Otherwise,
         * sockets may hang open for quite a long time before the server terminates them.
         */
        destroy(): void;
    }

    const METHODS: string[];

    const STATUS_CODES: {
        [errorCode: number]: string | undefined;
        [errorCode: string]: string | undefined;
    };

    function createServer(requestListener?: (request: IncomingMessage, response: ServerResponse) => void): Server;
    function createClient(port?: number, host?: string): any;

    // although RequestOptions are passed as ClientRequestArgs to ClientRequest directly,
    // create interface RequestOptions would make the naming more clear to developers
    interface RequestOptions extends ClientRequestArgs { }
    function request(options: RequestOptions | string | URL, callback?: (res: IncomingMessage) => void): ClientRequest;
    function request(url: string | URL, options: RequestOptions, callback?: (res: IncomingMessage) => void): ClientRequest;
    function get(options: RequestOptions | string | URL, callback?: (res: IncomingMessage) => void): ClientRequest;
    function get(url: string | URL, options: RequestOptions, callback?: (res: IncomingMessage) => void): ClientRequest;
    let globalAgent: Agent;
}

declare module "cluster" {
    import * as child from "child_process";
    import * as events from "events";
    import * as net from "net";

    // interfaces
    interface ClusterSettings {
        execArgv?: string[]; // default: process.execArgv
        exec?: string;
        args?: string[];
        silent?: boolean;
        stdio?: any[];
        uid?: number;
        gid?: number;
        inspectPort?: number | (() => number);
    }

    interface Address {
        address: string;
        port: number;
        addressType: number | "udp4" | "udp6";  // 4, 6, -1, "udp4", "udp6"
    }

    class Worker extends events.EventEmitter {
        id: number;
        process: child.ChildProcess;
        suicide: boolean;
        send(message: any, sendHandle?: any, callback?: (error: Error) => void): boolean;
        kill(signal?: string): void;
        destroy(signal?: string): void;
        disconnect(): void;
        isConnected(): boolean;
        isDead(): boolean;
        exitedAfterDisconnect: boolean;

        /**
         * events.EventEmitter
         *   1. disconnect
         *   2. error
         *   3. exit
         *   4. listening
         *   5. message
         *   6. online
         */
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "disconnect", listener: () => void): this;
        addListener(event: "error", listener: (error: Error) => void): this;
        addListener(event: "exit", listener: (code: number, signal: string) => void): this;
        addListener(event: "listening", listener: (address: Address) => void): this;
        addListener(event: "message", listener: (message: any, handle: net.Socket | net.Server) => void): this;  // the handle is a net.Socket or net.Server object, or undefined.
        addListener(event: "online", listener: () => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "disconnect"): boolean;
        emit(event: "error", error: Error): boolean;
        emit(event: "exit", code: number, signal: string): boolean;
        emit(event: "listening", address: Address): boolean;
        emit(event: "message", message: any, handle: net.Socket | net.Server): boolean;
        emit(event: "online"): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "disconnect", listener: () => void): this;
        on(event: "error", listener: (error: Error) => void): this;
        on(event: "exit", listener: (code: number, signal: string) => void): this;
        on(event: "listening", listener: (address: Address) => void): this;
        on(event: "message", listener: (message: any, handle: net.Socket | net.Server) => void): this;  // the handle is a net.Socket or net.Server object, or undefined.
        on(event: "online", listener: () => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "disconnect", listener: () => void): this;
        once(event: "error", listener: (error: Error) => void): this;
        once(event: "exit", listener: (code: number, signal: string) => void): this;
        once(event: "listening", listener: (address: Address) => void): this;
        once(event: "message", listener: (message: any, handle: net.Socket | net.Server) => void): this;  // the handle is a net.Socket or net.Server object, or undefined.
        once(event: "online", listener: () => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "disconnect", listener: () => void): this;
        prependListener(event: "error", listener: (error: Error) => void): this;
        prependListener(event: "exit", listener: (code: number, signal: string) => void): this;
        prependListener(event: "listening", listener: (address: Address) => void): this;
        prependListener(event: "message", listener: (message: any, handle: net.Socket | net.Server) => void): this;  // the handle is a net.Socket or net.Server object, or undefined.
        prependListener(event: "online", listener: () => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "disconnect", listener: () => void): this;
        prependOnceListener(event: "error", listener: (error: Error) => void): this;
        prependOnceListener(event: "exit", listener: (code: number, signal: string) => void): this;
        prependOnceListener(event: "listening", listener: (address: Address) => void): this;
        prependOnceListener(event: "message", listener: (message: any, handle: net.Socket | net.Server) => void): this;  // the handle is a net.Socket or net.Server object, or undefined.
        prependOnceListener(event: "online", listener: () => void): this;
    }

    interface Cluster extends events.EventEmitter {
        Worker: Worker;
        disconnect(callback?: Function): void;
        fork(env?: any): Worker;
        isMaster: boolean;
        isWorker: boolean;
        // TODO: cluster.schedulingPolicy
        settings: ClusterSettings;
        setupMaster(settings?: ClusterSettings): void;
        worker?: Worker;
        workers?: {
            [index: string]: Worker | undefined
        };

        /**
         * events.EventEmitter
         *   1. disconnect
         *   2. exit
         *   3. fork
         *   4. listening
         *   5. message
         *   6. online
         *   7. setup
         */
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "disconnect", listener: (worker: Worker) => void): this;
        addListener(event: "exit", listener: (worker: Worker, code: number, signal: string) => void): this;
        addListener(event: "fork", listener: (worker: Worker) => void): this;
        addListener(event: "listening", listener: (worker: Worker, address: Address) => void): this;
        addListener(event: "message", listener: (worker: Worker, message: any, handle: net.Socket | net.Server) => void): this;  // the handle is a net.Socket or net.Server object, or undefined.
        addListener(event: "online", listener: (worker: Worker) => void): this;
        addListener(event: "setup", listener: (settings: any) => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "disconnect", worker: Worker): boolean;
        emit(event: "exit", worker: Worker, code: number, signal: string): boolean;
        emit(event: "fork", worker: Worker): boolean;
        emit(event: "listening", worker: Worker, address: Address): boolean;
        emit(event: "message", worker: Worker, message: any, handle: net.Socket | net.Server): boolean;
        emit(event: "online", worker: Worker): boolean;
        emit(event: "setup", settings: any): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "disconnect", listener: (worker: Worker) => void): this;
        on(event: "exit", listener: (worker: Worker, code: number, signal: string) => void): this;
        on(event: "fork", listener: (worker: Worker) => void): this;
        on(event: "listening", listener: (worker: Worker, address: Address) => void): this;
        on(event: "message", listener: (worker: Worker, message: any, handle: net.Socket | net.Server) => void): this;  // the handle is a net.Socket or net.Server object, or undefined.
        on(event: "online", listener: (worker: Worker) => void): this;
        on(event: "setup", listener: (settings: any) => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "disconnect", listener: (worker: Worker) => void): this;
        once(event: "exit", listener: (worker: Worker, code: number, signal: string) => void): this;
        once(event: "fork", listener: (worker: Worker) => void): this;
        once(event: "listening", listener: (worker: Worker, address: Address) => void): this;
        once(event: "message", listener: (worker: Worker, message: any, handle: net.Socket | net.Server) => void): this;  // the handle is a net.Socket or net.Server object, or undefined.
        once(event: "online", listener: (worker: Worker) => void): this;
        once(event: "setup", listener: (settings: any) => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "disconnect", listener: (worker: Worker) => void): this;
        prependListener(event: "exit", listener: (worker: Worker, code: number, signal: string) => void): this;
        prependListener(event: "fork", listener: (worker: Worker) => void): this;
        prependListener(event: "listening", listener: (worker: Worker, address: Address) => void): this;
        prependListener(event: "message", listener: (worker: Worker, message: any, handle: net.Socket | net.Server) => void): this;  // the handle is a net.Socket or net.Server object, or undefined.
        prependListener(event: "online", listener: (worker: Worker) => void): this;
        prependListener(event: "setup", listener: (settings: any) => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "disconnect", listener: (worker: Worker) => void): this;
        prependOnceListener(event: "exit", listener: (worker: Worker, code: number, signal: string) => void): this;
        prependOnceListener(event: "fork", listener: (worker: Worker) => void): this;
        prependOnceListener(event: "listening", listener: (worker: Worker, address: Address) => void): this;
        // the handle is a net.Socket or net.Server object, or undefined.
        prependOnceListener(event: "message", listener: (worker: Worker, message: any, handle: net.Socket | net.Server) => void): this;
        prependOnceListener(event: "online", listener: (worker: Worker) => void): this;
        prependOnceListener(event: "setup", listener: (settings: any) => void): this;
    }

    function disconnect(callback?: Function): void;
    function fork(env?: any): Worker;
    const isMaster: boolean;
    const isWorker: boolean;
    // TODO: cluster.schedulingPolicy
    const settings: ClusterSettings;
    function setupMaster(settings?: ClusterSettings): void;
    const worker: Worker;
    const workers: {
        [index: string]: Worker | undefined
    };

    /**
     * events.EventEmitter
     *   1. disconnect
     *   2. exit
     *   3. fork
     *   4. listening
     *   5. message
     *   6. online
     *   7. setup
     */
    function addListener(event: string, listener: (...args: any[]) => void): Cluster;
    function addListener(event: "disconnect", listener: (worker: Worker) => void): Cluster;
    function addListener(event: "exit", listener: (worker: Worker, code: number, signal: string) => void): Cluster;
    function addListener(event: "fork", listener: (worker: Worker) => void): Cluster;
    function addListener(event: "listening", listener: (worker: Worker, address: Address) => void): Cluster;
     // the handle is a net.Socket or net.Server object, or undefined.
    function addListener(event: "message", listener: (worker: Worker, message: any, handle: net.Socket | net.Server) => void): Cluster;
    function addListener(event: "online", listener: (worker: Worker) => void): Cluster;
    function addListener(event: "setup", listener: (settings: any) => void): Cluster;

    function emit(event: string | symbol, ...args: any[]): boolean;
    function emit(event: "disconnect", worker: Worker): boolean;
    function emit(event: "exit", worker: Worker, code: number, signal: string): boolean;
    function emit(event: "fork", worker: Worker): boolean;
    function emit(event: "listening", worker: Worker, address: Address): boolean;
    function emit(event: "message", worker: Worker, message: any, handle: net.Socket | net.Server): boolean;
    function emit(event: "online", worker: Worker): boolean;
    function emit(event: "setup", settings: any): boolean;

    function on(event: string, listener: (...args: any[]) => void): Cluster;
    function on(event: "disconnect", listener: (worker: Worker) => void): Cluster;
    function on(event: "exit", listener: (worker: Worker, code: number, signal: string) => void): Cluster;
    function on(event: "fork", listener: (worker: Worker) => void): Cluster;
    function on(event: "listening", listener: (worker: Worker, address: Address) => void): Cluster;
    function on(event: "message", listener: (worker: Worker, message: any, handle: net.Socket | net.Server) => void): Cluster;  // the handle is a net.Socket or net.Server object, or undefined.
    function on(event: "online", listener: (worker: Worker) => void): Cluster;
    function on(event: "setup", listener: (settings: any) => void): Cluster;

    function once(event: string, listener: (...args: any[]) => void): Cluster;
    function once(event: "disconnect", listener: (worker: Worker) => void): Cluster;
    function once(event: "exit", listener: (worker: Worker, code: number, signal: string) => void): Cluster;
    function once(event: "fork", listener: (worker: Worker) => void): Cluster;
    function once(event: "listening", listener: (worker: Worker, address: Address) => void): Cluster;
    function once(event: "message", listener: (worker: Worker, message: any, handle: net.Socket | net.Server) => void): Cluster;  // the handle is a net.Socket or net.Server object, or undefined.
    function once(event: "online", listener: (worker: Worker) => void): Cluster;
    function once(event: "setup", listener: (settings: any) => void): Cluster;

    function removeListener(event: string, listener: (...args: any[]) => void): Cluster;
    function removeAllListeners(event?: string): Cluster;
    function setMaxListeners(n: number): Cluster;
    function getMaxListeners(): number;
    function listeners(event: string): Function[];
    function listenerCount(type: string): number;

    function prependListener(event: string, listener: (...args: any[]) => void): Cluster;
    function prependListener(event: "disconnect", listener: (worker: Worker) => void): Cluster;
    function prependListener(event: "exit", listener: (worker: Worker, code: number, signal: string) => void): Cluster;
    function prependListener(event: "fork", listener: (worker: Worker) => void): Cluster;
    function prependListener(event: "listening", listener: (worker: Worker, address: Address) => void): Cluster;
     // the handle is a net.Socket or net.Server object, or undefined.
    function prependListener(event: "message", listener: (worker: Worker, message: any, handle: net.Socket | net.Server) => void): Cluster;
    function prependListener(event: "online", listener: (worker: Worker) => void): Cluster;
    function prependListener(event: "setup", listener: (settings: any) => void): Cluster;

    function prependOnceListener(event: string, listener: (...args: any[]) => void): Cluster;
    function prependOnceListener(event: "disconnect", listener: (worker: Worker) => void): Cluster;
    function prependOnceListener(event: "exit", listener: (worker: Worker, code: number, signal: string) => void): Cluster;
    function prependOnceListener(event: "fork", listener: (worker: Worker) => void): Cluster;
    function prependOnceListener(event: "listening", listener: (worker: Worker, address: Address) => void): Cluster;
     // the handle is a net.Socket or net.Server object, or undefined.
    function prependOnceListener(event: "message", listener: (worker: Worker, message: any, handle: net.Socket | net.Server) => void): Cluster;
    function prependOnceListener(event: "online", listener: (worker: Worker) => void): Cluster;
    function prependOnceListener(event: "setup", listener: (settings: any) => void): Cluster;

    function eventNames(): string[];
}

declare module "worker_threads" {
    import { EventEmitter } from "events";
    import { Readable, Writable } from "stream";

    const isMainThread: boolean;
    const parentPort: null | MessagePort;
    const threadId: number;
    const workerData: any;

    class MessageChannel {
        readonly port1: MessagePort;
        readonly port2: MessagePort;
    }

    class MessagePort extends EventEmitter {
        close(): void;
        postMessage(value: any, transferList?: Array<ArrayBuffer | MessagePort>): void;
        ref(): void;
        unref(): void;
        start(): void;

        addListener(event: "close", listener: () => void): this;
        addListener(event: "message", listener: (value: any) => void): this;
        addListener(event: string | symbol, listener: (...args: any[]) => void): this;

        emit(event: "close"): boolean;
        emit(event: "message", value: any): boolean;
        emit(event: string | symbol, ...args: any[]): boolean;

        on(event: "close", listener: () => void): this;
        on(event: "message", listener: (value: any) => void): this;
        on(event: string | symbol, listener: (...args: any[]) => void): this;

        once(event: "close", listener: () => void): this;
        once(event: "message", listener: (value: any) => void): this;
        once(event: string | symbol, listener: (...args: any[]) => void): this;

        prependListener(event: "close", listener: () => void): this;
        prependListener(event: "message", listener: (value: any) => void): this;
        prependListener(event: string | symbol, listener: (...args: any[]) => void): this;

        prependOnceListener(event: "close", listener: () => void): this;
        prependOnceListener(event: "message", listener: (value: any) => void): this;
        prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;

        removeListener(event: "close", listener: () => void): this;
        removeListener(event: "message", listener: (value: any) => void): this;
        removeListener(event: string | symbol, listener: (...args: any[]) => void): this;

        off(event: "close", listener: () => void): this;
        off(event: "message", listener: (value: any) => void): this;
        off(event: string | symbol, listener: (...args: any[]) => void): this;
    }

    interface WorkerOptions {
        eval?: boolean;
        workerData?: any;
        stdin?: boolean;
        stdout?: boolean;
        stderr?: boolean;
    }

    class Worker extends EventEmitter {
        readonly stdin: Writable | null;
        readonly stdout: Readable;
        readonly stderr: Readable;
        readonly threadId: number;

        constructor(filename: string, options?: WorkerOptions);

        postMessage(value: any, transferList?: Array<ArrayBuffer | MessagePort>): void;
        ref(): void;
        unref(): void;
        terminate(callback?: (err: any, exitCode: number) => void): void;

        addListener(event: "error", listener: (err: any) => void): this;
        addListener(event: "exit", listener: (exitCode: number) => void): this;
        addListener(event: "message", listener: (value: any) => void): this;
        addListener(event: "online", listener: () => void): this;
        addListener(event: string | symbol, listener: (...args: any[]) => void): this;

        emit(event: "error", err: any): boolean;
        emit(event: "exit", exitCode: number): boolean;
        emit(event: "message", value: any): boolean;
        emit(event: "online"): boolean;
        emit(event: string | symbol, ...args: any[]): boolean;

        on(event: "error", listener: (err: any) => void): this;
        on(event: "exit", listener: (exitCode: number) => void): this;
        on(event: "message", listener: (value: any) => void): this;
        on(event: "online", listener: () => void): this;
        on(event: string | symbol, listener: (...args: any[]) => void): this;

        once(event: "error", listener: (err: any) => void): this;
        once(event: "exit", listener: (exitCode: number) => void): this;
        once(event: "message", listener: (value: any) => void): this;
        once(event: "online", listener: () => void): this;
        once(event: string | symbol, listener: (...args: any[]) => void): this;

        prependListener(event: "error", listener: (err: any) => void): this;
        prependListener(event: "exit", listener: (exitCode: number) => void): this;
        prependListener(event: "message", listener: (value: any) => void): this;
        prependListener(event: "online", listener: () => void): this;
        prependListener(event: string | symbol, listener: (...args: any[]) => void): this;

        prependOnceListener(event: "error", listener: (err: any) => void): this;
        prependOnceListener(event: "exit", listener: (exitCode: number) => void): this;
        prependOnceListener(event: "message", listener: (value: any) => void): this;
        prependOnceListener(event: "online", listener: () => void): this;
        prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;

        removeListener(event: "error", listener: (err: any) => void): this;
        removeListener(event: "exit", listener: (exitCode: number) => void): this;
        removeListener(event: "message", listener: (value: any) => void): this;
        removeListener(event: "online", listener: () => void): this;
        removeListener(event: string | symbol, listener: (...args: any[]) => void): this;

        off(event: "error", listener: (err: any) => void): this;
        off(event: "exit", listener: (exitCode: number) => void): this;
        off(event: "message", listener: (value: any) => void): this;
        off(event: "online", listener: () => void): this;
        off(event: string | symbol, listener: (...args: any[]) => void): this;
    }
}

declare module "zlib" {
    import * as stream from "stream";

    interface ZlibOptions {
        flush?: number; // default: zlib.constants.Z_NO_FLUSH
        finishFlush?: number; // default: zlib.constants.Z_FINISH
        chunkSize?: number; // default: 16*1024
        windowBits?: number;
        level?: number; // compression only
        memLevel?: number; // compression only
        strategy?: number; // compression only
        dictionary?: Buffer | NodeJS.TypedArray | DataView | ArrayBuffer; // deflate/inflate only, empty dictionary by default
    }

    interface Zlib {
        readonly bytesRead: number;
        close(callback?: () => void): void;
        flush(kind?: number | (() => void), callback?: () => void): void;
    }

    interface ZlibParams {
        params(level: number, strategy: number, callback: () => void): void;
    }

    interface ZlibReset {
        reset(): void;
    }

    interface Gzip extends stream.Transform, Zlib { }
    interface Gunzip extends stream.Transform, Zlib { }
    interface Deflate extends stream.Transform, Zlib, ZlibReset, ZlibParams { }
    interface Inflate extends stream.Transform, Zlib, ZlibReset { }
    interface DeflateRaw extends stream.Transform, Zlib, ZlibReset, ZlibParams { }
    interface InflateRaw extends stream.Transform, Zlib, ZlibReset { }
    interface Unzip extends stream.Transform, Zlib { }

    function createGzip(options?: ZlibOptions): Gzip;
    function createGunzip(options?: ZlibOptions): Gunzip;
    function createDeflate(options?: ZlibOptions): Deflate;
    function createInflate(options?: ZlibOptions): Inflate;
    function createDeflateRaw(options?: ZlibOptions): DeflateRaw;
    function createInflateRaw(options?: ZlibOptions): InflateRaw;
    function createUnzip(options?: ZlibOptions): Unzip;

    type InputType = string | Buffer | DataView | ArrayBuffer | NodeJS.TypedArray;
    function deflate(buf: InputType, callback: (error: Error | null, result: Buffer) => void): void;
    function deflate(buf: InputType, options: ZlibOptions, callback: (error: Error | null, result: Buffer) => void): void;
    function deflateSync(buf: InputType, options?: ZlibOptions): Buffer;
    function deflateRaw(buf: InputType, callback: (error: Error | null, result: Buffer) => void): void;
    function deflateRaw(buf: InputType, options: ZlibOptions, callback: (error: Error | null, result: Buffer) => void): void;
    function deflateRawSync(buf: InputType, options?: ZlibOptions): Buffer;
    function gzip(buf: InputType, callback: (error: Error | null, result: Buffer) => void): void;
    function gzip(buf: InputType, options: ZlibOptions, callback: (error: Error | null, result: Buffer) => void): void;
    function gzipSync(buf: InputType, options?: ZlibOptions): Buffer;
    function gunzip(buf: InputType, callback: (error: Error | null, result: Buffer) => void): void;
    function gunzip(buf: InputType, options: ZlibOptions, callback: (error: Error | null, result: Buffer) => void): void;
    function gunzipSync(buf: InputType, options?: ZlibOptions): Buffer;
    function inflate(buf: InputType, callback: (error: Error | null, result: Buffer) => void): void;
    function inflate(buf: InputType, options: ZlibOptions, callback: (error: Error | null, result: Buffer) => void): void;
    function inflateSync(buf: InputType, options?: ZlibOptions): Buffer;
    function inflateRaw(buf: InputType, callback: (error: Error | null, result: Buffer) => void): void;
    function inflateRaw(buf: InputType, options: ZlibOptions, callback: (error: Error | null, result: Buffer) => void): void;
    function inflateRawSync(buf: InputType, options?: ZlibOptions): Buffer;
    function unzip(buf: InputType, callback: (error: Error | null, result: Buffer) => void): void;
    function unzip(buf: InputType, options: ZlibOptions, callback: (error: Error | null, result: Buffer) => void): void;
    function unzipSync(buf: InputType, options?: ZlibOptions): Buffer;

    namespace constants {
        // Allowed flush values.

        const Z_NO_FLUSH: number;
        const Z_PARTIAL_FLUSH: number;
        const Z_SYNC_FLUSH: number;
        const Z_FULL_FLUSH: number;
        const Z_FINISH: number;
        const Z_BLOCK: number;
        const Z_TREES: number;

        // Return codes for the compression/decompression functions. Negative values are errors, positive values are used for special but normal events.

        const Z_OK: number;
        const Z_STREAM_END: number;
        const Z_NEED_DICT: number;
        const Z_ERRNO: number;
        const Z_STREAM_ERROR: number;
        const Z_DATA_ERROR: number;
        const Z_MEM_ERROR: number;
        const Z_BUF_ERROR: number;
        const Z_VERSION_ERROR: number;

        // Compression levels.

        const Z_NO_COMPRESSION: number;
        const Z_BEST_SPEED: number;
        const Z_BEST_COMPRESSION: number;
        const Z_DEFAULT_COMPRESSION: number;

        // Compression strategy.

        const Z_FILTERED: number;
        const Z_HUFFMAN_ONLY: number;
        const Z_RLE: number;
        const Z_FIXED: number;
        const Z_DEFAULT_STRATEGY: number;
    }

    // Constants
    const Z_NO_FLUSH: number;
    const Z_PARTIAL_FLUSH: number;
    const Z_SYNC_FLUSH: number;
    const Z_FULL_FLUSH: number;
    const Z_FINISH: number;
    const Z_BLOCK: number;
    const Z_TREES: number;
    const Z_OK: number;
    const Z_STREAM_END: number;
    const Z_NEED_DICT: number;
    const Z_ERRNO: number;
    const Z_STREAM_ERROR: number;
    const Z_DATA_ERROR: number;
    const Z_MEM_ERROR: number;
    const Z_BUF_ERROR: number;
    const Z_VERSION_ERROR: number;
    const Z_NO_COMPRESSION: number;
    const Z_BEST_SPEED: number;
    const Z_BEST_COMPRESSION: number;
    const Z_DEFAULT_COMPRESSION: number;
    const Z_FILTERED: number;
    const Z_HUFFMAN_ONLY: number;
    const Z_RLE: number;
    const Z_FIXED: number;
    const Z_DEFAULT_STRATEGY: number;
    const Z_BINARY: number;
    const Z_TEXT: number;
    const Z_ASCII: number;
    const Z_UNKNOWN: number;
    const Z_DEFLATED: number;
}

declare module "os" {
    interface CpuInfo {
        model: string;
        speed: number;
        times: {
            user: number;
            nice: number;
            sys: number;
            idle: number;
            irq: number;
        };
    }

    interface NetworkInterfaceBase {
        address: string;
        netmask: string;
        mac: string;
        internal: boolean;
        cidr: string | null;
    }

    interface NetworkInterfaceInfoIPv4 extends NetworkInterfaceBase {
        family: "IPv4";
    }

    interface NetworkInterfaceInfoIPv6 extends NetworkInterfaceBase {
        family: "IPv6";
        scopeid: number;
    }

    type NetworkInterfaceInfo = NetworkInterfaceInfoIPv4 | NetworkInterfaceInfoIPv6;

    function hostname(): string;
    function loadavg(): number[];
    function uptime(): number;
    function freemem(): number;
    function totalmem(): number;
    function cpus(): CpuInfo[];
    function type(): string;
    function release(): string;
    function networkInterfaces(): { [index: string]: NetworkInterfaceInfo[] };
    function homedir(): string;
    function userInfo(options?: { encoding: string }): { username: string, uid: number, gid: number, shell: any, homedir: string };
    const constants: {
        UV_UDP_REUSEADDR: number;
        signals: {
            SIGHUP: number;
            SIGINT: number;
            SIGQUIT: number;
            SIGILL: number;
            SIGTRAP: number;
            SIGABRT: number;
            SIGIOT: number;
            SIGBUS: number;
            SIGFPE: number;
            SIGKILL: number;
            SIGUSR1: number;
            SIGSEGV: number;
            SIGUSR2: number;
            SIGPIPE: number;
            SIGALRM: number;
            SIGTERM: number;
            SIGCHLD: number;
            SIGSTKFLT: number;
            SIGCONT: number;
            SIGSTOP: number;
            SIGTSTP: number;
            SIGTTIN: number;
            SIGTTOU: number;
            SIGURG: number;
            SIGXCPU: number;
            SIGXFSZ: number;
            SIGVTALRM: number;
            SIGPROF: number;
            SIGWINCH: number;
            SIGIO: number;
            SIGPOLL: number;
            SIGPWR: number;
            SIGSYS: number;
            SIGUNUSED: number;
        };
        errno: {
            E2BIG: number;
            EACCES: number;
            EADDRINUSE: number;
            EADDRNOTAVAIL: number;
            EAFNOSUPPORT: number;
            EAGAIN: number;
            EALREADY: number;
            EBADF: number;
            EBADMSG: number;
            EBUSY: number;
            ECANCELED: number;
            ECHILD: number;
            ECONNABORTED: number;
            ECONNREFUSED: number;
            ECONNRESET: number;
            EDEADLK: number;
            EDESTADDRREQ: number;
            EDOM: number;
            EDQUOT: number;
            EEXIST: number;
            EFAULT: number;
            EFBIG: number;
            EHOSTUNREACH: number;
            EIDRM: number;
            EILSEQ: number;
            EINPROGRESS: number;
            EINTR: number;
            EINVAL: number;
            EIO: number;
            EISCONN: number;
            EISDIR: number;
            ELOOP: number;
            EMFILE: number;
            EMLINK: number;
            EMSGSIZE: number;
            EMULTIHOP: number;
            ENAMETOOLONG: number;
            ENETDOWN: number;
            ENETRESET: number;
            ENETUNREACH: number;
            ENFILE: number;
            ENOBUFS: number;
            ENODATA: number;
            ENODEV: number;
            ENOENT: number;
            ENOEXEC: number;
            ENOLCK: number;
            ENOLINK: number;
            ENOMEM: number;
            ENOMSG: number;
            ENOPROTOOPT: number;
            ENOSPC: number;
            ENOSR: number;
            ENOSTR: number;
            ENOSYS: number;
            ENOTCONN: number;
            ENOTDIR: number;
            ENOTEMPTY: number;
            ENOTSOCK: number;
            ENOTSUP: number;
            ENOTTY: number;
            ENXIO: number;
            EOPNOTSUPP: number;
            EOVERFLOW: number;
            EPERM: number;
            EPIPE: number;
            EPROTO: number;
            EPROTONOSUPPORT: number;
            EPROTOTYPE: number;
            ERANGE: number;
            EROFS: number;
            ESPIPE: number;
            ESRCH: number;
            ESTALE: number;
            ETIME: number;
            ETIMEDOUT: number;
            ETXTBSY: number;
            EWOULDBLOCK: number;
            EXDEV: number;
        };
        priority: {
            PRIORITY_LOW: number;
            PRIORITY_BELOW_NORMAL: number;
            PRIORITY_NORMAL: number;
            PRIORITY_ABOVE_NORMAL: number;
            PRIORITY_HIGH: number;
            PRIORITY_HIGHEST: number;
        }
    };
    function arch(): string;
    function platform(): NodeJS.Platform;
    function tmpdir(): string;
    const EOL: string;
    function endianness(): "BE" | "LE";
    /**
     * Gets the priority of a process.
     * Defaults to current process.
     */
    function getPriority(pid?: number): number;
    /**
     * Sets the priority of the current process.
     * @param priority Must be in range of -20 to 19
     */
    function setPriority(priority: number): void;
    /**
     * Sets the priority of the process specified process.
     * @param priority Must be in range of -20 to 19
     */
    function setPriority(pid: number, priority: number): void;
}

declare module "https" {
    import * as tls from "tls";
    import * as events from "events";
    import * as http from "http";
    import { URL } from "url";

    type ServerOptions = tls.SecureContextOptions & tls.TlsOptions;

    type RequestOptions = http.RequestOptions & tls.SecureContextOptions & {
        rejectUnauthorized?: boolean; // Defaults to true
        servername?: string; // SNI TLS Extension
    };

    interface AgentOptions extends http.AgentOptions, tls.ConnectionOptions {
        rejectUnauthorized?: boolean;
        maxCachedSessions?: number;
    }

    class Agent extends http.Agent {
        constructor(options?: AgentOptions);
        options: AgentOptions;
    }

    class Server extends tls.Server {
        setTimeout(callback: () => void): this;
        setTimeout(msecs?: number, callback?: () => void): this;
        timeout: number;
        keepAliveTimeout: number;
    }

    function createServer(options: ServerOptions, requestListener?: (req: http.IncomingMessage, res: http.ServerResponse) => void): Server;
    function request(options: RequestOptions | string | URL, callback?: (res: http.IncomingMessage) => void): http.ClientRequest;
    function request(url: string | URL, options: RequestOptions, callback?: (res: http.IncomingMessage) => void): http.ClientRequest;
    function get(options: RequestOptions | string | URL, callback?: (res: http.IncomingMessage) => void): http.ClientRequest;
    function get(url: string | URL, options: RequestOptions, callback?: (res: http.IncomingMessage) => void): http.ClientRequest;
    let globalAgent: Agent;
}

declare module "punycode" {
    function decode(string: string): string;
    function encode(string: string): string;
    function toUnicode(domain: string): string;
    function toASCII(domain: string): string;
    const ucs2: ucs2;
    interface ucs2 {
        decode(string: string): number[];
        encode(codePoints: number[]): string;
    }
    const version: any;
}

declare module "repl" {
    import { Interface, Completer, AsyncCompleter } from "readline";
    import { Context } from "vm";
    import { InspectOptions } from "util";

    interface ReplOptions {
        /**
         * The input prompt to display.
         * Default: `"> "`
         */
        prompt?: string;
        /**
         * The `Readable` stream from which REPL input will be read.
         * Default: `process.stdin`
         */
        input?: NodeJS.ReadableStream;
        /**
         * The `Writable` stream to which REPL output will be written.
         * Default: `process.stdout`
         */
        output?: NodeJS.WritableStream;
        /**
         * If `true`, specifies that the output should be treated as a TTY terminal, and have
         * ANSI/VT100 escape codes written to it.
         * Default: checking the value of the `isTTY` property on the output stream upon
         * instantiation.
         */
        terminal?: boolean;
        /**
         * The function to be used when evaluating each given line of input.
         * Default: an async wrapper for the JavaScript `eval()` function. An `eval` function can
         * error with `repl.Recoverable` to indicate the input was incomplete and prompt for
         * additional lines.
         *
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_default_evaluation
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_custom_evaluation_functions
         */
        eval?: REPLEval;
        /**
         * If `true`, specifies that the default `writer` function should include ANSI color
         * styling to REPL output. If a custom `writer` function is provided then this has no
         * effect.
         * Default: the REPL instance's `terminal` value.
         */
        useColors?: boolean;
        /**
         * If `true`, specifies that the default evaluation function will use the JavaScript
         * `global` as the context as opposed to creating a new separate context for the REPL
         * instance. The node CLI REPL sets this value to `true`.
         * Default: `false`.
         */
        useGlobal?: boolean;
        /**
         * If `true`, specifies that the default writer will not output the return value of a
         * command if it evaluates to `undefined`.
         * Default: `false`.
         */
        ignoreUndefined?: boolean;
        /**
         * The function to invoke to format the output of each command before writing to `output`.
         * Default: a wrapper for `util.inspect`.
         *
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_customizing_repl_output
         */
        writer?: REPLWriter;
        /**
         * An optional function used for custom Tab auto completion.
         *
         * @see https://nodejs.org/dist/latest-v11.x/docs/api/readline.html#readline_use_of_the_completer_function
         */
        completer?: Completer | AsyncCompleter;
        /**
         * A flag that specifies whether the default evaluator executes all JavaScript commands in
         * strict mode or default (sloppy) mode.
         * Accepted values are:
         * - `repl.REPL_MODE_SLOPPY` - evaluates expressions in sloppy mode.
         * - `repl.REPL_MODE_STRICT` - evaluates expressions in strict mode. This is equivalent to
         *   prefacing every repl statement with `'use strict'`.
         */
        replMode?: typeof REPL_MODE_SLOPPY | typeof REPL_MODE_STRICT;
        /**
         * Stop evaluating the current piece of code when `SIGINT` is received, i.e. `Ctrl+C` is
         * pressed. This cannot be used together with a custom `eval` function.
         * Default: `false`.
         */
        breakEvalOnSigint?: boolean;
    }

    type REPLEval = (this: REPLServer, evalCmd: string, context: Context, file: string, cb: (err: Error | null, result: any) => void) => void;
    type REPLWriter = (this: REPLServer, obj: any) => string;

    /**
     * This is the default "writer" value, if none is passed in the REPL options,
     * and it can be overridden by custom print functions.
     */
    const writer: REPLWriter & { options: InspectOptions };

    type REPLCommandAction = (this: REPLServer, text: string) => void;

    interface REPLCommand {
        /**
         * Help text to be displayed when `.help` is entered.
         */
        help?: string;
        /**
         * The function to execute, optionally accepting a single string argument.
         */
        action: REPLCommandAction;
    }

    /**
     * Provides a customizable Read-Eval-Print-Loop (REPL).
     *
     * Instances of `repl.REPLServer` will accept individual lines of user input, evaluate those
     * according to a user-defined evaluation function, then output the result. Input and output
     * may be from `stdin` and `stdout`, respectively, or may be connected to any Node.js `stream`.
     *
     * Instances of `repl.REPLServer` support automatic completion of inputs, simplistic Emacs-style
     * line editing, multi-line inputs, ANSI-styled output, saving and restoring current REPL session
     * state, error recovery, and customizable evaluation functions.
     *
     * Instances of `repl.REPLServer` are created using the `repl.start()` method and _should not_
     * be created directly using the JavaScript `new` keyword.
     *
     * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_repl
     */
    class REPLServer extends Interface {
        /**
         * The `vm.Context` provided to the `eval` function to be used for JavaScript
         * evaluation.
         */
        readonly context: Context;
        /**
         * The `Readable` stream from which REPL input will be read.
         */
        readonly inputStream: NodeJS.ReadableStream;
        /**
         * The `Writable` stream to which REPL output will be written.
         */
        readonly outputStream: NodeJS.WritableStream;
        /**
         * The commands registered via `replServer.defineCommand()`.
         */
        readonly commands: { readonly [name: string]: REPLCommand | undefined };
        /**
         * A value indicating whether the REPL is currently in "editor mode".
         *
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_commands_and_special_keys
         */
        readonly editorMode: boolean;
        /**
         * A value indicating whether the `_` variable has been assigned.
         *
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_assignment_of_the_underscore_variable
         */
        readonly underscoreAssigned: boolean;
        /**
         * The last evaluation result from the REPL (assigned to the `_` variable inside of the REPL).
         *
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_assignment_of_the_underscore_variable
         */
        readonly last: any;
        /**
         * A value indicating whether the `_error` variable has been assigned.
         *
         * @since v9.8.0
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_assignment_of_the_underscore_variable
         */
        readonly underscoreErrAssigned: boolean;
        /**
         * The last error raised inside the REPL (assigned to the `_error` variable inside of the REPL).
         *
         * @since v9.8.0
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_assignment_of_the_underscore_variable
         */
        readonly lastError: any;
        /**
         * Specified in the REPL options, this is the function to be used when evaluating each
         * given line of input. If not specified in the REPL options, this is an async wrapper
         * for the JavaScript `eval()` function.
         */
        readonly eval: REPLEval;
        /**
         * Specified in the REPL options, this is a value indicating whether the default
         * `writer` function should include ANSI color styling to REPL output.
         */
        readonly useColors: boolean;
        /**
         * Specified in the REPL options, this is a value indicating whether the default `eval`
         * function will use the JavaScript `global` as the context as opposed to creating a new
         * separate context for the REPL instance.
         */
        readonly useGlobal: boolean;
        /**
         * Specified in the REPL options, this is a value indicating whether the default `writer`
         * function should output the result of a command if it evaluates to `undefined`.
         */
        readonly ignoreUndefined: boolean;
        /**
         * Specified in the REPL options, this is the function to invoke to format the output of
         * each command before writing to `outputStream`. If not specified in the REPL options,
         * this will be a wrapper for `util.inspect`.
         */
        readonly writer: REPLWriter;
        /**
         * Specified in the REPL options, this is the function to use for custom Tab auto-completion.
         */
        readonly completer: Completer | AsyncCompleter;
        /**
         * Specified in the REPL options, this is a flag that specifies whether the default `eval`
         * function should execute all JavaScript commands in strict mode or default (sloppy) mode.
         * Possible values are:
         * - `repl.REPL_MODE_SLOPPY` - evaluates expressions in sloppy mode.
         * - `repl.REPL_MODE_STRICT` - evaluates expressions in strict mode. This is equivalent to
         *    prefacing every repl statement with `'use strict'`.
         */
        readonly replMode: typeof REPL_MODE_SLOPPY | typeof REPL_MODE_STRICT;

        /**
         * NOTE: According to the documentation:
         *
         * > Instances of `repl.REPLServer` are created using the `repl.start()` method and
         * > _should not_ be created directly using the JavaScript `new` keyword.
         *
         * `REPLServer` cannot be subclassed due to implementation specifics in NodeJS.
         *
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_class_replserver
         */
        private constructor();

        /**
         * Used to add new `.`-prefixed commands to the REPL instance. Such commands are invoked
         * by typing a `.` followed by the `keyword`.
         *
         * @param keyword The command keyword (_without_ a leading `.` character).
         * @param cmd The function to invoke when the command is processed.
         *
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_replserver_definecommand_keyword_cmd
         */
        defineCommand(keyword: string, cmd: REPLCommandAction | REPLCommand): void;
        /**
         * Readies the REPL instance for input from the user, printing the configured `prompt` to a
         * new line in the `output` and resuming the `input` to accept new input.
         *
         * When multi-line input is being entered, an ellipsis is printed rather than the 'prompt'.
         *
         * This method is primarily intended to be called from within the action function for
         * commands registered using the `replServer.defineCommand()` method.
         *
         * @param preserveCursor When `true`, the cursor placement will not be reset to `0`.
         */
        displayPrompt(preserveCursor?: boolean): void;
        /**
         * Clears any command that has been buffered but not yet executed.
         *
         * This method is primarily intended to be called from within the action function for
         * commands registered using the `replServer.defineCommand()` method.
         *
         * @since v9.0.0
         */
        clearBufferedCommand(): void;

        /**
         * events.EventEmitter
         * 1. close - inherited from `readline.Interface`
         * 2. line - inherited from `readline.Interface`
         * 3. pause - inherited from `readline.Interface`
         * 4. resume - inherited from `readline.Interface`
         * 5. SIGCONT - inherited from `readline.Interface`
         * 6. SIGINT - inherited from `readline.Interface`
         * 7. SIGTSTP - inherited from `readline.Interface`
         * 8. exit
         * 9. reset
         */

        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "close", listener: () => void): this;
        addListener(event: "line", listener: (input: string) => void): this;
        addListener(event: "pause", listener: () => void): this;
        addListener(event: "resume", listener: () => void): this;
        addListener(event: "SIGCONT", listener: () => void): this;
        addListener(event: "SIGINT", listener: () => void): this;
        addListener(event: "SIGTSTP", listener: () => void): this;
        addListener(event: "exit", listener: () => void): this;
        addListener(event: "reset", listener: (context: Context) => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "close"): boolean;
        emit(event: "line", input: string): boolean;
        emit(event: "pause"): boolean;
        emit(event: "resume"): boolean;
        emit(event: "SIGCONT"): boolean;
        emit(event: "SIGINT"): boolean;
        emit(event: "SIGTSTP"): boolean;
        emit(event: "exit"): boolean;
        emit(event: "reset", context: Context): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "close", listener: () => void): this;
        on(event: "line", listener: (input: string) => void): this;
        on(event: "pause", listener: () => void): this;
        on(event: "resume", listener: () => void): this;
        on(event: "SIGCONT", listener: () => void): this;
        on(event: "SIGINT", listener: () => void): this;
        on(event: "SIGTSTP", listener: () => void): this;
        on(event: "exit", listener: () => void): this;
        on(event: "reset", listener: (context: Context) => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "close", listener: () => void): this;
        once(event: "line", listener: (input: string) => void): this;
        once(event: "pause", listener: () => void): this;
        once(event: "resume", listener: () => void): this;
        once(event: "SIGCONT", listener: () => void): this;
        once(event: "SIGINT", listener: () => void): this;
        once(event: "SIGTSTP", listener: () => void): this;
        once(event: "exit", listener: () => void): this;
        once(event: "reset", listener: (context: Context) => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "close", listener: () => void): this;
        prependListener(event: "line", listener: (input: string) => void): this;
        prependListener(event: "pause", listener: () => void): this;
        prependListener(event: "resume", listener: () => void): this;
        prependListener(event: "SIGCONT", listener: () => void): this;
        prependListener(event: "SIGINT", listener: () => void): this;
        prependListener(event: "SIGTSTP", listener: () => void): this;
        prependListener(event: "exit", listener: () => void): this;
        prependListener(event: "reset", listener: (context: Context) => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "close", listener: () => void): this;
        prependOnceListener(event: "line", listener: (input: string) => void): this;
        prependOnceListener(event: "pause", listener: () => void): this;
        prependOnceListener(event: "resume", listener: () => void): this;
        prependOnceListener(event: "SIGCONT", listener: () => void): this;
        prependOnceListener(event: "SIGINT", listener: () => void): this;
        prependOnceListener(event: "SIGTSTP", listener: () => void): this;
        prependOnceListener(event: "exit", listener: () => void): this;
        prependOnceListener(event: "reset", listener: (context: Context) => void): this;
    }

    /**
     * A flag passed in the REPL options. Evaluates expressions in sloppy mode.
     */
    export const REPL_MODE_SLOPPY: symbol; // TODO: unique symbol

    /**
     * A flag passed in the REPL options. Evaluates expressions in strict mode.
     * This is equivalent to prefacing every repl statement with `'use strict'`.
     */
    export const REPL_MODE_STRICT: symbol; // TODO: unique symbol

    /**
     * Creates and starts a `repl.REPLServer` instance.
     *
     * @param options The options for the `REPLServer`. If `options` is a string, then it specifies
     * the input prompt.
     */
    function start(options?: string | ReplOptions): REPLServer;

    /**
     * Indicates a recoverable error that a `REPLServer` can use to support multi-line input.
     *
     * @see https://nodejs.org/dist/latest-v10.x/docs/api/repl.html#repl_recoverable_errors
     */
    class Recoverable extends SyntaxError {
        err: Error;

        constructor(err: Error);
    }
}

declare module "readline" {
    import * as events from "events";
    import * as stream from "stream";

    interface Key {
        sequence?: string;
        name?: string;
        ctrl?: boolean;
        meta?: boolean;
        shift?: boolean;
    }

    class Interface extends events.EventEmitter {
        readonly terminal: boolean;

        /**
         * NOTE: According to the documentation:
         *
         * > Instances of the `readline.Interface` class are constructed using the
         * > `readline.createInterface()` method.
         *
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/readline.html#readline_class_interface
         */
        protected constructor(input: NodeJS.ReadableStream, output?: NodeJS.WritableStream, completer?: Completer | AsyncCompleter, terminal?: boolean);
        /**
         * NOTE: According to the documentation:
         *
         * > Instances of the `readline.Interface` class are constructed using the
         * > `readline.createInterface()` method.
         *
         * @see https://nodejs.org/dist/latest-v10.x/docs/api/readline.html#readline_class_interface
         */
        protected constructor(options: ReadLineOptions);

        setPrompt(prompt: string): void;
        prompt(preserveCursor?: boolean): void;
        question(query: string, callback: (answer: string) => void): void;
        pause(): this;
        resume(): this;
        close(): void;
        write(data: string | Buffer, key?: Key): void;

        /**
         * events.EventEmitter
         * 1. close
         * 2. line
         * 3. pause
         * 4. resume
         * 5. SIGCONT
         * 6. SIGINT
         * 7. SIGTSTP
         */

        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "close", listener: () => void): this;
        addListener(event: "line", listener: (input: string) => void): this;
        addListener(event: "pause", listener: () => void): this;
        addListener(event: "resume", listener: () => void): this;
        addListener(event: "SIGCONT", listener: () => void): this;
        addListener(event: "SIGINT", listener: () => void): this;
        addListener(event: "SIGTSTP", listener: () => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "close"): boolean;
        emit(event: "line", input: string): boolean;
        emit(event: "pause"): boolean;
        emit(event: "resume"): boolean;
        emit(event: "SIGCONT"): boolean;
        emit(event: "SIGINT"): boolean;
        emit(event: "SIGTSTP"): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "close", listener: () => void): this;
        on(event: "line", listener: (input: string) => void): this;
        on(event: "pause", listener: () => void): this;
        on(event: "resume", listener: () => void): this;
        on(event: "SIGCONT", listener: () => void): this;
        on(event: "SIGINT", listener: () => void): this;
        on(event: "SIGTSTP", listener: () => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "close", listener: () => void): this;
        once(event: "line", listener: (input: string) => void): this;
        once(event: "pause", listener: () => void): this;
        once(event: "resume", listener: () => void): this;
        once(event: "SIGCONT", listener: () => void): this;
        once(event: "SIGINT", listener: () => void): this;
        once(event: "SIGTSTP", listener: () => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "close", listener: () => void): this;
        prependListener(event: "line", listener: (input: string) => void): this;
        prependListener(event: "pause", listener: () => void): this;
        prependListener(event: "resume", listener: () => void): this;
        prependListener(event: "SIGCONT", listener: () => void): this;
        prependListener(event: "SIGINT", listener: () => void): this;
        prependListener(event: "SIGTSTP", listener: () => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "close", listener: () => void): this;
        prependOnceListener(event: "line", listener: (input: string) => void): this;
        prependOnceListener(event: "pause", listener: () => void): this;
        prependOnceListener(event: "resume", listener: () => void): this;
        prependOnceListener(event: "SIGCONT", listener: () => void): this;
        prependOnceListener(event: "SIGINT", listener: () => void): this;
        prependOnceListener(event: "SIGTSTP", listener: () => void): this;
    }

    type ReadLine = Interface; // type forwarded for backwards compatiblity

    type Completer = (line: string) => CompleterResult;
    type AsyncCompleter = (line: string, callback: (err: any, result: CompleterResult) => void) => any;

    type CompleterResult = [string[], string];

    interface ReadLineOptions {
        input: NodeJS.ReadableStream;
        output?: NodeJS.WritableStream;
        completer?: Completer | AsyncCompleter;
        terminal?: boolean;
        historySize?: number;
        prompt?: string;
        crlfDelay?: number;
        removeHistoryDuplicates?: boolean;
    }

    function createInterface(input: NodeJS.ReadableStream, output?: NodeJS.WritableStream, completer?: Completer | AsyncCompleter, terminal?: boolean): Interface;
    function createInterface(options: ReadLineOptions): Interface;

    function cursorTo(stream: NodeJS.WritableStream, x: number, y?: number): void;
    function emitKeypressEvents(stream: NodeJS.ReadableStream, interface?: Interface): void;
    function moveCursor(stream: NodeJS.WritableStream, dx: number | string, dy: number | string): void;
    function clearLine(stream: NodeJS.WritableStream, dir: number): void;
    function clearScreenDown(stream: NodeJS.WritableStream): void;
}

declare module "vm" {
    interface Context {
        [key: string]: any;
    }
    interface BaseOptions {
        /**
         * Specifies the filename used in stack traces produced by this script.
         * Default: `''`.
         */
        filename?: string;
        /**
         * Specifies the line number offset that is displayed in stack traces produced by this script.
         * Default: `0`.
         */
        lineOffset?: number;
        /**
         * Specifies the column number offset that is displayed in stack traces produced by this script.
         * Default: `0`
         */
        columnOffset?: number;
    }
    interface ScriptOptions extends BaseOptions {
        displayErrors?: boolean;
        timeout?: number;
        cachedData?: Buffer;
        produceCachedData?: boolean;
    }
    interface RunningScriptOptions extends BaseOptions {
        displayErrors?: boolean;
        timeout?: number;
    }
    interface CompileFunctionOptions extends BaseOptions {
        /**
         * Provides an optional data with V8's code cache data for the supplied source.
         */
        cachedData?: Buffer;
        /**
         * Specifies whether to produce new cache data.
         * Default: `false`,
         */
        produceCachedData?: boolean;
        /**
         * The sandbox/context in which the said function should be compiled in.
         */
        parsingContext?: Context;

        /**
         * An array containing a collection of context extensions (objects wrapping the current scope) to be applied while compiling
         */
        contextExtensions?: Object[];
    }
    class Script {
        constructor(code: string, options?: ScriptOptions);
        runInContext(contextifiedSandbox: Context, options?: RunningScriptOptions): any;
        runInNewContext(sandbox?: Context, options?: RunningScriptOptions): any;
        runInThisContext(options?: RunningScriptOptions): any;
    }
    function createContext(sandbox?: Context): Context;
    function isContext(sandbox: Context): boolean;
    function runInContext(code: string, contextifiedSandbox: Context, options?: RunningScriptOptions | string): any;
    function runInNewContext(code: string, sandbox?: Context, options?: RunningScriptOptions | string): any;
    function runInThisContext(code: string, options?: RunningScriptOptions | string): any;
    function compileFunction(code: string, params: string[], options: CompileFunctionOptions): Function;
}

declare module "child_process" {
    import * as events from "events";
    import * as stream from "stream";
    import * as net from "net";

    interface ChildProcess extends events.EventEmitter {
        stdin: stream.Writable;
        stdout: stream.Readable;
        stderr: stream.Readable;
        stdio: [stream.Writable, stream.Readable, stream.Readable];
        killed: boolean;
        pid: number;
        kill(signal?: string): void;
        send(message: any, callback?: (error: Error) => void): boolean;
        send(message: any, sendHandle?: net.Socket | net.Server, callback?: (error: Error) => void): boolean;
        send(message: any, sendHandle?: net.Socket | net.Server, options?: MessageOptions, callback?: (error: Error) => void): boolean;
        connected: boolean;
        disconnect(): void;
        unref(): void;
        ref(): void;

        /**
         * events.EventEmitter
         * 1. close
         * 2. disconnect
         * 3. error
         * 4. exit
         * 5. message
         */

        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "close", listener: (code: number, signal: string) => void): this;
        addListener(event: "disconnect", listener: () => void): this;
        addListener(event: "error", listener: (err: Error) => void): this;
        addListener(event: "exit", listener: (code: number | null, signal: string | null) => void): this;
        addListener(event: "message", listener: (message: any, sendHandle: net.Socket | net.Server) => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "close", code: number, signal: string): boolean;
        emit(event: "disconnect"): boolean;
        emit(event: "error", err: Error): boolean;
        emit(event: "exit", code: number | null, signal: string | null): boolean;
        emit(event: "message", message: any, sendHandle: net.Socket | net.Server): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "close", listener: (code: number, signal: string) => void): this;
        on(event: "disconnect", listener: () => void): this;
        on(event: "error", listener: (err: Error) => void): this;
        on(event: "exit", listener: (code: number | null, signal: string | null) => void): this;
        on(event: "message", listener: (message: any, sendHandle: net.Socket | net.Server) => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "close", listener: (code: number, signal: string) => void): this;
        once(event: "disconnect", listener: () => void): this;
        once(event: "error", listener: (err: Error) => void): this;
        once(event: "exit", listener: (code: number | null, signal: string | null) => void): this;
        once(event: "message", listener: (message: any, sendHandle: net.Socket | net.Server) => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "close", listener: (code: number, signal: string) => void): this;
        prependListener(event: "disconnect", listener: () => void): this;
        prependListener(event: "error", listener: (err: Error) => void): this;
        prependListener(event: "exit", listener: (code: number | null, signal: string | null) => void): this;
        prependListener(event: "message", listener: (message: any, sendHandle: net.Socket | net.Server) => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "close", listener: (code: number, signal: string) => void): this;
        prependOnceListener(event: "disconnect", listener: () => void): this;
        prependOnceListener(event: "error", listener: (err: Error) => void): this;
        prependOnceListener(event: "exit", listener: (code: number | null, signal: string | null) => void): this;
        prependOnceListener(event: "message", listener: (message: any, sendHandle: net.Socket | net.Server) => void): this;
    }

    interface MessageOptions {
        keepOpen?: boolean;
    }

    type StdioOptions = "pipe" | "ignore" | "inherit" | Array<("pipe" | "ipc" | "ignore" | "inherit" | stream.Stream | number | null | undefined)>;

    interface SpawnOptions {
        cwd?: string;
        env?: NodeJS.ProcessEnv;
        argv0?: string;
        stdio?: StdioOptions;
        detached?: boolean;
        uid?: number;
        gid?: number;
        shell?: boolean | string;
        windowsVerbatimArguments?: boolean;
        windowsHide?: boolean;
    }

    function spawn(command: string, options?: SpawnOptions): ChildProcess;
    function spawn(command: string, args?: ReadonlyArray<string>, options?: SpawnOptions): ChildProcess;

    interface ExecOptions {
        cwd?: string;
        env?: NodeJS.ProcessEnv;
        shell?: string;
        timeout?: number;
        maxBuffer?: number;
        killSignal?: string;
        uid?: number;
        gid?: number;
        windowsHide?: boolean;
    }

    interface ExecOptionsWithStringEncoding extends ExecOptions {
        encoding: BufferEncoding;
    }

    interface ExecOptionsWithBufferEncoding extends ExecOptions {
        encoding: string | null; // specify `null`.
    }

    interface ExecException extends Error {
        cmd?: string;
        killed?: boolean;
        code?: number;
        signal?: string;
    }

    // no `options` definitely means stdout/stderr are `string`.
    function exec(command: string, callback?: (error: ExecException | null, stdout: string, stderr: string) => void): ChildProcess;

    // `options` with `"buffer"` or `null` for `encoding` means stdout/stderr are definitely `Buffer`.
    function exec(command: string, options: { encoding: "buffer" | null } & ExecOptions, callback?: (error: ExecException | null, stdout: Buffer, stderr: Buffer) => void): ChildProcess;

    // `options` with well known `encoding` means stdout/stderr are definitely `string`.
    function exec(command: string, options: { encoding: BufferEncoding } & ExecOptions, callback?: (error: ExecException | null, stdout: string, stderr: string) => void): ChildProcess;

    // `options` with an `encoding` whose type is `string` means stdout/stderr could either be `Buffer` or `string`.
    // There is no guarantee the `encoding` is unknown as `string` is a superset of `BufferEncoding`.
    function exec(command: string, options: { encoding: string } & ExecOptions, callback?: (error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void): ChildProcess;

    // `options` without an `encoding` means stdout/stderr are definitely `string`.
    function exec(command: string, options: ExecOptions, callback?: (error: ExecException | null, stdout: string, stderr: string) => void): ChildProcess;

    // fallback if nothing else matches. Worst case is always `string | Buffer`.
    function exec(
        command: string,
        options: ({ encoding?: string | null } & ExecOptions) | undefined | null,
        callback?: (error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void,
    ): ChildProcess;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace exec {
        function __promisify__(command: string): Promise<{ stdout: string, stderr: string }>;
        function __promisify__(command: string, options: { encoding: "buffer" | null } & ExecOptions): Promise<{ stdout: Buffer, stderr: Buffer }>;
        function __promisify__(command: string, options: { encoding: BufferEncoding } & ExecOptions): Promise<{ stdout: string, stderr: string }>;
        function __promisify__(command: string, options: ExecOptions): Promise<{ stdout: string, stderr: string }>;
        function __promisify__(command: string, options?: ({ encoding?: string | null } & ExecOptions) | null): Promise<{ stdout: string | Buffer, stderr: string | Buffer }>;
    }

    interface ExecFileOptions {
        cwd?: string;
        env?: NodeJS.ProcessEnv;
        timeout?: number;
        maxBuffer?: number;
        killSignal?: string;
        uid?: number;
        gid?: number;
        windowsHide?: boolean;
        windowsVerbatimArguments?: boolean;
    }
    interface ExecFileOptionsWithStringEncoding extends ExecFileOptions {
        encoding: BufferEncoding;
    }
    interface ExecFileOptionsWithBufferEncoding extends ExecFileOptions {
        encoding: 'buffer' | null;
    }
    interface ExecFileOptionsWithOtherEncoding extends ExecFileOptions {
        encoding: string;
    }

    function execFile(file: string): ChildProcess;
    function execFile(file: string, options: ({ encoding?: string | null } & ExecFileOptions) | undefined | null): ChildProcess;
    function execFile(file: string, args?: ReadonlyArray<string> | null): ChildProcess;
    function execFile(file: string, args: ReadonlyArray<string> | undefined | null, options: ({ encoding?: string | null } & ExecFileOptions) | undefined | null): ChildProcess;

    // no `options` definitely means stdout/stderr are `string`.
    function execFile(file: string, callback: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
    function execFile(file: string, args: ReadonlyArray<string> | undefined | null, callback: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;

    // `options` with `"buffer"` or `null` for `encoding` means stdout/stderr are definitely `Buffer`.
    function execFile(file: string, options: ExecFileOptionsWithBufferEncoding, callback: (error: Error | null, stdout: Buffer, stderr: Buffer) => void): ChildProcess;
    function execFile(
        file: string,
        args: ReadonlyArray<string> | undefined | null,
        options: ExecFileOptionsWithBufferEncoding,
        callback: (error: Error | null, stdout: Buffer, stderr: Buffer) => void,
    ): ChildProcess;

    // `options` with well known `encoding` means stdout/stderr are definitely `string`.
    function execFile(file: string, options: ExecFileOptionsWithStringEncoding, callback: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
    function execFile(
        file: string,
        args: ReadonlyArray<string> | undefined | null,
        options: ExecFileOptionsWithStringEncoding,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
    ): ChildProcess;

    // `options` with an `encoding` whose type is `string` means stdout/stderr could either be `Buffer` or `string`.
    // There is no guarantee the `encoding` is unknown as `string` is a superset of `BufferEncoding`.
    function execFile(
        file: string,
        options: ExecFileOptionsWithOtherEncoding,
        callback: (error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void,
    ): ChildProcess;
    function execFile(
        file: string,
        args: ReadonlyArray<string> | undefined | null,
        options: ExecFileOptionsWithOtherEncoding,
        callback: (error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void,
    ): ChildProcess;

    // `options` without an `encoding` means stdout/stderr are definitely `string`.
    function execFile(file: string, options: ExecFileOptions, callback: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
    function execFile(file: string, args: ReadonlyArray<string> | undefined | null, options: ExecFileOptions, callback: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;

    // fallback if nothing else matches. Worst case is always `string | Buffer`.
    function execFile(
        file: string,
        options: ({ encoding?: string | null } & ExecFileOptions) | undefined | null,
        callback: ((error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void) | undefined | null,
    ): ChildProcess;
    function execFile(
        file: string,
        args: ReadonlyArray<string> | undefined | null,
        options: ({ encoding?: string | null } & ExecFileOptions) | undefined | null,
        callback: ((error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void) | undefined | null,
    ): ChildProcess;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace execFile {
        function __promisify__(file: string): Promise<{ stdout: string, stderr: string }>;
        function __promisify__(file: string, args: string[] | undefined | null): Promise<{ stdout: string, stderr: string }>;
        function __promisify__(file: string, options: ExecFileOptionsWithBufferEncoding): Promise<{ stdout: Buffer, stderr: Buffer }>;
        function __promisify__(file: string, args: string[] | undefined | null, options: ExecFileOptionsWithBufferEncoding): Promise<{ stdout: Buffer, stderr: Buffer }>;
        function __promisify__(file: string, options: ExecFileOptionsWithStringEncoding): Promise<{ stdout: string, stderr: string }>;
        function __promisify__(file: string, args: string[] | undefined | null, options: ExecFileOptionsWithStringEncoding): Promise<{ stdout: string, stderr: string }>;
        function __promisify__(file: string, options: ExecFileOptionsWithOtherEncoding): Promise<{ stdout: string | Buffer, stderr: string | Buffer }>;
        function __promisify__(file: string, args: string[] | undefined | null, options: ExecFileOptionsWithOtherEncoding): Promise<{ stdout: string | Buffer, stderr: string | Buffer }>;
        function __promisify__(file: string, options: ExecFileOptions): Promise<{ stdout: string, stderr: string }>;
        function __promisify__(file: string, args: string[] | undefined | null, options: ExecFileOptions): Promise<{ stdout: string, stderr: string }>;
        function __promisify__(file: string, options: ({ encoding?: string | null } & ExecFileOptions) | undefined | null): Promise<{ stdout: string | Buffer, stderr: string | Buffer }>;
        function __promisify__(
            file: string,
            args: string[] | undefined | null,
            options: ({ encoding?: string | null } & ExecFileOptions) | undefined | null,
        ): Promise<{ stdout: string | Buffer, stderr: string | Buffer }>;
    }

    interface ForkOptions {
        cwd?: string;
        env?: NodeJS.ProcessEnv;
        execPath?: string;
        execArgv?: string[];
        silent?: boolean;
        stdio?: StdioOptions;
        windowsVerbatimArguments?: boolean;
        uid?: number;
        gid?: number;
    }
    function fork(modulePath: string, args?: ReadonlyArray<string>, options?: ForkOptions): ChildProcess;

    interface SpawnSyncOptions {
        argv0?: string; // Not specified in the docs
        cwd?: string;
        input?: string | Buffer | NodeJS.TypedArray | DataView;
        stdio?: StdioOptions;
        env?: NodeJS.ProcessEnv;
        uid?: number;
        gid?: number;
        timeout?: number;
        killSignal?: string | number;
        maxBuffer?: number;
        encoding?: string;
        shell?: boolean | string;
        windowsVerbatimArguments?: boolean;
        windowsHide?: boolean;
    }
    interface SpawnSyncOptionsWithStringEncoding extends SpawnSyncOptions {
        encoding: BufferEncoding;
    }
    interface SpawnSyncOptionsWithBufferEncoding extends SpawnSyncOptions {
        encoding: string; // specify `null`.
    }
    interface SpawnSyncReturns<T> {
        pid: number;
        output: string[];
        stdout: T;
        stderr: T;
        status: number;
        signal: string;
        error: Error;
    }
    function spawnSync(command: string): SpawnSyncReturns<Buffer>;
    function spawnSync(command: string, options?: SpawnSyncOptionsWithStringEncoding): SpawnSyncReturns<string>;
    function spawnSync(command: string, options?: SpawnSyncOptionsWithBufferEncoding): SpawnSyncReturns<Buffer>;
    function spawnSync(command: string, options?: SpawnSyncOptions): SpawnSyncReturns<Buffer>;
    function spawnSync(command: string, args?: ReadonlyArray<string>, options?: SpawnSyncOptionsWithStringEncoding): SpawnSyncReturns<string>;
    function spawnSync(command: string, args?: ReadonlyArray<string>, options?: SpawnSyncOptionsWithBufferEncoding): SpawnSyncReturns<Buffer>;
    function spawnSync(command: string, args?: ReadonlyArray<string>, options?: SpawnSyncOptions): SpawnSyncReturns<Buffer>;

    interface ExecSyncOptions {
        cwd?: string;
        input?: string | Buffer | Uint8Array;
        stdio?: StdioOptions;
        env?: NodeJS.ProcessEnv;
        shell?: string;
        uid?: number;
        gid?: number;
        timeout?: number;
        killSignal?: string | number;
        maxBuffer?: number;
        encoding?: string;
        windowsHide?: boolean;
    }
    interface ExecSyncOptionsWithStringEncoding extends ExecSyncOptions {
        encoding: BufferEncoding;
    }
    interface ExecSyncOptionsWithBufferEncoding extends ExecSyncOptions {
        encoding: string; // specify `null`.
    }
    function execSync(command: string): Buffer;
    function execSync(command: string, options?: ExecSyncOptionsWithStringEncoding): string;
    function execSync(command: string, options?: ExecSyncOptionsWithBufferEncoding): Buffer;
    function execSync(command: string, options?: ExecSyncOptions): Buffer;

    interface ExecFileSyncOptions {
        cwd?: string;
        input?: string | Buffer | NodeJS.TypedArray | DataView;
        stdio?: StdioOptions;
        env?: NodeJS.ProcessEnv;
        uid?: number;
        gid?: number;
        timeout?: number;
        killSignal?: string | number;
        maxBuffer?: number;
        encoding?: string;
        windowsHide?: boolean;
        shell?: boolean | string;
    }
    interface ExecFileSyncOptionsWithStringEncoding extends ExecFileSyncOptions {
        encoding: BufferEncoding;
    }
    interface ExecFileSyncOptionsWithBufferEncoding extends ExecFileSyncOptions {
        encoding: string; // specify `null`.
    }
    function execFileSync(command: string): Buffer;
    function execFileSync(command: string, options?: ExecFileSyncOptionsWithStringEncoding): string;
    function execFileSync(command: string, options?: ExecFileSyncOptionsWithBufferEncoding): Buffer;
    function execFileSync(command: string, options?: ExecFileSyncOptions): Buffer;
    function execFileSync(command: string, args?: ReadonlyArray<string>, options?: ExecFileSyncOptionsWithStringEncoding): string;
    function execFileSync(command: string, args?: ReadonlyArray<string>, options?: ExecFileSyncOptionsWithBufferEncoding): Buffer;
    function execFileSync(command: string, args?: ReadonlyArray<string>, options?: ExecFileSyncOptions): Buffer;
}

declare module "url" {
    import { ParsedUrlQuery } from 'querystring';

    interface UrlObjectCommon {
        auth?: string;
        hash?: string;
        host?: string;
        hostname?: string;
        href?: string;
        path?: string;
        pathname?: string;
        protocol?: string;
        search?: string;
        slashes?: boolean;
    }

    // Input to `url.format`
    interface UrlObject extends UrlObjectCommon {
        port?: string | number;
        query?: string | null | { [key: string]: any };
    }

    // Output of `url.parse`
    interface Url extends UrlObjectCommon {
        port?: string;
        query?: string | null | ParsedUrlQuery;
    }

    interface UrlWithParsedQuery extends Url {
        query: ParsedUrlQuery;
    }

    interface UrlWithStringQuery extends Url {
        query: string | null;
    }

    function parse(urlStr: string): UrlWithStringQuery;
    function parse(urlStr: string, parseQueryString: false | undefined, slashesDenoteHost?: boolean): UrlWithStringQuery;
    function parse(urlStr: string, parseQueryString: true, slashesDenoteHost?: boolean): UrlWithParsedQuery;
    function parse(urlStr: string, parseQueryString: boolean, slashesDenoteHost?: boolean): Url;

    function format(URL: URL, options?: URLFormatOptions): string;
    function format(urlObject: UrlObject | string): string;
    function resolve(from: string, to: string): string;

    function domainToASCII(domain: string): string;
    function domainToUnicode(domain: string): string;

    /**
     * This function ensures the correct decodings of percent-encoded characters as
     * well as ensuring a cross-platform valid absolute path string.
     * @param url The file URL string or URL object to convert to a path.
     */
    function fileURLToPath(url: string | URL): string;

    /**
     * This function ensures that path is resolved absolutely, and that the URL
     * control characters are correctly encoded when converting into a File URL.
     * @param url The path to convert to a File URL.
     */
    function pathToFileURL(url: string): URL;

    interface URLFormatOptions {
        auth?: boolean;
        fragment?: boolean;
        search?: boolean;
        unicode?: boolean;
    }

    class URL {
        constructor(input: string, base?: string | URL);
        hash: string;
        host: string;
        hostname: string;
        href: string;
        readonly origin: string;
        password: string;
        pathname: string;
        port: string;
        protocol: string;
        search: string;
        readonly searchParams: URLSearchParams;
        username: string;
        toString(): string;
        toJSON(): string;
    }

    class URLSearchParams implements Iterable<[string, string]> {
        constructor(init?: URLSearchParams | string | { [key: string]: string | string[] | undefined } | Iterable<[string, string]> | Array<[string, string]>);
        append(name: string, value: string): void;
        delete(name: string): void;
        entries(): IterableIterator<[string, string]>;
        forEach(callback: (value: string, name: string, searchParams: this) => void): void;
        get(name: string): string | null;
        getAll(name: string): string[];
        has(name: string): boolean;
        keys(): IterableIterator<string>;
        set(name: string, value: string): void;
        sort(): void;
        toString(): string;
        values(): IterableIterator<string>;
        [Symbol.iterator](): IterableIterator<[string, string]>;
    }
}

declare module "dns" {
    // Supported getaddrinfo flags.
    const ADDRCONFIG: number;
    const V4MAPPED: number;

    interface LookupOptions {
        family?: number;
        hints?: number;
        all?: boolean;
        verbatim?: boolean;
    }

    interface LookupOneOptions extends LookupOptions {
        all?: false;
    }

    interface LookupAllOptions extends LookupOptions {
        all: true;
    }

    interface LookupAddress {
        address: string;
        family: number;
    }

    function lookup(hostname: string, family: number, callback: (err: NodeJS.ErrnoException, address: string, family: number) => void): void;
    function lookup(hostname: string, options: LookupOneOptions, callback: (err: NodeJS.ErrnoException, address: string, family: number) => void): void;
    function lookup(hostname: string, options: LookupAllOptions, callback: (err: NodeJS.ErrnoException, addresses: LookupAddress[]) => void): void;
    function lookup(hostname: string, options: LookupOptions, callback: (err: NodeJS.ErrnoException, address: string | LookupAddress[], family: number) => void): void;
    function lookup(hostname: string, callback: (err: NodeJS.ErrnoException, address: string, family: number) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace lookup {
        function __promisify__(hostname: string, options: LookupAllOptions): Promise<{ address: LookupAddress[] }>;
        function __promisify__(hostname: string, options?: LookupOneOptions | number): Promise<{ address: string, family: number }>;
        function __promisify__(hostname: string, options?: LookupOptions | number): Promise<{ address: string | LookupAddress[], family?: number }>;
    }

    function lookupService(address: string, port: number, callback: (err: NodeJS.ErrnoException, hostname: string, service: string) => void): void;

    namespace lookupService {
        function __promisify__(address: string, port: number): Promise<{ hostname: string, service: string }>;
    }

    interface ResolveOptions {
        ttl: boolean;
    }

    interface ResolveWithTtlOptions extends ResolveOptions {
        ttl: true;
    }

    interface RecordWithTtl {
        address: string;
        ttl: number;
    }

    /** @deprecated Use AnyARecord or AnyAaaaRecord instead. */
    type AnyRecordWithTtl = AnyARecord | AnyAaaaRecord;

    interface AnyARecord extends RecordWithTtl {
        type: "A";
    }

    interface AnyAaaaRecord extends RecordWithTtl {
        type: "AAAA";
    }

    interface MxRecord {
        priority: number;
        exchange: string;
    }

    interface AnyMxRecord extends MxRecord {
        type: "MX";
    }

    interface NaptrRecord {
        flags: string;
        service: string;
        regexp: string;
        replacement: string;
        order: number;
        preference: number;
    }

    interface AnyNaptrRecord extends NaptrRecord {
        type: "NAPTR";
    }

    interface SoaRecord {
        nsname: string;
        hostmaster: string;
        serial: number;
        refresh: number;
        retry: number;
        expire: number;
        minttl: number;
    }

    interface AnySoaRecord extends SoaRecord {
        type: "SOA";
    }

    interface SrvRecord {
        priority: number;
        weight: number;
        port: number;
        name: string;
    }

    interface AnySrvRecord extends SrvRecord {
        type: "SRV";
    }

    interface AnyTxtRecord {
        type: "TXT";
        entries: string[];
    }

    interface AnyNsRecord {
        type: "NS";
        value: string;
    }

    interface AnyPtrRecord {
        type: "PTR";
        value: string;
    }

    interface AnyCnameRecord {
        type: "CNAME";
        value: string;
    }

    type AnyRecord = AnyARecord |
        AnyAaaaRecord |
        AnyCnameRecord |
        AnyMxRecord |
        AnyNaptrRecord |
        AnyNsRecord |
        AnyPtrRecord |
        AnySoaRecord |
        AnySrvRecord |
        AnyTxtRecord;

    function resolve(hostname: string, callback: (err: NodeJS.ErrnoException, addresses: string[]) => void): void;
    function resolve(hostname: string, rrtype: "A", callback: (err: NodeJS.ErrnoException, addresses: string[]) => void): void;
    function resolve(hostname: string, rrtype: "AAAA", callback: (err: NodeJS.ErrnoException, addresses: string[]) => void): void;
    function resolve(hostname: string, rrtype: "ANY", callback: (err: NodeJS.ErrnoException, addresses: AnyRecord[]) => void): void;
    function resolve(hostname: string, rrtype: "CNAME", callback: (err: NodeJS.ErrnoException, addresses: string[]) => void): void;
    function resolve(hostname: string, rrtype: "MX", callback: (err: NodeJS.ErrnoException, addresses: MxRecord[]) => void): void;
    function resolve(hostname: string, rrtype: "NAPTR", callback: (err: NodeJS.ErrnoException, addresses: NaptrRecord[]) => void): void;
    function resolve(hostname: string, rrtype: "NS", callback: (err: NodeJS.ErrnoException, addresses: string[]) => void): void;
    function resolve(hostname: string, rrtype: "PTR", callback: (err: NodeJS.ErrnoException, addresses: string[]) => void): void;
    function resolve(hostname: string, rrtype: "SOA", callback: (err: NodeJS.ErrnoException, addresses: SoaRecord) => void): void;
    function resolve(hostname: string, rrtype: "SRV", callback: (err: NodeJS.ErrnoException, addresses: SrvRecord[]) => void): void;
    function resolve(hostname: string, rrtype: "TXT", callback: (err: NodeJS.ErrnoException, addresses: string[][]) => void): void;
    function resolve(
        hostname: string,
        rrtype: string,
        callback: (err: NodeJS.ErrnoException, addresses: string[] | MxRecord[] | NaptrRecord[] | SoaRecord | SrvRecord[] | string[][] | AnyRecord[]) => void,
    ): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace resolve {
        function __promisify__(hostname: string, rrtype?: "A" | "AAAA" | "CNAME" | "NS" | "PTR"): Promise<string[]>;
        function __promisify__(hostname: string, rrtype: "ANY"): Promise<AnyRecord[]>;
        function __promisify__(hostname: string, rrtype: "MX"): Promise<MxRecord[]>;
        function __promisify__(hostname: string, rrtype: "NAPTR"): Promise<NaptrRecord[]>;
        function __promisify__(hostname: string, rrtype: "SOA"): Promise<SoaRecord>;
        function __promisify__(hostname: string, rrtype: "SRV"): Promise<SrvRecord[]>;
        function __promisify__(hostname: string, rrtype: "TXT"): Promise<string[][]>;
        function __promisify__(hostname: string, rrtype: string): Promise<string[] | MxRecord[] | NaptrRecord[] | SoaRecord | SrvRecord[] | string[][] | AnyRecord[]>;
    }

    function resolve4(hostname: string, callback: (err: NodeJS.ErrnoException, addresses: string[]) => void): void;
    function resolve4(hostname: string, options: ResolveWithTtlOptions, callback: (err: NodeJS.ErrnoException, addresses: RecordWithTtl[]) => void): void;
    function resolve4(hostname: string, options: ResolveOptions, callback: (err: NodeJS.ErrnoException, addresses: string[] | RecordWithTtl[]) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace resolve4 {
        function __promisify__(hostname: string): Promise<string[]>;
        function __promisify__(hostname: string, options: ResolveWithTtlOptions): Promise<RecordWithTtl[]>;
        function __promisify__(hostname: string, options?: ResolveOptions): Promise<string[] | RecordWithTtl[]>;
    }

    function resolve6(hostname: string, callback: (err: NodeJS.ErrnoException, addresses: string[]) => void): void;
    function resolve6(hostname: string, options: ResolveWithTtlOptions, callback: (err: NodeJS.ErrnoException, addresses: RecordWithTtl[]) => void): void;
    function resolve6(hostname: string, options: ResolveOptions, callback: (err: NodeJS.ErrnoException, addresses: string[] | RecordWithTtl[]) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace resolve6 {
        function __promisify__(hostname: string): Promise<string[]>;
        function __promisify__(hostname: string, options: ResolveWithTtlOptions): Promise<RecordWithTtl[]>;
        function __promisify__(hostname: string, options?: ResolveOptions): Promise<string[] | RecordWithTtl[]>;
    }

    function resolveCname(hostname: string, callback: (err: NodeJS.ErrnoException, addresses: string[]) => void): void;
    namespace resolveCname {
        function __promisify__(hostname: string): Promise<string[]>;
    }

    function resolveMx(hostname: string, callback: (err: NodeJS.ErrnoException, addresses: MxRecord[]) => void): void;
    namespace resolveMx {
        function __promisify__(hostname: string): Promise<MxRecord[]>;
    }

    function resolveNaptr(hostname: string, callback: (err: NodeJS.ErrnoException, addresses: NaptrRecord[]) => void): void;
    namespace resolveNaptr {
        function __promisify__(hostname: string): Promise<NaptrRecord[]>;
    }

    function resolveNs(hostname: string, callback: (err: NodeJS.ErrnoException, addresses: string[]) => void): void;
    namespace resolveNs {
        function __promisify__(hostname: string): Promise<string[]>;
    }

    function resolvePtr(hostname: string, callback: (err: NodeJS.ErrnoException, addresses: string[]) => void): void;
    namespace resolvePtr {
        function __promisify__(hostname: string): Promise<string[]>;
    }

    function resolveSoa(hostname: string, callback: (err: NodeJS.ErrnoException, address: SoaRecord) => void): void;
    namespace resolveSoa {
        function __promisify__(hostname: string): Promise<SoaRecord>;
    }

    function resolveSrv(hostname: string, callback: (err: NodeJS.ErrnoException, addresses: SrvRecord[]) => void): void;
    namespace resolveSrv {
        function __promisify__(hostname: string): Promise<SrvRecord[]>;
    }

    function resolveTxt(hostname: string, callback: (err: NodeJS.ErrnoException, addresses: string[][]) => void): void;
    namespace resolveTxt {
        function __promisify__(hostname: string): Promise<string[][]>;
    }

    function resolveAny(hostname: string, callback: (err: NodeJS.ErrnoException, addresses: AnyRecord[]) => void): void;
    namespace resolveAny {
        function __promisify__(hostname: string): Promise<AnyRecord[]>;
    }

    function reverse(ip: string, callback: (err: NodeJS.ErrnoException, hostnames: string[]) => void): void;
    function setServers(servers: string[]): void;
    function getServers(): string[];

    // Error codes
    const NODATA: string;
    const FORMERR: string;
    const SERVFAIL: string;
    const NOTFOUND: string;
    const NOTIMP: string;
    const REFUSED: string;
    const BADQUERY: string;
    const BADNAME: string;
    const BADFAMILY: string;
    const BADRESP: string;
    const CONNREFUSED: string;
    const TIMEOUT: string;
    const EOF: string;
    const FILE: string;
    const NOMEM: string;
    const DESTRUCTION: string;
    const BADSTR: string;
    const BADFLAGS: string;
    const NONAME: string;
    const BADHINTS: string;
    const NOTINITIALIZED: string;
    const LOADIPHLPAPI: string;
    const ADDRGETNETWORKPARAMS: string;
    const CANCELLED: string;

    class Resolver {
        getServers: typeof getServers;
        setServers: typeof setServers;
        resolve: typeof resolve;
        resolve4: typeof resolve4;
        resolve6: typeof resolve6;
        resolveAny: typeof resolveAny;
        resolveCname: typeof resolveCname;
        resolveMx: typeof resolveMx;
        resolveNaptr: typeof resolveNaptr;
        resolveNs: typeof resolveNs;
        resolvePtr: typeof resolvePtr;
        resolveSoa: typeof resolveSoa;
        resolveSrv: typeof resolveSrv;
        resolveTxt: typeof resolveTxt;
        reverse: typeof reverse;
        cancel(): void;
    }
}

declare module "net" {
    import * as stream from "stream";
    import * as events from "events";
    import * as dns from "dns";

    type LookupFunction = (hostname: string, options: dns.LookupOneOptions, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => void;

    interface AddressInfo {
        address: string;
        family: string;
        port: number;
    }

    interface SocketConstructorOpts {
        fd?: number;
        allowHalfOpen?: boolean;
        readable?: boolean;
        writable?: boolean;
    }

    interface TcpSocketConnectOpts {
        port: number;
        host?: string;
        localAddress?: string;
        localPort?: number;
        hints?: number;
        family?: number;
        lookup?: LookupFunction;
    }

    interface IpcSocketConnectOpts {
        path: string;
    }

    type SocketConnectOpts = TcpSocketConnectOpts | IpcSocketConnectOpts;

    class Socket extends stream.Duplex {
        constructor(options?: SocketConstructorOpts);

        // Extended base methods
        write(buffer: Buffer): boolean;
        write(buffer: Buffer, cb?: Function): boolean;
        write(str: string, cb?: Function): boolean;
        write(str: string, encoding?: string, cb?: Function): boolean;
        write(str: string, encoding?: string, fd?: string): boolean;
        write(data: any, encoding?: string, callback?: Function): void;

        connect(options: SocketConnectOpts, connectionListener?: Function): this;
        connect(port: number, host: string, connectionListener?: Function): this;
        connect(port: number, connectionListener?: Function): this;
        connect(path: string, connectionListener?: Function): this;

        setEncoding(encoding?: string): this;
        pause(): this;
        resume(): this;
        setTimeout(timeout: number, callback?: Function): this;
        setNoDelay(noDelay?: boolean): this;
        setKeepAlive(enable?: boolean, initialDelay?: number): this;
        address(): AddressInfo | string;
        unref(): void;
        ref(): void;

        readonly bufferSize: number;
        readonly bytesRead: number;
        readonly bytesWritten: number;
        readonly connecting: boolean;
        readonly destroyed: boolean;
        readonly localAddress: string;
        readonly localPort: number;
        readonly remoteAddress?: string;
        readonly remoteFamily?: string;
        readonly remotePort?: number;

        // Extended base methods
        end(): void;
        end(buffer: Buffer, cb?: Function): void;
        end(str: string, cb?: Function): void;
        end(str: string, encoding?: string, cb?: Function): void;
        end(data?: any, encoding?: string): void;

        /**
         * events.EventEmitter
         *   1. close
         *   2. connect
         *   3. data
         *   4. drain
         *   5. end
         *   6. error
         *   7. lookup
         *   8. timeout
         */
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "close", listener: (had_error: boolean) => void): this;
        addListener(event: "connect", listener: () => void): this;
        addListener(event: "data", listener: (data: Buffer) => void): this;
        addListener(event: "drain", listener: () => void): this;
        addListener(event: "end", listener: () => void): this;
        addListener(event: "error", listener: (err: Error) => void): this;
        addListener(event: "lookup", listener: (err: Error, address: string, family: string | number, host: string) => void): this;
        addListener(event: "timeout", listener: () => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "close", had_error: boolean): boolean;
        emit(event: "connect"): boolean;
        emit(event: "data", data: Buffer): boolean;
        emit(event: "drain"): boolean;
        emit(event: "end"): boolean;
        emit(event: "error", err: Error): boolean;
        emit(event: "lookup", err: Error, address: string, family: string | number, host: string): boolean;
        emit(event: "timeout"): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "close", listener: (had_error: boolean) => void): this;
        on(event: "connect", listener: () => void): this;
        on(event: "data", listener: (data: Buffer) => void): this;
        on(event: "drain", listener: () => void): this;
        on(event: "end", listener: () => void): this;
        on(event: "error", listener: (err: Error) => void): this;
        on(event: "lookup", listener: (err: Error, address: string, family: string | number, host: string) => void): this;
        on(event: "timeout", listener: () => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "close", listener: (had_error: boolean) => void): this;
        once(event: "connect", listener: () => void): this;
        once(event: "data", listener: (data: Buffer) => void): this;
        once(event: "drain", listener: () => void): this;
        once(event: "end", listener: () => void): this;
        once(event: "error", listener: (err: Error) => void): this;
        once(event: "lookup", listener: (err: Error, address: string, family: string | number, host: string) => void): this;
        once(event: "timeout", listener: () => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "close", listener: (had_error: boolean) => void): this;
        prependListener(event: "connect", listener: () => void): this;
        prependListener(event: "data", listener: (data: Buffer) => void): this;
        prependListener(event: "drain", listener: () => void): this;
        prependListener(event: "end", listener: () => void): this;
        prependListener(event: "error", listener: (err: Error) => void): this;
        prependListener(event: "lookup", listener: (err: Error, address: string, family: string | number, host: string) => void): this;
        prependListener(event: "timeout", listener: () => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "close", listener: (had_error: boolean) => void): this;
        prependOnceListener(event: "connect", listener: () => void): this;
        prependOnceListener(event: "data", listener: (data: Buffer) => void): this;
        prependOnceListener(event: "drain", listener: () => void): this;
        prependOnceListener(event: "end", listener: () => void): this;
        prependOnceListener(event: "error", listener: (err: Error) => void): this;
        prependOnceListener(event: "lookup", listener: (err: Error, address: string, family: string | number, host: string) => void): this;
        prependOnceListener(event: "timeout", listener: () => void): this;
    }

    interface ListenOptions {
        port?: number;
        host?: string;
        backlog?: number;
        path?: string;
        exclusive?: boolean;
        readableAll?: boolean;
        writableAll?: boolean;
    }

    // https://github.com/nodejs/node/blob/master/lib/net.js
    class Server extends events.EventEmitter {
        constructor(connectionListener?: (socket: Socket) => void);
        constructor(options?: { allowHalfOpen?: boolean, pauseOnConnect?: boolean }, connectionListener?: (socket: Socket) => void);

        listen(port?: number, hostname?: string, backlog?: number, listeningListener?: Function): this;
        listen(port?: number, hostname?: string, listeningListener?: Function): this;
        listen(port?: number, backlog?: number, listeningListener?: Function): this;
        listen(port?: number, listeningListener?: Function): this;
        listen(path: string, backlog?: number, listeningListener?: Function): this;
        listen(path: string, listeningListener?: Function): this;
        listen(options: ListenOptions, listeningListener?: Function): this;
        listen(handle: any, backlog?: number, listeningListener?: Function): this;
        listen(handle: any, listeningListener?: Function): this;
        close(callback?: Function): this;
        address(): AddressInfo | string;
        getConnections(cb: (error: Error | null, count: number) => void): void;
        ref(): this;
        unref(): this;
        maxConnections: number;
        connections: number;
        listening: boolean;

        /**
         * events.EventEmitter
         *   1. close
         *   2. connection
         *   3. error
         *   4. listening
         */
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "close", listener: () => void): this;
        addListener(event: "connection", listener: (socket: Socket) => void): this;
        addListener(event: "error", listener: (err: Error) => void): this;
        addListener(event: "listening", listener: () => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "close"): boolean;
        emit(event: "connection", socket: Socket): boolean;
        emit(event: "error", err: Error): boolean;
        emit(event: "listening"): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "close", listener: () => void): this;
        on(event: "connection", listener: (socket: Socket) => void): this;
        on(event: "error", listener: (err: Error) => void): this;
        on(event: "listening", listener: () => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "close", listener: () => void): this;
        once(event: "connection", listener: (socket: Socket) => void): this;
        once(event: "error", listener: (err: Error) => void): this;
        once(event: "listening", listener: () => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "close", listener: () => void): this;
        prependListener(event: "connection", listener: (socket: Socket) => void): this;
        prependListener(event: "error", listener: (err: Error) => void): this;
        prependListener(event: "listening", listener: () => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "close", listener: () => void): this;
        prependOnceListener(event: "connection", listener: (socket: Socket) => void): this;
        prependOnceListener(event: "error", listener: (err: Error) => void): this;
        prependOnceListener(event: "listening", listener: () => void): this;
    }

    interface TcpNetConnectOpts extends TcpSocketConnectOpts, SocketConstructorOpts {
        timeout?: number;
    }

    interface IpcNetConnectOpts extends IpcSocketConnectOpts, SocketConstructorOpts {
        timeout?: number;
    }

    type NetConnectOpts = TcpNetConnectOpts | IpcNetConnectOpts;

    function createServer(connectionListener?: (socket: Socket) => void): Server;
    function createServer(options?: { allowHalfOpen?: boolean, pauseOnConnect?: boolean }, connectionListener?: (socket: Socket) => void): Server;
    function connect(options: NetConnectOpts, connectionListener?: Function): Socket;
    function connect(port: number, host?: string, connectionListener?: Function): Socket;
    function connect(path: string, connectionListener?: Function): Socket;
    function createConnection(options: NetConnectOpts, connectionListener?: Function): Socket;
    function createConnection(port: number, host?: string, connectionListener?: Function): Socket;
    function createConnection(path: string, connectionListener?: Function): Socket;
    function isIP(input: string): number;
    function isIPv4(input: string): boolean;
    function isIPv6(input: string): boolean;
}

declare module "dgram" {
    import { AddressInfo } from "net";
    import * as dns from "dns";
    import * as events from "events";

    interface RemoteInfo {
        address: string;
        family: string;
        port: number;
    }

    interface BindOptions {
        port: number;
        address?: string;
        exclusive?: boolean;
    }

    type SocketType = "udp4" | "udp6";

    interface SocketOptions {
        type: SocketType;
        reuseAddr?: boolean;
        recvBufferSize?: number;
        sendBufferSize?: number;
        lookup?: (hostname: string, options: dns.LookupOneOptions, callback: (err: NodeJS.ErrnoException, address: string, family: number) => void) => void;
    }

    function createSocket(type: SocketType, callback?: (msg: Buffer, rinfo: RemoteInfo) => void): Socket;
    function createSocket(options: SocketOptions, callback?: (msg: Buffer, rinfo: RemoteInfo) => void): Socket;

    class Socket extends events.EventEmitter {
        send(msg: Buffer | string | Uint8Array | any[], port: number, address?: string, callback?: (error: Error | null, bytes: number) => void): void;
        send(msg: Buffer | string | Uint8Array, offset: number, length: number, port: number, address?: string, callback?: (error: Error | null, bytes: number) => void): void;
        bind(port?: number, address?: string, callback?: () => void): void;
        bind(port?: number, callback?: () => void): void;
        bind(callback?: () => void): void;
        bind(options: BindOptions, callback?: Function): void;
        close(callback?: () => void): void;
        address(): AddressInfo | string;
        setBroadcast(flag: boolean): void;
        setTTL(ttl: number): void;
        setMulticastTTL(ttl: number): void;
        setMulticastInterface(multicastInterface: string): void;
        setMulticastLoopback(flag: boolean): void;
        addMembership(multicastAddress: string, multicastInterface?: string): void;
        dropMembership(multicastAddress: string, multicastInterface?: string): void;
        ref(): this;
        unref(): this;
        setRecvBufferSize(size: number): void;
        setSendBufferSize(size: number): void;
        getRecvBufferSize(): number;
        getSendBufferSize(): number;

        /**
         * events.EventEmitter
         * 1. close
         * 2. error
         * 3. listening
         * 4. message
         */
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "close", listener: () => void): this;
        addListener(event: "error", listener: (err: Error) => void): this;
        addListener(event: "listening", listener: () => void): this;
        addListener(event: "message", listener: (msg: Buffer, rinfo: AddressInfo) => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "close"): boolean;
        emit(event: "error", err: Error): boolean;
        emit(event: "listening"): boolean;
        emit(event: "message", msg: Buffer, rinfo: AddressInfo): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "close", listener: () => void): this;
        on(event: "error", listener: (err: Error) => void): this;
        on(event: "listening", listener: () => void): this;
        on(event: "message", listener: (msg: Buffer, rinfo: AddressInfo) => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "close", listener: () => void): this;
        once(event: "error", listener: (err: Error) => void): this;
        once(event: "listening", listener: () => void): this;
        once(event: "message", listener: (msg: Buffer, rinfo: AddressInfo) => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "close", listener: () => void): this;
        prependListener(event: "error", listener: (err: Error) => void): this;
        prependListener(event: "listening", listener: () => void): this;
        prependListener(event: "message", listener: (msg: Buffer, rinfo: AddressInfo) => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "close", listener: () => void): this;
        prependOnceListener(event: "error", listener: (err: Error) => void): this;
        prependOnceListener(event: "listening", listener: () => void): this;
        prependOnceListener(event: "message", listener: (msg: Buffer, rinfo: AddressInfo) => void): this;
    }
}

declare module "fs" {
    import * as stream from "stream";
    import * as events from "events";
    import { URL } from "url";

    /**
     * Valid types for path values in "fs".
     */
    type PathLike = string | Buffer | URL;

    type BinaryData = Buffer | DataView | NodeJS.TypedArray;
    class Stats {
        isFile(): boolean;
        isDirectory(): boolean;
        isBlockDevice(): boolean;
        isCharacterDevice(): boolean;
        isSymbolicLink(): boolean;
        isFIFO(): boolean;
        isSocket(): boolean;
        dev: number;
        ino: number;
        mode: number;
        nlink: number;
        uid: number;
        gid: number;
        rdev: number;
        size: number;
        blksize: number;
        blocks: number;
        atimeMs: number;
        mtimeMs: number;
        ctimeMs: number;
        birthtimeMs: number;
        atime: Date;
        mtime: Date;
        ctime: Date;
        birthtime: Date;
    }

    class Dirent {
        isFile(): boolean;
        isDirectory(): boolean;
        isBlockDevice(): boolean;
        isCharacterDevice(): boolean;
        isSymbolicLink(): boolean;
        isFIFO(): boolean;
        isSocket(): boolean;
        name: string;
    }

    interface FSWatcher extends events.EventEmitter {
        close(): void;

        /**
         * events.EventEmitter
         *   1. change
         *   2. error
         */
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "change", listener: (eventType: string, filename: string | Buffer) => void): this;
        addListener(event: "error", listener: (error: Error) => void): this;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "change", listener: (eventType: string, filename: string | Buffer) => void): this;
        on(event: "error", listener: (error: Error) => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "change", listener: (eventType: string, filename: string | Buffer) => void): this;
        once(event: "error", listener: (error: Error) => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "change", listener: (eventType: string, filename: string | Buffer) => void): this;
        prependListener(event: "error", listener: (error: Error) => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "change", listener: (eventType: string, filename: string | Buffer) => void): this;
        prependOnceListener(event: "error", listener: (error: Error) => void): this;
    }

    class ReadStream extends stream.Readable {
        close(): void;
        bytesRead: number;
        path: string | Buffer;

        /**
         * events.EventEmitter
         *   1. open
         *   2. close
         */
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "open", listener: (fd: number) => void): this;
        addListener(event: "close", listener: () => void): this;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "open", listener: (fd: number) => void): this;
        on(event: "close", listener: () => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "open", listener: (fd: number) => void): this;
        once(event: "close", listener: () => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "open", listener: (fd: number) => void): this;
        prependListener(event: "close", listener: () => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "open", listener: (fd: number) => void): this;
        prependOnceListener(event: "close", listener: () => void): this;
    }

    class WriteStream extends stream.Writable {
        close(): void;
        bytesWritten: number;
        path: string | Buffer;

        /**
         * events.EventEmitter
         *   1. open
         *   2. close
         */
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "open", listener: (fd: number) => void): this;
        addListener(event: "close", listener: () => void): this;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "open", listener: (fd: number) => void): this;
        on(event: "close", listener: () => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "open", listener: (fd: number) => void): this;
        once(event: "close", listener: () => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "open", listener: (fd: number) => void): this;
        prependListener(event: "close", listener: () => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "open", listener: (fd: number) => void): this;
        prependOnceListener(event: "close", listener: () => void): this;
    }

    /**
     * Asynchronous rename(2) - Change the name or location of a file or directory.
     * @param oldPath A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * @param newPath A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function rename(oldPath: PathLike, newPath: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace rename {
        /**
         * Asynchronous rename(2) - Change the name or location of a file or directory.
         * @param oldPath A path to a file. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         * @param newPath A path to a file. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         */
        function __promisify__(oldPath: PathLike, newPath: PathLike): Promise<void>;
    }

    /**
     * Synchronous rename(2) - Change the name or location of a file or directory.
     * @param oldPath A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * @param newPath A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function renameSync(oldPath: PathLike, newPath: PathLike): void;

    /**
     * Asynchronous truncate(2) - Truncate a file to a specified length.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param len If not specified, defaults to `0`.
     */
    function truncate(path: PathLike, len: number | undefined | null, callback: (err: NodeJS.ErrnoException) => void): void;

    /**
     * Asynchronous truncate(2) - Truncate a file to a specified length.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function truncate(path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace truncate {
        /**
         * Asynchronous truncate(2) - Truncate a file to a specified length.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param len If not specified, defaults to `0`.
         */
        function __promisify__(path: PathLike, len?: number | null): Promise<void>;
    }

    /**
     * Synchronous truncate(2) - Truncate a file to a specified length.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param len If not specified, defaults to `0`.
     */
    function truncateSync(path: PathLike, len?: number | null): void;

    /**
     * Asynchronous ftruncate(2) - Truncate a file to a specified length.
     * @param fd A file descriptor.
     * @param len If not specified, defaults to `0`.
     */
    function ftruncate(fd: number, len: number | undefined | null, callback: (err: NodeJS.ErrnoException) => void): void;

    /**
     * Asynchronous ftruncate(2) - Truncate a file to a specified length.
     * @param fd A file descriptor.
     */
    function ftruncate(fd: number, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace ftruncate {
        /**
         * Asynchronous ftruncate(2) - Truncate a file to a specified length.
         * @param fd A file descriptor.
         * @param len If not specified, defaults to `0`.
         */
        function __promisify__(fd: number, len?: number | null): Promise<void>;
    }

    /**
     * Synchronous ftruncate(2) - Truncate a file to a specified length.
     * @param fd A file descriptor.
     * @param len If not specified, defaults to `0`.
     */
    function ftruncateSync(fd: number, len?: number | null): void;

    /**
     * Asynchronous chown(2) - Change ownership of a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function chown(path: PathLike, uid: number, gid: number, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace chown {
        /**
         * Asynchronous chown(2) - Change ownership of a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function __promisify__(path: PathLike, uid: number, gid: number): Promise<void>;
    }

    /**
     * Synchronous chown(2) - Change ownership of a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function chownSync(path: PathLike, uid: number, gid: number): void;

    /**
     * Asynchronous fchown(2) - Change ownership of a file.
     * @param fd A file descriptor.
     */
    function fchown(fd: number, uid: number, gid: number, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace fchown {
        /**
         * Asynchronous fchown(2) - Change ownership of a file.
         * @param fd A file descriptor.
         */
        function __promisify__(fd: number, uid: number, gid: number): Promise<void>;
    }

    /**
     * Synchronous fchown(2) - Change ownership of a file.
     * @param fd A file descriptor.
     */
    function fchownSync(fd: number, uid: number, gid: number): void;

    /**
     * Asynchronous lchown(2) - Change ownership of a file. Does not dereference symbolic links.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function lchown(path: PathLike, uid: number, gid: number, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace lchown {
        /**
         * Asynchronous lchown(2) - Change ownership of a file. Does not dereference symbolic links.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function __promisify__(path: PathLike, uid: number, gid: number): Promise<void>;
    }

    /**
     * Synchronous lchown(2) - Change ownership of a file. Does not dereference symbolic links.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function lchownSync(path: PathLike, uid: number, gid: number): void;

    /**
     * Asynchronous chmod(2) - Change permissions of a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
     */
    function chmod(path: PathLike, mode: string | number, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace chmod {
        /**
         * Asynchronous chmod(2) - Change permissions of a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
         */
        function __promisify__(path: PathLike, mode: string | number): Promise<void>;
    }

    /**
     * Synchronous chmod(2) - Change permissions of a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
     */
    function chmodSync(path: PathLike, mode: string | number): void;

    /**
     * Asynchronous fchmod(2) - Change permissions of a file.
     * @param fd A file descriptor.
     * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
     */
    function fchmod(fd: number, mode: string | number, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace fchmod {
        /**
         * Asynchronous fchmod(2) - Change permissions of a file.
         * @param fd A file descriptor.
         * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
         */
        function __promisify__(fd: number, mode: string | number): Promise<void>;
    }

    /**
     * Synchronous fchmod(2) - Change permissions of a file.
     * @param fd A file descriptor.
     * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
     */
    function fchmodSync(fd: number, mode: string | number): void;

    /**
     * Asynchronous lchmod(2) - Change permissions of a file. Does not dereference symbolic links.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
     */
    function lchmod(path: PathLike, mode: string | number, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace lchmod {
        /**
         * Asynchronous lchmod(2) - Change permissions of a file. Does not dereference symbolic links.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
         */
        function __promisify__(path: PathLike, mode: string | number): Promise<void>;
    }

    /**
     * Synchronous lchmod(2) - Change permissions of a file. Does not dereference symbolic links.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
     */
    function lchmodSync(path: PathLike, mode: string | number): void;

    /**
     * Asynchronous stat(2) - Get file status.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function stat(path: PathLike, callback: (err: NodeJS.ErrnoException, stats: Stats) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace stat {
        /**
         * Asynchronous stat(2) - Get file status.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function __promisify__(path: PathLike): Promise<Stats>;
    }

    /**
     * Synchronous stat(2) - Get file status.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function statSync(path: PathLike): Stats;

    /**
     * Asynchronous fstat(2) - Get file status.
     * @param fd A file descriptor.
     */
    function fstat(fd: number, callback: (err: NodeJS.ErrnoException, stats: Stats) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace fstat {
        /**
         * Asynchronous fstat(2) - Get file status.
         * @param fd A file descriptor.
         */
        function __promisify__(fd: number): Promise<Stats>;
    }

    /**
     * Synchronous fstat(2) - Get file status.
     * @param fd A file descriptor.
     */
    function fstatSync(fd: number): Stats;

    /**
     * Asynchronous lstat(2) - Get file status. Does not dereference symbolic links.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function lstat(path: PathLike, callback: (err: NodeJS.ErrnoException, stats: Stats) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace lstat {
        /**
         * Asynchronous lstat(2) - Get file status. Does not dereference symbolic links.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function __promisify__(path: PathLike): Promise<Stats>;
    }

    /**
     * Synchronous lstat(2) - Get file status. Does not dereference symbolic links.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function lstatSync(path: PathLike): Stats;

    /**
     * Asynchronous link(2) - Create a new link (also known as a hard link) to an existing file.
     * @param existingPath A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param newPath A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function link(existingPath: PathLike, newPath: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace link {
        /**
         * Asynchronous link(2) - Create a new link (also known as a hard link) to an existing file.
         * @param existingPath A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param newPath A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function link(existingPath: PathLike, newPath: PathLike): Promise<void>;
    }

    /**
     * Synchronous link(2) - Create a new link (also known as a hard link) to an existing file.
     * @param existingPath A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param newPath A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function linkSync(existingPath: PathLike, newPath: PathLike): void;

    /**
     * Asynchronous symlink(2) - Create a new symbolic link to an existing file.
     * @param target A path to an existing file. If a URL is provided, it must use the `file:` protocol.
     * @param path A path to the new symlink. If a URL is provided, it must use the `file:` protocol.
     * @param type May be set to `'dir'`, `'file'`, or `'junction'` (default is `'file'`) and is only available on Windows (ignored on other platforms).
     * When using `'junction'`, the `target` argument will automatically be normalized to an absolute path.
     */
    function symlink(target: PathLike, path: PathLike, type: symlink.Type | undefined | null, callback: (err: NodeJS.ErrnoException) => void): void;

    /**
     * Asynchronous symlink(2) - Create a new symbolic link to an existing file.
     * @param target A path to an existing file. If a URL is provided, it must use the `file:` protocol.
     * @param path A path to the new symlink. If a URL is provided, it must use the `file:` protocol.
     */
    function symlink(target: PathLike, path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace symlink {
        /**
         * Asynchronous symlink(2) - Create a new symbolic link to an existing file.
         * @param target A path to an existing file. If a URL is provided, it must use the `file:` protocol.
         * @param path A path to the new symlink. If a URL is provided, it must use the `file:` protocol.
         * @param type May be set to `'dir'`, `'file'`, or `'junction'` (default is `'file'`) and is only available on Windows (ignored on other platforms).
         * When using `'junction'`, the `target` argument will automatically be normalized to an absolute path.
         */
        function __promisify__(target: PathLike, path: PathLike, type?: string | null): Promise<void>;

        type Type = "dir" | "file" | "junction";
    }

    /**
     * Synchronous symlink(2) - Create a new symbolic link to an existing file.
     * @param target A path to an existing file. If a URL is provided, it must use the `file:` protocol.
     * @param path A path to the new symlink. If a URL is provided, it must use the `file:` protocol.
     * @param type May be set to `'dir'`, `'file'`, or `'junction'` (default is `'file'`) and is only available on Windows (ignored on other platforms).
     * When using `'junction'`, the `target` argument will automatically be normalized to an absolute path.
     */
    function symlinkSync(target: PathLike, path: PathLike, type?: symlink.Type | null): void;

    /**
     * Asynchronous readlink(2) - read value of a symbolic link.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readlink(path: PathLike, options: { encoding?: BufferEncoding | null } | BufferEncoding | undefined | null, callback: (err: NodeJS.ErrnoException, linkString: string) => void): void;

    /**
     * Asynchronous readlink(2) - read value of a symbolic link.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readlink(path: PathLike, options: { encoding: "buffer" } | "buffer", callback: (err: NodeJS.ErrnoException, linkString: Buffer) => void): void;

    /**
     * Asynchronous readlink(2) - read value of a symbolic link.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readlink(path: PathLike, options: { encoding?: string | null } | string | undefined | null, callback: (err: NodeJS.ErrnoException, linkString: string | Buffer) => void): void;

    /**
     * Asynchronous readlink(2) - read value of a symbolic link.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function readlink(path: PathLike, callback: (err: NodeJS.ErrnoException, linkString: string) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace readlink {
        /**
         * Asynchronous readlink(2) - read value of a symbolic link.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(path: PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string>;

        /**
         * Asynchronous readlink(2) - read value of a symbolic link.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(path: PathLike, options: { encoding: "buffer" } | "buffer"): Promise<Buffer>;

        /**
         * Asynchronous readlink(2) - read value of a symbolic link.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(path: PathLike, options?: { encoding?: string | null } | string | null): Promise<string | Buffer>;
    }

    /**
     * Synchronous readlink(2) - read value of a symbolic link.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readlinkSync(path: PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): string;

    /**
     * Synchronous readlink(2) - read value of a symbolic link.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readlinkSync(path: PathLike, options: { encoding: "buffer" } | "buffer"): Buffer;

    /**
     * Synchronous readlink(2) - read value of a symbolic link.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readlinkSync(path: PathLike, options?: { encoding?: string | null } | string | null): string | Buffer;

    /**
     * Asynchronous realpath(3) - return the canonicalized absolute pathname.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function realpath(path: PathLike, options: { encoding?: BufferEncoding | null } | BufferEncoding | undefined | null, callback: (err: NodeJS.ErrnoException, resolvedPath: string) => void): void;

    /**
     * Asynchronous realpath(3) - return the canonicalized absolute pathname.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function realpath(path: PathLike, options: { encoding: "buffer" } | "buffer", callback: (err: NodeJS.ErrnoException, resolvedPath: Buffer) => void): void;

    /**
     * Asynchronous realpath(3) - return the canonicalized absolute pathname.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function realpath(path: PathLike, options: { encoding?: string | null } | string | undefined | null, callback: (err: NodeJS.ErrnoException, resolvedPath: string | Buffer) => void): void;

    /**
     * Asynchronous realpath(3) - return the canonicalized absolute pathname.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function realpath(path: PathLike, callback: (err: NodeJS.ErrnoException, resolvedPath: string) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace realpath {
        /**
         * Asynchronous realpath(3) - return the canonicalized absolute pathname.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(path: PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string>;

        /**
         * Asynchronous realpath(3) - return the canonicalized absolute pathname.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(path: PathLike, options: { encoding: "buffer" } | "buffer"): Promise<Buffer>;

        /**
         * Asynchronous realpath(3) - return the canonicalized absolute pathname.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(path: PathLike, options?: { encoding?: string | null } | string | null): Promise<string | Buffer>;

        function native(path: PathLike, options: { encoding?: BufferEncoding | null } | BufferEncoding | undefined | null, callback: (err: NodeJS.ErrnoException, resolvedPath: string) => void): void;
        function native(path: PathLike, options: { encoding: "buffer" } | "buffer", callback: (err: NodeJS.ErrnoException, resolvedPath: Buffer) => void): void;
        function native(path: PathLike, options: { encoding?: string | null } | string | undefined | null, callback: (err: NodeJS.ErrnoException, resolvedPath: string | Buffer) => void): void;
        function native(path: PathLike, callback: (err: NodeJS.ErrnoException, resolvedPath: string) => void): void;
    }

    /**
     * Synchronous realpath(3) - return the canonicalized absolute pathname.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function realpathSync(path: PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): string;

    /**
     * Synchronous realpath(3) - return the canonicalized absolute pathname.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function realpathSync(path: PathLike, options: { encoding: "buffer" } | "buffer"): Buffer;

    /**
     * Synchronous realpath(3) - return the canonicalized absolute pathname.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function realpathSync(path: PathLike, options?: { encoding?: string | null } | string | null): string | Buffer;

    namespace realpathSync {
        function native(path: PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): string;
        function native(path: PathLike, options: { encoding: "buffer" } | "buffer"): Buffer;
        function native(path: PathLike, options?: { encoding?: string | null } | string | null): string | Buffer;
    }

    /**
     * Asynchronous unlink(2) - delete a name and possibly the file it refers to.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function unlink(path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace unlink {
        /**
         * Asynchronous unlink(2) - delete a name and possibly the file it refers to.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function __promisify__(path: PathLike): Promise<void>;
    }

    /**
     * Synchronous unlink(2) - delete a name and possibly the file it refers to.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function unlinkSync(path: PathLike): void;

    /**
     * Asynchronous rmdir(2) - delete a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function rmdir(path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace rmdir {
        /**
         * Asynchronous rmdir(2) - delete a directory.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function __promisify__(path: PathLike): Promise<void>;
    }

    /**
     * Synchronous rmdir(2) - delete a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function rmdirSync(path: PathLike): void;

    export interface MakeDirectoryOptions {
        /**
         * Indicates whether parent folders should be created.
         * @default false
         */
        recursive?: boolean;
        /**
         * A file mode. If a string is passed, it is parsed as an octal integer. If not specified
         * @default 0o777.
         */
        mode?: number;
    }

    /**
     * Asynchronous mkdir(2) - create a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options Either the file mode, or an object optionally specifying the file mode and whether parent folders
     * should be created. If a string is passed, it is parsed as an octal integer. If not specified, defaults to `0o777`.
     */
    function mkdir(path: PathLike, options: number | string | MakeDirectoryOptions | undefined | null, callback: (err: NodeJS.ErrnoException) => void): void;

    /**
     * Asynchronous mkdir(2) - create a directory with a mode of `0o777`.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function mkdir(path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace mkdir {
        /**
         * Asynchronous mkdir(2) - create a directory.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options Either the file mode, or an object optionally specifying the file mode and whether parent folders
         * should be created. If a string is passed, it is parsed as an octal integer. If not specified, defaults to `0o777`.
         */
        function __promisify__(path: PathLike, options?: number | string | MakeDirectoryOptions | null): Promise<void>;
    }

    /**
     * Synchronous mkdir(2) - create a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options Either the file mode, or an object optionally specifying the file mode and whether parent folders
     * should be created. If a string is passed, it is parsed as an octal integer. If not specified, defaults to `0o777`.
     */
    function mkdirSync(path: PathLike, options?: number | string | MakeDirectoryOptions | null): void;

    /**
     * Asynchronously creates a unique temporary directory.
     * Generates six random characters to be appended behind a required prefix to create a unique temporary directory.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function mkdtemp(prefix: string, options: { encoding?: BufferEncoding | null } | BufferEncoding | undefined | null, callback: (err: NodeJS.ErrnoException, folder: string) => void): void;

    /**
     * Asynchronously creates a unique temporary directory.
     * Generates six random characters to be appended behind a required prefix to create a unique temporary directory.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function mkdtemp(prefix: string, options: "buffer" | { encoding: "buffer" }, callback: (err: NodeJS.ErrnoException, folder: Buffer) => void): void;

    /**
     * Asynchronously creates a unique temporary directory.
     * Generates six random characters to be appended behind a required prefix to create a unique temporary directory.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function mkdtemp(prefix: string, options: { encoding?: string | null } | string | undefined | null, callback: (err: NodeJS.ErrnoException, folder: string | Buffer) => void): void;

    /**
     * Asynchronously creates a unique temporary directory.
     * Generates six random characters to be appended behind a required prefix to create a unique temporary directory.
     */
    function mkdtemp(prefix: string, callback: (err: NodeJS.ErrnoException, folder: string) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace mkdtemp {
        /**
         * Asynchronously creates a unique temporary directory.
         * Generates six random characters to be appended behind a required prefix to create a unique temporary directory.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(prefix: string, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string>;

        /**
         * Asynchronously creates a unique temporary directory.
         * Generates six random characters to be appended behind a required prefix to create a unique temporary directory.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(prefix: string, options: { encoding: "buffer" } | "buffer"): Promise<Buffer>;

        /**
         * Asynchronously creates a unique temporary directory.
         * Generates six random characters to be appended behind a required prefix to create a unique temporary directory.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(prefix: string, options?: { encoding?: string | null } | string | null): Promise<string | Buffer>;
    }

    /**
     * Synchronously creates a unique temporary directory.
     * Generates six random characters to be appended behind a required prefix to create a unique temporary directory.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function mkdtempSync(prefix: string, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): string;

    /**
     * Synchronously creates a unique temporary directory.
     * Generates six random characters to be appended behind a required prefix to create a unique temporary directory.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function mkdtempSync(prefix: string, options: { encoding: "buffer" } | "buffer"): Buffer;

    /**
     * Synchronously creates a unique temporary directory.
     * Generates six random characters to be appended behind a required prefix to create a unique temporary directory.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function mkdtempSync(prefix: string, options?: { encoding?: string | null } | string | null): string | Buffer;

    /**
     * Asynchronous readdir(3) - read a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readdir(
        path: PathLike,
        options: { encoding: BufferEncoding | null; withFileTypes?: false } | BufferEncoding | undefined | null,
        callback: (err: NodeJS.ErrnoException, files: string[]) => void,
    ): void;

    /**
     * Asynchronous readdir(3) - read a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readdir(path: PathLike, options: { encoding: "buffer"; withFileTypes?: false } | "buffer", callback: (err: NodeJS.ErrnoException, files: Buffer[]) => void): void;

    /**
     * Asynchronous readdir(3) - read a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readdir(
        path: PathLike,
        options: { encoding?: string | null; withFileTypes?: false } | string | undefined | null,
        callback: (err: NodeJS.ErrnoException, files: string[] | Buffer[]) => void,
    ): void;

    /**
     * Asynchronous readdir(3) - read a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function readdir(path: PathLike, callback: (err: NodeJS.ErrnoException, files: string[]) => void): void;

    /**
     * Asynchronous readdir(3) - read a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options If called with `withFileTypes: true` the result data will be an array of Dirent.
     */
    function readdir(path: PathLike, options: { withFileTypes: true }, callback: (err: NodeJS.ErrnoException, files: Dirent[]) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace readdir {
        /**
         * Asynchronous readdir(3) - read a directory.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(path: PathLike, options?: { encoding: BufferEncoding | null; withFileTypes?: false } | BufferEncoding | null): Promise<string[]>;

        /**
         * Asynchronous readdir(3) - read a directory.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(path: PathLike, options: "buffer" | { encoding: "buffer"; withFileTypes?: false }): Promise<Buffer[]>;

        /**
         * Asynchronous readdir(3) - read a directory.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function __promisify__(path: PathLike, options?: { encoding?: string | null; withFileTypes?: false } | string | null): Promise<string[] | Buffer[]>;

        /**
         * Asynchronous readdir(3) - read a directory.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options If called with `withFileTypes: true` the result data will be an array of Dirent
         */
        function __promisify__(path: PathLike, options: { withFileTypes: true }): Promise<Dirent[]>;
    }

    /**
     * Synchronous readdir(3) - read a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readdirSync(path: PathLike, options?: { encoding: BufferEncoding | null; withFileTypes?: false } | BufferEncoding | null): string[];

    /**
     * Synchronous readdir(3) - read a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readdirSync(path: PathLike, options: { encoding: "buffer"; withFileTypes?: false } | "buffer"): Buffer[];

    /**
     * Synchronous readdir(3) - read a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
     */
    function readdirSync(path: PathLike, options?: { encoding?: string | null; withFileTypes?: false } | string | null): string[] | Buffer[];

    /**
     * Asynchronous readdir(3) - read a directory.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param options If called with `withFileTypes: true` the result data will be an array of Dirent.
     */
    function readdirSync(path: PathLike, options: { withFileTypes: true }): Dirent[];

    /**
     * Asynchronous close(2) - close a file descriptor.
     * @param fd A file descriptor.
     */
    function close(fd: number, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace close {
        /**
         * Asynchronous close(2) - close a file descriptor.
         * @param fd A file descriptor.
         */
        function __promisify__(fd: number): Promise<void>;
    }

    /**
     * Synchronous close(2) - close a file descriptor.
     * @param fd A file descriptor.
     */
    function closeSync(fd: number): void;

    /**
     * Asynchronous open(2) - open and possibly create a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param mode A file mode. If a string is passed, it is parsed as an octal integer. If not supplied, defaults to `0o666`.
     */
    function open(path: PathLike, flags: string | number, mode: string | number | undefined | null, callback: (err: NodeJS.ErrnoException, fd: number) => void): void;

    /**
     * Asynchronous open(2) - open and possibly create a file. If the file is created, its mode will be `0o666`.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     */
    function open(path: PathLike, flags: string | number, callback: (err: NodeJS.ErrnoException, fd: number) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace open {
        /**
         * Asynchronous open(2) - open and possibly create a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param mode A file mode. If a string is passed, it is parsed as an octal integer. If not supplied, defaults to `0o666`.
         */
        function __promisify__(path: PathLike, flags: string | number, mode?: string | number | null): Promise<number>;
    }

    /**
     * Synchronous open(2) - open and possibly create a file, returning a file descriptor..
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param mode A file mode. If a string is passed, it is parsed as an octal integer. If not supplied, defaults to `0o666`.
     */
    function openSync(path: PathLike, flags: string | number, mode?: string | number | null): number;

    /**
     * Asynchronously change file timestamps of the file referenced by the supplied path.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param atime The last access time. If a string is provided, it will be coerced to number.
     * @param mtime The last modified time. If a string is provided, it will be coerced to number.
     */
    function utimes(path: PathLike, atime: string | number | Date, mtime: string | number | Date, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace utimes {
        /**
         * Asynchronously change file timestamps of the file referenced by the supplied path.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param atime The last access time. If a string is provided, it will be coerced to number.
         * @param mtime The last modified time. If a string is provided, it will be coerced to number.
         */
        function __promisify__(path: PathLike, atime: string | number | Date, mtime: string | number | Date): Promise<void>;
    }

    /**
     * Synchronously change file timestamps of the file referenced by the supplied path.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * @param atime The last access time. If a string is provided, it will be coerced to number.
     * @param mtime The last modified time. If a string is provided, it will be coerced to number.
     */
    function utimesSync(path: PathLike, atime: string | number | Date, mtime: string | number | Date): void;

    /**
     * Asynchronously change file timestamps of the file referenced by the supplied file descriptor.
     * @param fd A file descriptor.
     * @param atime The last access time. If a string is provided, it will be coerced to number.
     * @param mtime The last modified time. If a string is provided, it will be coerced to number.
     */
    function futimes(fd: number, atime: string | number | Date, mtime: string | number | Date, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace futimes {
        /**
         * Asynchronously change file timestamps of the file referenced by the supplied file descriptor.
         * @param fd A file descriptor.
         * @param atime The last access time. If a string is provided, it will be coerced to number.
         * @param mtime The last modified time. If a string is provided, it will be coerced to number.
         */
        function __promisify__(fd: number, atime: string | number | Date, mtime: string | number | Date): Promise<void>;
    }

    /**
     * Synchronously change file timestamps of the file referenced by the supplied file descriptor.
     * @param fd A file descriptor.
     * @param atime The last access time. If a string is provided, it will be coerced to number.
     * @param mtime The last modified time. If a string is provided, it will be coerced to number.
     */
    function futimesSync(fd: number, atime: string | number | Date, mtime: string | number | Date): void;

    /**
     * Asynchronous fsync(2) - synchronize a file's in-core state with the underlying storage device.
     * @param fd A file descriptor.
     */
    function fsync(fd: number, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace fsync {
        /**
         * Asynchronous fsync(2) - synchronize a file's in-core state with the underlying storage device.
         * @param fd A file descriptor.
         */
        function __promisify__(fd: number): Promise<void>;
    }

    /**
     * Synchronous fsync(2) - synchronize a file's in-core state with the underlying storage device.
     * @param fd A file descriptor.
     */
    function fsyncSync(fd: number): void;

    /**
     * Asynchronously writes `buffer` to the file referenced by the supplied file descriptor.
     * @param fd A file descriptor.
     * @param offset The part of the buffer to be written. If not supplied, defaults to `0`.
     * @param length The number of bytes to write. If not supplied, defaults to `buffer.length - offset`.
     * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
     */
    function write<TBuffer extends BinaryData>(
        fd: number,
        buffer: TBuffer,
        offset: number | undefined | null,
        length: number | undefined | null,
        position: number | undefined | null,
        callback: (err: NodeJS.ErrnoException, written: number, buffer: TBuffer) => void,
    ): void;

    /**
     * Asynchronously writes `buffer` to the file referenced by the supplied file descriptor.
     * @param fd A file descriptor.
     * @param offset The part of the buffer to be written. If not supplied, defaults to `0`.
     * @param length The number of bytes to write. If not supplied, defaults to `buffer.length - offset`.
     */
    function write<TBuffer extends BinaryData>(
        fd: number,
        buffer: TBuffer,
        offset: number | undefined | null,
        length: number | undefined | null,
        callback: (err: NodeJS.ErrnoException, written: number, buffer: TBuffer) => void,
    ): void;

    /**
     * Asynchronously writes `buffer` to the file referenced by the supplied file descriptor.
     * @param fd A file descriptor.
     * @param offset The part of the buffer to be written. If not supplied, defaults to `0`.
     */
    function write<TBuffer extends BinaryData>(fd: number, buffer: TBuffer, offset: number | undefined | null, callback: (err: NodeJS.ErrnoException, written: number, buffer: TBuffer) => void): void;

    /**
     * Asynchronously writes `buffer` to the file referenced by the supplied file descriptor.
     * @param fd A file descriptor.
     */
    function write<TBuffer extends BinaryData>(fd: number, buffer: TBuffer, callback: (err: NodeJS.ErrnoException, written: number, buffer: TBuffer) => void): void;

    /**
     * Asynchronously writes `string` to the file referenced by the supplied file descriptor.
     * @param fd A file descriptor.
     * @param string A string to write. If something other than a string is supplied it will be coerced to a string.
     * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
     * @param encoding The expected string encoding.
     */
    function write(
        fd: number,
        string: any,
        position: number | undefined | null,
        encoding: string | undefined | null,
        callback: (err: NodeJS.ErrnoException, written: number, str: string) => void,
    ): void;

    /**
     * Asynchronously writes `string` to the file referenced by the supplied file descriptor.
     * @param fd A file descriptor.
     * @param string A string to write. If something other than a string is supplied it will be coerced to a string.
     * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
     */
    function write(fd: number, string: any, position: number | undefined | null, callback: (err: NodeJS.ErrnoException, written: number, str: string) => void): void;

    /**
     * Asynchronously writes `string` to the file referenced by the supplied file descriptor.
     * @param fd A file descriptor.
     * @param string A string to write. If something other than a string is supplied it will be coerced to a string.
     */
    function write(fd: number, string: any, callback: (err: NodeJS.ErrnoException, written: number, str: string) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace write {
        /**
         * Asynchronously writes `buffer` to the file referenced by the supplied file descriptor.
         * @param fd A file descriptor.
         * @param offset The part of the buffer to be written. If not supplied, defaults to `0`.
         * @param length The number of bytes to write. If not supplied, defaults to `buffer.length - offset`.
         * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
         */
        function __promisify__<TBuffer extends BinaryData>(
            fd: number,
            buffer?: TBuffer,
            offset?: number,
            length?: number,
            position?: number | null,
        ): Promise<{ bytesWritten: number, buffer: TBuffer }>;

        /**
         * Asynchronously writes `string` to the file referenced by the supplied file descriptor.
         * @param fd A file descriptor.
         * @param string A string to write. If something other than a string is supplied it will be coerced to a string.
         * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
         * @param encoding The expected string encoding.
         */
        function __promisify__(fd: number, string: any, position?: number | null, encoding?: string | null): Promise<{ bytesWritten: number, buffer: string }>;
    }

    /**
     * Synchronously writes `buffer` to the file referenced by the supplied file descriptor, returning the number of bytes written.
     * @param fd A file descriptor.
     * @param offset The part of the buffer to be written. If not supplied, defaults to `0`.
     * @param length The number of bytes to write. If not supplied, defaults to `buffer.length - offset`.
     * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
     */
    function writeSync(fd: number, buffer: BinaryData, offset?: number | null, length?: number | null, position?: number | null): number;

    /**
     * Synchronously writes `string` to the file referenced by the supplied file descriptor, returning the number of bytes written.
     * @param fd A file descriptor.
     * @param string A string to write. If something other than a string is supplied it will be coerced to a string.
     * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
     * @param encoding The expected string encoding.
     */
    function writeSync(fd: number, string: any, position?: number | null, encoding?: string | null): number;

    /**
     * Asynchronously reads data from the file referenced by the supplied file descriptor.
     * @param fd A file descriptor.
     * @param buffer The buffer that the data will be written to.
     * @param offset The offset in the buffer at which to start writing.
     * @param length The number of bytes to read.
     * @param position The offset from the beginning of the file from which data should be read. If `null`, data will be read from the current position.
     */
    function read<TBuffer extends BinaryData>(
        fd: number,
        buffer: TBuffer,
        offset: number,
        length: number,
        position: number | null,
        callback?: (err: NodeJS.ErrnoException, bytesRead: number, buffer: TBuffer) => void,
    ): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace read {
        /**
         * @param fd A file descriptor.
         * @param buffer The buffer that the data will be written to.
         * @param offset The offset in the buffer at which to start writing.
         * @param length The number of bytes to read.
         * @param position The offset from the beginning of the file from which data should be read. If `null`, data will be read from the current position.
         */
        function __promisify__<TBuffer extends BinaryData>(fd: number, buffer: TBuffer, offset: number, length: number, position: number | null): Promise<{ bytesRead: number, buffer: TBuffer }>;
    }

    /**
     * Synchronously reads data from the file referenced by the supplied file descriptor, returning the number of bytes read.
     * @param fd A file descriptor.
     * @param buffer The buffer that the data will be written to.
     * @param offset The offset in the buffer at which to start writing.
     * @param length The number of bytes to read.
     * @param position The offset from the beginning of the file from which data should be read. If `null`, data will be read from the current position.
     */
    function readSync(fd: number, buffer: BinaryData, offset: number, length: number, position: number | null): number;

    /**
     * Asynchronously reads the entire contents of a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param options An object that may contain an optional flag.
     * If a flag is not provided, it defaults to `'r'`.
     */
    function readFile(path: PathLike | number, options: { encoding?: null; flag?: string; } | undefined | null, callback: (err: NodeJS.ErrnoException, data: Buffer) => void): void;

    /**
     * Asynchronously reads the entire contents of a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param options Either the encoding for the result, or an object that contains the encoding and an optional flag.
     * If a flag is not provided, it defaults to `'r'`.
     */
    function readFile(path: PathLike | number, options: { encoding: string; flag?: string; } | string, callback: (err: NodeJS.ErrnoException, data: string) => void): void;

    /**
     * Asynchronously reads the entire contents of a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param options Either the encoding for the result, or an object that contains the encoding and an optional flag.
     * If a flag is not provided, it defaults to `'r'`.
     */
    function readFile(
        path: PathLike | number,
        options: { encoding?: string | null; flag?: string; } | string | undefined | null,
        callback: (err: NodeJS.ErrnoException, data: string | Buffer) => void,
    ): void;

    /**
     * Asynchronously reads the entire contents of a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     */
    function readFile(path: PathLike | number, callback: (err: NodeJS.ErrnoException, data: Buffer) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace readFile {
        /**
         * Asynchronously reads the entire contents of a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
         * @param options An object that may contain an optional flag.
         * If a flag is not provided, it defaults to `'r'`.
         */
        function __promisify__(path: PathLike | number, options?: { encoding?: null; flag?: string; } | null): Promise<Buffer>;

        /**
         * Asynchronously reads the entire contents of a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
         * @param options Either the encoding for the result, or an object that contains the encoding and an optional flag.
         * If a flag is not provided, it defaults to `'r'`.
         */
        function __promisify__(path: PathLike | number, options: { encoding: string; flag?: string; } | string): Promise<string>;

        /**
         * Asynchronously reads the entire contents of a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
         * @param options Either the encoding for the result, or an object that contains the encoding and an optional flag.
         * If a flag is not provided, it defaults to `'r'`.
         */
        function __promisify__(path: PathLike | number, options?: { encoding?: string | null; flag?: string; } | string | null): Promise<string | Buffer>;
    }

    /**
     * Synchronously reads the entire contents of a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param options An object that may contain an optional flag. If a flag is not provided, it defaults to `'r'`.
     */
    function readFileSync(path: PathLike | number, options?: { encoding?: null; flag?: string; } | null): Buffer;

    /**
     * Synchronously reads the entire contents of a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param options Either the encoding for the result, or an object that contains the encoding and an optional flag.
     * If a flag is not provided, it defaults to `'r'`.
     */
    function readFileSync(path: PathLike | number, options: { encoding: string; flag?: string; } | string): string;

    /**
     * Synchronously reads the entire contents of a file.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param options Either the encoding for the result, or an object that contains the encoding and an optional flag.
     * If a flag is not provided, it defaults to `'r'`.
     */
    function readFileSync(path: PathLike | number, options?: { encoding?: string | null; flag?: string; } | string | null): string | Buffer;

    type WriteFileOptions = { encoding?: string | null; mode?: number | string; flag?: string; } | string | null;

    /**
     * Asynchronously writes data to a file, replacing the file if it already exists.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param data The data to write. If something other than a Buffer or Uint8Array is provided, the value is coerced to a string.
     * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
     * If `encoding` is not supplied, the default of `'utf8'` is used.
     * If `mode` is not supplied, the default of `0o666` is used.
     * If `mode` is a string, it is parsed as an octal integer.
     * If `flag` is not supplied, the default of `'w'` is used.
     */
    function writeFile(path: PathLike | number, data: any, options: WriteFileOptions, callback: (err: NodeJS.ErrnoException) => void): void;

    /**
     * Asynchronously writes data to a file, replacing the file if it already exists.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param data The data to write. If something other than a Buffer or Uint8Array is provided, the value is coerced to a string.
     */
    function writeFile(path: PathLike | number, data: any, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace writeFile {
        /**
         * Asynchronously writes data to a file, replacing the file if it already exists.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
         * @param data The data to write. If something other than a Buffer or Uint8Array is provided, the value is coerced to a string.
         * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
         * If `encoding` is not supplied, the default of `'utf8'` is used.
         * If `mode` is not supplied, the default of `0o666` is used.
         * If `mode` is a string, it is parsed as an octal integer.
         * If `flag` is not supplied, the default of `'w'` is used.
         */
        function __promisify__(path: PathLike | number, data: any, options?: WriteFileOptions): Promise<void>;
    }

    /**
     * Synchronously writes data to a file, replacing the file if it already exists.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param data The data to write. If something other than a Buffer or Uint8Array is provided, the value is coerced to a string.
     * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
     * If `encoding` is not supplied, the default of `'utf8'` is used.
     * If `mode` is not supplied, the default of `0o666` is used.
     * If `mode` is a string, it is parsed as an octal integer.
     * If `flag` is not supplied, the default of `'w'` is used.
     */
    function writeFileSync(path: PathLike | number, data: any, options?: WriteFileOptions): void;

    /**
     * Asynchronously append data to a file, creating the file if it does not exist.
     * @param file A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param data The data to write. If something other than a Buffer or Uint8Array is provided, the value is coerced to a string.
     * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
     * If `encoding` is not supplied, the default of `'utf8'` is used.
     * If `mode` is not supplied, the default of `0o666` is used.
     * If `mode` is a string, it is parsed as an octal integer.
     * If `flag` is not supplied, the default of `'a'` is used.
     */
    function appendFile(file: PathLike | number, data: any, options: WriteFileOptions, callback: (err: NodeJS.ErrnoException) => void): void;

    /**
     * Asynchronously append data to a file, creating the file if it does not exist.
     * @param file A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param data The data to write. If something other than a Buffer or Uint8Array is provided, the value is coerced to a string.
     */
    function appendFile(file: PathLike | number, data: any, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace appendFile {
        /**
         * Asynchronously append data to a file, creating the file if it does not exist.
         * @param file A path to a file. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
         * @param data The data to write. If something other than a Buffer or Uint8Array is provided, the value is coerced to a string.
         * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
         * If `encoding` is not supplied, the default of `'utf8'` is used.
         * If `mode` is not supplied, the default of `0o666` is used.
         * If `mode` is a string, it is parsed as an octal integer.
         * If `flag` is not supplied, the default of `'a'` is used.
         */
        function __promisify__(file: PathLike | number, data: any, options?: WriteFileOptions): Promise<void>;
    }

    /**
     * Synchronously append data to a file, creating the file if it does not exist.
     * @param file A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * If a file descriptor is provided, the underlying file will _not_ be closed automatically.
     * @param data The data to write. If something other than a Buffer or Uint8Array is provided, the value is coerced to a string.
     * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
     * If `encoding` is not supplied, the default of `'utf8'` is used.
     * If `mode` is not supplied, the default of `0o666` is used.
     * If `mode` is a string, it is parsed as an octal integer.
     * If `flag` is not supplied, the default of `'a'` is used.
     */
    function appendFileSync(file: PathLike | number, data: any, options?: WriteFileOptions): void;

    /**
     * Watch for changes on `filename`. The callback `listener` will be called each time the file is accessed.
     */
    function watchFile(filename: PathLike, options: { persistent?: boolean; interval?: number; } | undefined, listener: (curr: Stats, prev: Stats) => void): void;

    /**
     * Watch for changes on `filename`. The callback `listener` will be called each time the file is accessed.
     * @param filename A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function watchFile(filename: PathLike, listener: (curr: Stats, prev: Stats) => void): void;

    /**
     * Stop watching for changes on `filename`.
     * @param filename A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function unwatchFile(filename: PathLike, listener?: (curr: Stats, prev: Stats) => void): void;

    /**
     * Watch for changes on `filename`, where `filename` is either a file or a directory, returning an `FSWatcher`.
     * @param filename A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * @param options Either the encoding for the filename provided to the listener, or an object optionally specifying encoding, persistent, and recursive options.
     * If `encoding` is not supplied, the default of `'utf8'` is used.
     * If `persistent` is not supplied, the default of `true` is used.
     * If `recursive` is not supplied, the default of `false` is used.
     */
    function watch(
        filename: PathLike,
        options: { encoding?: BufferEncoding | null, persistent?: boolean, recursive?: boolean } | BufferEncoding | undefined | null,
        listener?: (event: string, filename: string) => void,
    ): FSWatcher;

    /**
     * Watch for changes on `filename`, where `filename` is either a file or a directory, returning an `FSWatcher`.
     * @param filename A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * @param options Either the encoding for the filename provided to the listener, or an object optionally specifying encoding, persistent, and recursive options.
     * If `encoding` is not supplied, the default of `'utf8'` is used.
     * If `persistent` is not supplied, the default of `true` is used.
     * If `recursive` is not supplied, the default of `false` is used.
     */
    function watch(filename: PathLike, options: { encoding: "buffer", persistent?: boolean, recursive?: boolean } | "buffer", listener?: (event: string, filename: Buffer) => void): FSWatcher;

    /**
     * Watch for changes on `filename`, where `filename` is either a file or a directory, returning an `FSWatcher`.
     * @param filename A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     * @param options Either the encoding for the filename provided to the listener, or an object optionally specifying encoding, persistent, and recursive options.
     * If `encoding` is not supplied, the default of `'utf8'` is used.
     * If `persistent` is not supplied, the default of `true` is used.
     * If `recursive` is not supplied, the default of `false` is used.
     */
    function watch(
        filename: PathLike,
        options: { encoding?: string | null, persistent?: boolean, recursive?: boolean } | string | null,
        listener?: (event: string, filename: string | Buffer) => void,
    ): FSWatcher;

    /**
     * Watch for changes on `filename`, where `filename` is either a file or a directory, returning an `FSWatcher`.
     * @param filename A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function watch(filename: PathLike, listener?: (event: string, filename: string) => any): FSWatcher;

    /**
     * Asynchronously tests whether or not the given path exists by checking with the file system.
     * @deprecated
     * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function exists(path: PathLike, callback: (exists: boolean) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace exists {
        /**
         * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         */
        function __promisify__(path: PathLike): Promise<boolean>;
    }

    /**
     * Synchronously tests whether or not the given path exists by checking with the file system.
     * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function existsSync(path: PathLike): boolean;

    namespace constants {
        // File Access Constants

        /** Constant for fs.access(). File is visible to the calling process. */
        const F_OK: number;

        /** Constant for fs.access(). File can be read by the calling process. */
        const R_OK: number;

        /** Constant for fs.access(). File can be written by the calling process. */
        const W_OK: number;

        /** Constant for fs.access(). File can be executed by the calling process. */
        const X_OK: number;

        // File Copy Constants

        /** Constant for fs.copyFile. Flag indicating the destination file should not be overwritten if it already exists. */
        const COPYFILE_EXCL: number;

        /**
         * Constant for fs.copyFile. copy operation will attempt to create a copy-on-write reflink.
         * If the underlying platform does not support copy-on-write, then a fallback copy mechanism is used.
         */
        const COPYFILE_FICLONE: number;

        /**
         * Constant for fs.copyFile. Copy operation will attempt to create a copy-on-write reflink.
         * If the underlying platform does not support copy-on-write, then the operation will fail with an error.
         */
        const COPYFILE_FICLONE_FORCE: number;

        // File Open Constants

        /** Constant for fs.open(). Flag indicating to open a file for read-only access. */
        const O_RDONLY: number;

        /** Constant for fs.open(). Flag indicating to open a file for write-only access. */
        const O_WRONLY: number;

        /** Constant for fs.open(). Flag indicating to open a file for read-write access. */
        const O_RDWR: number;

        /** Constant for fs.open(). Flag indicating to create the file if it does not already exist. */
        const O_CREAT: number;

        /** Constant for fs.open(). Flag indicating that opening a file should fail if the O_CREAT flag is set and the file already exists. */
        const O_EXCL: number;

        /**
         * Constant for fs.open(). Flag indicating that if path identifies a terminal device,
         * opening the path shall not cause that terminal to become the controlling terminal for the process
         * (if the process does not already have one).
         */
        const O_NOCTTY: number;

        /** Constant for fs.open(). Flag indicating that if the file exists and is a regular file, and the file is opened successfully for write access, its length shall be truncated to zero. */
        const O_TRUNC: number;

        /** Constant for fs.open(). Flag indicating that data will be appended to the end of the file. */
        const O_APPEND: number;

        /** Constant for fs.open(). Flag indicating that the open should fail if the path is not a directory. */
        const O_DIRECTORY: number;

        /**
         * constant for fs.open().
         * Flag indicating reading accesses to the file system will no longer result in
         * an update to the atime information associated with the file.
         * This flag is available on Linux operating systems only.
         */
        const O_NOATIME: number;

        /** Constant for fs.open(). Flag indicating that the open should fail if the path is a symbolic link. */
        const O_NOFOLLOW: number;

        /** Constant for fs.open(). Flag indicating that the file is opened for synchronous I/O. */
        const O_SYNC: number;

        /** Constant for fs.open(). Flag indicating that the file is opened for synchronous I/O with write operations waiting for data integrity. */
        const O_DSYNC: number;

        /** Constant for fs.open(). Flag indicating to open the symbolic link itself rather than the resource it is pointing to. */
        const O_SYMLINK: number;

        /** Constant for fs.open(). When set, an attempt will be made to minimize caching effects of file I/O. */
        const O_DIRECT: number;

        /** Constant for fs.open(). Flag indicating to open the file in nonblocking mode when possible. */
        const O_NONBLOCK: number;

        // File Type Constants

        /** Constant for fs.Stats mode property for determining a file's type. Bit mask used to extract the file type code. */
        const S_IFMT: number;

        /** Constant for fs.Stats mode property for determining a file's type. File type constant for a regular file. */
        const S_IFREG: number;

        /** Constant for fs.Stats mode property for determining a file's type. File type constant for a directory. */
        const S_IFDIR: number;

        /** Constant for fs.Stats mode property for determining a file's type. File type constant for a character-oriented device file. */
        const S_IFCHR: number;

        /** Constant for fs.Stats mode property for determining a file's type. File type constant for a block-oriented device file. */
        const S_IFBLK: number;

        /** Constant for fs.Stats mode property for determining a file's type. File type constant for a FIFO/pipe. */
        const S_IFIFO: number;

        /** Constant for fs.Stats mode property for determining a file's type. File type constant for a symbolic link. */
        const S_IFLNK: number;

        /** Constant for fs.Stats mode property for determining a file's type. File type constant for a socket. */
        const S_IFSOCK: number;

        // File Mode Constants

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating readable, writable and executable by owner. */
        const S_IRWXU: number;

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating readable by owner. */
        const S_IRUSR: number;

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating writable by owner. */
        const S_IWUSR: number;

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating executable by owner. */
        const S_IXUSR: number;

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating readable, writable and executable by group. */
        const S_IRWXG: number;

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating readable by group. */
        const S_IRGRP: number;

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating writable by group. */
        const S_IWGRP: number;

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating executable by group. */
        const S_IXGRP: number;

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating readable, writable and executable by others. */
        const S_IRWXO: number;

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating readable by others. */
        const S_IROTH: number;

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating writable by others. */
        const S_IWOTH: number;

        /** Constant for fs.Stats mode property for determining access permissions for a file. File mode indicating executable by others. */
        const S_IXOTH: number;
    }

    /**
     * Asynchronously tests a user's permissions for the file specified by path.
     * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function access(path: PathLike, mode: number | undefined, callback: (err: NodeJS.ErrnoException) => void): void;

    /**
     * Asynchronously tests a user's permissions for the file specified by path.
     * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function access(path: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace access {
        /**
         * Asynchronously tests a user's permissions for the file specified by path.
         * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         */
        function __promisify__(path: PathLike, mode?: number): Promise<void>;
    }

    /**
     * Synchronously tests a user's permissions for the file specified by path.
     * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function accessSync(path: PathLike, mode?: number): void;

    /**
     * Returns a new `ReadStream` object.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function createReadStream(path: PathLike, options?: string | {
        flags?: string;
        encoding?: string;
        fd?: number;
        mode?: number;
        autoClose?: boolean;
        start?: number;
        end?: number;
        highWaterMark?: number;
    }): ReadStream;

    /**
     * Returns a new `WriteStream` object.
     * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
     * URL support is _experimental_.
     */
    function createWriteStream(path: PathLike, options?: string | {
        flags?: string;
        encoding?: string;
        fd?: number;
        mode?: number;
        autoClose?: boolean;
        start?: number;
    }): WriteStream;

    /**
     * Asynchronous fdatasync(2) - synchronize a file's in-core state with storage device.
     * @param fd A file descriptor.
     */
    function fdatasync(fd: number, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace fdatasync {
        /**
         * Asynchronous fdatasync(2) - synchronize a file's in-core state with storage device.
         * @param fd A file descriptor.
         */
        function __promisify__(fd: number): Promise<void>;
    }

    /**
     * Synchronous fdatasync(2) - synchronize a file's in-core state with storage device.
     * @param fd A file descriptor.
     */
    function fdatasyncSync(fd: number): void;

    /**
     * Asynchronously copies src to dest. By default, dest is overwritten if it already exists.
     * No arguments other than a possible exception are given to the callback function.
     * Node.js makes no guarantees about the atomicity of the copy operation.
     * If an error occurs after the destination file has been opened for writing, Node.js will attempt
     * to remove the destination.
     * @param src A path to the source file.
     * @param dest A path to the destination file.
     */
    function copyFile(src: PathLike, dest: PathLike, callback: (err: NodeJS.ErrnoException) => void): void;
    /**
     * Asynchronously copies src to dest. By default, dest is overwritten if it already exists.
     * No arguments other than a possible exception are given to the callback function.
     * Node.js makes no guarantees about the atomicity of the copy operation.
     * If an error occurs after the destination file has been opened for writing, Node.js will attempt
     * to remove the destination.
     * @param src A path to the source file.
     * @param dest A path to the destination file.
     * @param flags An integer that specifies the behavior of the copy operation. The only supported flag is fs.constants.COPYFILE_EXCL, which causes the copy operation to fail if dest already exists.
     */
    function copyFile(src: PathLike, dest: PathLike, flags: number, callback: (err: NodeJS.ErrnoException) => void): void;

    // NOTE: This namespace provides design-time support for util.promisify. Exported members do not exist at runtime.
    namespace copyFile {
        /**
         * Asynchronously copies src to dest. By default, dest is overwritten if it already exists.
         * No arguments other than a possible exception are given to the callback function.
         * Node.js makes no guarantees about the atomicity of the copy operation.
         * If an error occurs after the destination file has been opened for writing, Node.js will attempt
         * to remove the destination.
         * @param src A path to the source file.
         * @param dest A path to the destination file.
         * @param flags An optional integer that specifies the behavior of the copy operation.
         * The only supported flag is fs.constants.COPYFILE_EXCL,
         * which causes the copy operation to fail if dest already exists.
         */
        function __promisify__(src: PathLike, dst: PathLike, flags?: number): Promise<void>;
    }

    /**
     * Synchronously copies src to dest. By default, dest is overwritten if it already exists.
     * Node.js makes no guarantees about the atomicity of the copy operation.
     * If an error occurs after the destination file has been opened for writing, Node.js will attempt
     * to remove the destination.
     * @param src A path to the source file.
     * @param dest A path to the destination file.
     * @param flags An optional integer that specifies the behavior of the copy operation.
     * The only supported flag is fs.constants.COPYFILE_EXCL, which causes the copy operation to fail if dest already exists.
     */
    function copyFileSync(src: PathLike, dest: PathLike, flags?: number): void;

    namespace promises {
        interface FileHandle {
            /**
             * Gets the file descriptor for this file handle.
             */
            readonly fd: number;

            /**
             * Asynchronously append data to a file, creating the file if it does not exist. The underlying file will _not_ be closed automatically.
             * The `FileHandle` must have been opened for appending.
             * @param data The data to write. If something other than a `Buffer` or `Uint8Array` is provided, the value is coerced to a string.
             * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
             * If `encoding` is not supplied, the default of `'utf8'` is used.
             * If `mode` is not supplied, the default of `0o666` is used.
             * If `mode` is a string, it is parsed as an octal integer.
             * If `flag` is not supplied, the default of `'a'` is used.
             */
            appendFile(data: any, options?: { encoding?: string | null, mode?: string | number, flag?: string | number } | string | null): Promise<void>;

            /**
             * Asynchronous fchown(2) - Change ownership of a file.
             */
            chown(uid: number, gid: number): Promise<void>;

            /**
             * Asynchronous fchmod(2) - Change permissions of a file.
             * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
             */
            chmod(mode: string | number): Promise<void>;

            /**
             * Asynchronous fdatasync(2) - synchronize a file's in-core state with storage device.
             */
            datasync(): Promise<void>;

            /**
             * Asynchronous fsync(2) - synchronize a file's in-core state with the underlying storage device.
             */
            sync(): Promise<void>;

            /**
             * Asynchronously reads data from the file.
             * The `FileHandle` must have been opened for reading.
             * @param buffer The buffer that the data will be written to.
             * @param offset The offset in the buffer at which to start writing.
             * @param length The number of bytes to read.
             * @param position The offset from the beginning of the file from which data should be read. If `null`, data will be read from the current position.
             */
            read<TBuffer extends Buffer | Uint8Array>(buffer: TBuffer, offset?: number | null, length?: number | null, position?: number | null): Promise<{ bytesRead: number, buffer: TBuffer }>;

            /**
             * Asynchronously reads the entire contents of a file. The underlying file will _not_ be closed automatically.
             * The `FileHandle` must have been opened for reading.
             * @param options An object that may contain an optional flag.
             * If a flag is not provided, it defaults to `'r'`.
             */
            readFile(options?: { encoding?: null, flag?: string | number } | null): Promise<Buffer>;

            /**
             * Asynchronously reads the entire contents of a file. The underlying file will _not_ be closed automatically.
             * The `FileHandle` must have been opened for reading.
             * @param options An object that may contain an optional flag.
             * If a flag is not provided, it defaults to `'r'`.
             */
            readFile(options: { encoding: BufferEncoding, flag?: string | number } | BufferEncoding): Promise<string>;

            /**
             * Asynchronously reads the entire contents of a file. The underlying file will _not_ be closed automatically.
             * The `FileHandle` must have been opened for reading.
             * @param options An object that may contain an optional flag.
             * If a flag is not provided, it defaults to `'r'`.
             */
            readFile(options?: { encoding?: string | null, flag?: string | number } | string | null): Promise<string | Buffer>;

            /**
             * Asynchronous fstat(2) - Get file status.
             */
            stat(): Promise<Stats>;

            /**
             * Asynchronous ftruncate(2) - Truncate a file to a specified length.
             * @param len If not specified, defaults to `0`.
             */
            truncate(len?: number): Promise<void>;

            /**
             * Asynchronously change file timestamps of the file.
             * @param atime The last access time. If a string is provided, it will be coerced to number.
             * @param mtime The last modified time. If a string is provided, it will be coerced to number.
             */
            utimes(atime: string | number | Date, mtime: string | number | Date): Promise<void>;

            /**
             * Asynchronously writes `buffer` to the file.
             * The `FileHandle` must have been opened for writing.
             * @param buffer The buffer that the data will be written to.
             * @param offset The part of the buffer to be written. If not supplied, defaults to `0`.
             * @param length The number of bytes to write. If not supplied, defaults to `buffer.length - offset`.
             * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
             */
            write<TBuffer extends Buffer | Uint8Array>(buffer: TBuffer, offset?: number | null, length?: number | null, position?: number | null): Promise<{ bytesWritten: number, buffer: TBuffer }>;

            /**
             * Asynchronously writes `string` to the file.
             * The `FileHandle` must have been opened for writing.
             * It is unsafe to call `write()` multiple times on the same file without waiting for the `Promise`
             * to be resolved (or rejected). For this scenario, `fs.createWriteStream` is strongly recommended.
             * @param string A string to write. If something other than a string is supplied it will be coerced to a string.
             * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
             * @param encoding The expected string encoding.
             */
            write(data: any, position?: number | null, encoding?: string | null): Promise<{ bytesWritten: number, buffer: string }>;

            /**
             * Asynchronously writes data to a file, replacing the file if it already exists. The underlying file will _not_ be closed automatically.
             * The `FileHandle` must have been opened for writing.
             * It is unsafe to call `writeFile()` multiple times on the same file without waiting for the `Promise` to be resolved (or rejected).
             * @param data The data to write. If something other than a `Buffer` or `Uint8Array` is provided, the value is coerced to a string.
             * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
             * If `encoding` is not supplied, the default of `'utf8'` is used.
             * If `mode` is not supplied, the default of `0o666` is used.
             * If `mode` is a string, it is parsed as an octal integer.
             * If `flag` is not supplied, the default of `'w'` is used.
             */
            writeFile(data: any, options?: { encoding?: string | null, mode?: string | number, flag?: string | number } | string | null): Promise<void>;

            /**
             * Asynchronous close(2) - close a `FileHandle`.
             */
            close(): Promise<void>;
        }

        /**
         * Asynchronously tests a user's permissions for the file specified by path.
         * @param path A path to a file or directory. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         */
        function access(path: PathLike, mode?: number): Promise<void>;

        /**
         * Asynchronously copies `src` to `dest`. By default, `dest` is overwritten if it already exists.
         * Node.js makes no guarantees about the atomicity of the copy operation.
         * If an error occurs after the destination file has been opened for writing, Node.js will attempt
         * to remove the destination.
         * @param src A path to the source file.
         * @param dest A path to the destination file.
         * @param flags An optional integer that specifies the behavior of the copy operation. The only
         * supported flag is `fs.constants.COPYFILE_EXCL`, which causes the copy operation to fail if
         * `dest` already exists.
         */
        function copyFile(src: PathLike, dest: PathLike, flags?: number): Promise<void>;

        /**
         * Asynchronous open(2) - open and possibly create a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param mode A file mode. If a string is passed, it is parsed as an octal integer. If not
         * supplied, defaults to `0o666`.
         */
        function open(path: PathLike, flags: string | number, mode?: string | number): Promise<FileHandle>;

        /**
         * Asynchronously reads data from the file referenced by the supplied `FileHandle`.
         * @param handle A `FileHandle`.
         * @param buffer The buffer that the data will be written to.
         * @param offset The offset in the buffer at which to start writing.
         * @param length The number of bytes to read.
         * @param position The offset from the beginning of the file from which data should be read. If
         * `null`, data will be read from the current position.
         */
        function read<TBuffer extends Buffer | Uint8Array>(
            handle: FileHandle,
            buffer: TBuffer,
            offset?: number | null,
            length?: number | null,
            position?: number | null,
        ): Promise<{ bytesRead: number, buffer: TBuffer }>;

        /**
         * Asynchronously writes `buffer` to the file referenced by the supplied `FileHandle`.
         * It is unsafe to call `fsPromises.write()` multiple times on the same file without waiting for the `Promise`
         * to be resolved (or rejected). For this scenario, `fs.createWriteStream` is strongly recommended.
         * @param handle A `FileHandle`.
         * @param buffer The buffer that the data will be written to.
         * @param offset The part of the buffer to be written. If not supplied, defaults to `0`.
         * @param length The number of bytes to write. If not supplied, defaults to `buffer.length - offset`.
         * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
         */
        function write<TBuffer extends Buffer | Uint8Array>(
            handle: FileHandle,
            buffer: TBuffer,
            offset?: number | null,
            length?: number | null, position?: number | null): Promise<{ bytesWritten: number, buffer: TBuffer }>;

        /**
         * Asynchronously writes `string` to the file referenced by the supplied `FileHandle`.
         * It is unsafe to call `fsPromises.write()` multiple times on the same file without waiting for the `Promise`
         * to be resolved (or rejected). For this scenario, `fs.createWriteStream` is strongly recommended.
         * @param handle A `FileHandle`.
         * @param string A string to write. If something other than a string is supplied it will be coerced to a string.
         * @param position The offset from the beginning of the file where this data should be written. If not supplied, defaults to the current position.
         * @param encoding The expected string encoding.
         */
        function write(handle: FileHandle, string: any, position?: number | null, encoding?: string | null): Promise<{ bytesWritten: number, buffer: string }>;

        /**
         * Asynchronous rename(2) - Change the name or location of a file or directory.
         * @param oldPath A path to a file. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         * @param newPath A path to a file. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         */
        function rename(oldPath: PathLike, newPath: PathLike): Promise<void>;

        /**
         * Asynchronous truncate(2) - Truncate a file to a specified length.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param len If not specified, defaults to `0`.
         */
        function truncate(path: PathLike, len?: number): Promise<void>;

        /**
         * Asynchronous ftruncate(2) - Truncate a file to a specified length.
         * @param handle A `FileHandle`.
         * @param len If not specified, defaults to `0`.
         */
        function ftruncate(handle: FileHandle, len?: number): Promise<void>;

        /**
         * Asynchronous rmdir(2) - delete a directory.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function rmdir(path: PathLike): Promise<void>;

        /**
         * Asynchronous fdatasync(2) - synchronize a file's in-core state with storage device.
         * @param handle A `FileHandle`.
         */
        function fdatasync(handle: FileHandle): Promise<void>;

        /**
         * Asynchronous fsync(2) - synchronize a file's in-core state with the underlying storage device.
         * @param handle A `FileHandle`.
         */
        function fsync(handle: FileHandle): Promise<void>;

        /**
         * Asynchronous mkdir(2) - create a directory.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options Either the file mode, or an object optionally specifying the file mode and whether parent folders
         * should be created. If a string is passed, it is parsed as an octal integer. If not specified, defaults to `0o777`.
         */
        function mkdir(path: PathLike, options?: number | string | MakeDirectoryOptions | null): Promise<void>;

        /**
         * Asynchronous readdir(3) - read a directory.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function readdir(path: PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string[]>;

        /**
         * Asynchronous readdir(3) - read a directory.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function readdir(path: PathLike, options: { encoding: "buffer" } | "buffer"): Promise<Buffer[]>;

        /**
         * Asynchronous readdir(3) - read a directory.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function readdir(path: PathLike, options?: { encoding?: string | null } | string | null): Promise<string[] | Buffer[]>;

        /**
         * Asynchronous readlink(2) - read value of a symbolic link.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function readlink(path: PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string>;

        /**
         * Asynchronous readlink(2) - read value of a symbolic link.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function readlink(path: PathLike, options: { encoding: "buffer" } | "buffer"): Promise<Buffer>;

        /**
         * Asynchronous readlink(2) - read value of a symbolic link.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function readlink(path: PathLike, options?: { encoding?: string | null } | string | null): Promise<string | Buffer>;

        /**
         * Asynchronous symlink(2) - Create a new symbolic link to an existing file.
         * @param target A path to an existing file. If a URL is provided, it must use the `file:` protocol.
         * @param path A path to the new symlink. If a URL is provided, it must use the `file:` protocol.
         * @param type May be set to `'dir'`, `'file'`, or `'junction'` (default is `'file'`) and is only available on Windows (ignored on other platforms).
         * When using `'junction'`, the `target` argument will automatically be normalized to an absolute path.
         */
        function symlink(target: PathLike, path: PathLike, type?: string | null): Promise<void>;

        /**
         * Asynchronous fstat(2) - Get file status.
         * @param handle A `FileHandle`.
         */
        function fstat(handle: FileHandle): Promise<Stats>;

        /**
         * Asynchronous lstat(2) - Get file status. Does not dereference symbolic links.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function lstat(path: PathLike): Promise<Stats>;

        /**
         * Asynchronous stat(2) - Get file status.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function stat(path: PathLike): Promise<Stats>;

        /**
         * Asynchronous link(2) - Create a new link (also known as a hard link) to an existing file.
         * @param existingPath A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param newPath A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function link(existingPath: PathLike, newPath: PathLike): Promise<void>;

        /**
         * Asynchronous unlink(2) - delete a name and possibly the file it refers to.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function unlink(path: PathLike): Promise<void>;

        /**
         * Asynchronous fchmod(2) - Change permissions of a file.
         * @param handle A `FileHandle`.
         * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
         */
        function fchmod(handle: FileHandle, mode: string | number): Promise<void>;

        /**
         * Asynchronous chmod(2) - Change permissions of a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
         */
        function chmod(path: PathLike, mode: string | number): Promise<void>;

        /**
         * Asynchronous lchmod(2) - Change permissions of a file. Does not dereference symbolic links.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param mode A file mode. If a string is passed, it is parsed as an octal integer.
         */
        function lchmod(path: PathLike, mode: string | number): Promise<void>;

        /**
         * Asynchronous lchown(2) - Change ownership of a file. Does not dereference symbolic links.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function lchown(path: PathLike, uid: number, gid: number): Promise<void>;

        /**
         * Asynchronous fchown(2) - Change ownership of a file.
         * @param handle A `FileHandle`.
         */
        function fchown(handle: FileHandle, uid: number, gid: number): Promise<void>;

        /**
         * Asynchronous chown(2) - Change ownership of a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         */
        function chown(path: PathLike, uid: number, gid: number): Promise<void>;

        /**
         * Asynchronously change file timestamps of the file referenced by the supplied path.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param atime The last access time. If a string is provided, it will be coerced to number.
         * @param mtime The last modified time. If a string is provided, it will be coerced to number.
         */
        function utimes(path: PathLike, atime: string | number | Date, mtime: string | number | Date): Promise<void>;

        /**
         * Asynchronously change file timestamps of the file referenced by the supplied `FileHandle`.
         * @param handle A `FileHandle`.
         * @param atime The last access time. If a string is provided, it will be coerced to number.
         * @param mtime The last modified time. If a string is provided, it will be coerced to number.
         */
        function futimes(handle: FileHandle, atime: string | number | Date, mtime: string | number | Date): Promise<void>;

        /**
         * Asynchronous realpath(3) - return the canonicalized absolute pathname.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function realpath(path: PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string>;

        /**
         * Asynchronous realpath(3) - return the canonicalized absolute pathname.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function realpath(path: PathLike, options: { encoding: "buffer" } | "buffer"): Promise<Buffer>;

        /**
         * Asynchronous realpath(3) - return the canonicalized absolute pathname.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function realpath(path: PathLike, options?: { encoding?: string | null } | string | null): Promise<string | Buffer>;

        /**
         * Asynchronously creates a unique temporary directory.
         * Generates six random characters to be appended behind a required `prefix` to create a unique temporary directory.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function mkdtemp(prefix: string, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string>;

        /**
         * Asynchronously creates a unique temporary directory.
         * Generates six random characters to be appended behind a required `prefix` to create a unique temporary directory.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function mkdtemp(prefix: string, options: { encoding: "buffer" } | "buffer"): Promise<Buffer>;

        /**
         * Asynchronously creates a unique temporary directory.
         * Generates six random characters to be appended behind a required `prefix` to create a unique temporary directory.
         * @param options The encoding (or an object specifying the encoding), used as the encoding of the result. If not provided, `'utf8'` is used.
         */
        function mkdtemp(prefix: string, options?: { encoding?: string | null } | string | null): Promise<string | Buffer>;

        /**
         * Asynchronously writes data to a file, replacing the file if it already exists.
         * It is unsafe to call `fsPromises.writeFile()` multiple times on the same file without waiting for the `Promise` to be resolved (or rejected).
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         * If a `FileHandle` is provided, the underlying file will _not_ be closed automatically.
         * @param data The data to write. If something other than a `Buffer` or `Uint8Array` is provided, the value is coerced to a string.
         * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
         * If `encoding` is not supplied, the default of `'utf8'` is used.
         * If `mode` is not supplied, the default of `0o666` is used.
         * If `mode` is a string, it is parsed as an octal integer.
         * If `flag` is not supplied, the default of `'w'` is used.
         */
        function writeFile(path: PathLike | FileHandle, data: any, options?: { encoding?: string | null, mode?: string | number, flag?: string | number } | string | null): Promise<void>;

        /**
         * Asynchronously append data to a file, creating the file if it does not exist.
         * @param file A path to a file. If a URL is provided, it must use the `file:` protocol.
         * URL support is _experimental_.
         * If a `FileHandle` is provided, the underlying file will _not_ be closed automatically.
         * @param data The data to write. If something other than a `Buffer` or `Uint8Array` is provided, the value is coerced to a string.
         * @param options Either the encoding for the file, or an object optionally specifying the encoding, file mode, and flag.
         * If `encoding` is not supplied, the default of `'utf8'` is used.
         * If `mode` is not supplied, the default of `0o666` is used.
         * If `mode` is a string, it is parsed as an octal integer.
         * If `flag` is not supplied, the default of `'a'` is used.
         */
        function appendFile(path: PathLike | FileHandle, data: any, options?: { encoding?: string | null, mode?: string | number, flag?: string | number } | string | null): Promise<void>;

        /**
         * Asynchronously reads the entire contents of a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * If a `FileHandle` is provided, the underlying file will _not_ be closed automatically.
         * @param options An object that may contain an optional flag.
         * If a flag is not provided, it defaults to `'r'`.
         */
        function readFile(path: PathLike | FileHandle, options?: { encoding?: null, flag?: string | number } | null): Promise<Buffer>;

        /**
         * Asynchronously reads the entire contents of a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * If a `FileHandle` is provided, the underlying file will _not_ be closed automatically.
         * @param options An object that may contain an optional flag.
         * If a flag is not provided, it defaults to `'r'`.
         */
        function readFile(path: PathLike | FileHandle, options: { encoding: BufferEncoding, flag?: string | number } | BufferEncoding): Promise<string>;

        /**
         * Asynchronously reads the entire contents of a file.
         * @param path A path to a file. If a URL is provided, it must use the `file:` protocol.
         * If a `FileHandle` is provided, the underlying file will _not_ be closed automatically.
         * @param options An object that may contain an optional flag.
         * If a flag is not provided, it defaults to `'r'`.
         */
        function readFile(path: PathLike | FileHandle, options?: { encoding?: string | null, flag?: string | number } | string | null): Promise<string | Buffer>;
    }
}

declare module "path" {
    /**
     * A parsed path object generated by path.parse() or consumed by path.format().
     */
    interface ParsedPath {
        /**
         * The root of the path such as '/' or 'c:\'
         */
        root: string;
        /**
         * The full directory path such as '/home/user/dir' or 'c:\path\dir'
         */
        dir: string;
        /**
         * The file name including extension (if any) such as 'index.html'
         */
        base: string;
        /**
         * The file extension (if any) such as '.html'
         */
        ext: string;
        /**
         * The file name without extension (if any) such as 'index'
         */
        name: string;
    }
    interface FormatInputPathObject {
        /**
         * The root of the path such as '/' or 'c:\'
         */
        root?: string;
        /**
         * The full directory path such as '/home/user/dir' or 'c:\path\dir'
         */
        dir?: string;
        /**
         * The file name including extension (if any) such as 'index.html'
         */
        base?: string;
        /**
         * The file extension (if any) such as '.html'
         */
        ext?: string;
        /**
         * The file name without extension (if any) such as 'index'
         */
        name?: string;
    }

    /**
     * Normalize a string path, reducing '..' and '.' parts.
     * When multiple slashes are found, they're replaced by a single one; when the path contains a trailing slash, it is preserved. On Windows backslashes are used.
     *
     * @param p string path to normalize.
     */
    function normalize(p: string): string;
    /**
     * Join all arguments together and normalize the resulting path.
     * Arguments must be strings. In v0.8, non-string arguments were silently ignored. In v0.10 and up, an exception is thrown.
     *
     * @param paths paths to join.
     */
    function join(...paths: string[]): string;
    /**
     * The right-most parameter is considered {to}.  Other parameters are considered an array of {from}.
     *
     * Starting from leftmost {from} parameter, resolves {to} to an absolute path.
     *
     * If {to} isn't already absolute, {from} arguments are prepended in right to left order,
     * until an absolute path is found. If after using all {from} paths still no absolute path is found,
     * the current working directory is used as well. The resulting path is normalized,
     * and trailing slashes are removed unless the path gets resolved to the root directory.
     *
     * @param pathSegments string paths to join.  Non-string arguments are ignored.
     */
    function resolve(...pathSegments: string[]): string;
    /**
     * Determines whether {path} is an absolute path. An absolute path will always resolve to the same location, regardless of the working directory.
     *
     * @param path path to test.
     */
    function isAbsolute(path: string): boolean;
    /**
     * Solve the relative path from {from} to {to}.
     * At times we have two absolute paths, and we need to derive the relative path from one to the other. This is actually the reverse transform of path.resolve.
     */
    function relative(from: string, to: string): string;
    /**
     * Return the directory name of a path. Similar to the Unix dirname command.
     *
     * @param p the path to evaluate.
     */
    function dirname(p: string): string;
    /**
     * Return the last portion of a path. Similar to the Unix basename command.
     * Often used to extract the file name from a fully qualified path.
     *
     * @param p the path to evaluate.
     * @param ext optionally, an extension to remove from the result.
     */
    function basename(p: string, ext?: string): string;
    /**
     * Return the extension of the path, from the last '.' to end of string in the last portion of the path.
     * If there is no '.' in the last portion of the path or the first character of it is '.', then it returns an empty string
     *
     * @param p the path to evaluate.
     */
    function extname(p: string): string;
    /**
     * The platform-specific file separator. '\\' or '/'.
     */
    const sep: '\\' | '/';
    /**
     * The platform-specific file delimiter. ';' or ':'.
     */
    const delimiter: ';' | ':';
    /**
     * Returns an object from a path string - the opposite of format().
     *
     * @param pathString path to evaluate.
     */
    function parse(pathString: string): ParsedPath;
    /**
     * Returns a path string from an object - the opposite of parse().
     *
     * @param pathString path to evaluate.
     */
    function format(pathObject: FormatInputPathObject): string;

    namespace posix {
        function normalize(p: string): string;
        function join(...paths: any[]): string;
        function resolve(...pathSegments: any[]): string;
        function isAbsolute(p: string): boolean;
        function relative(from: string, to: string): string;
        function dirname(p: string): string;
        function basename(p: string, ext?: string): string;
        function extname(p: string): string;
        const sep: string;
        const delimiter: string;
        function parse(p: string): ParsedPath;
        function format(pP: FormatInputPathObject): string;
    }

    namespace win32 {
        function normalize(p: string): string;
        function join(...paths: any[]): string;
        function resolve(...pathSegments: any[]): string;
        function isAbsolute(p: string): boolean;
        function relative(from: string, to: string): string;
        function dirname(p: string): string;
        function basename(p: string, ext?: string): string;
        function extname(p: string): string;
        const sep: string;
        const delimiter: string;
        function parse(p: string): ParsedPath;
        function format(pP: FormatInputPathObject): string;
    }
}

declare module "string_decoder" {
    interface NodeStringDecoder {
        write(buffer: Buffer): string;
        end(buffer?: Buffer): string;
    }
    const StringDecoder: {
        new(encoding?: string): NodeStringDecoder;
    };
}

declare module "tls" {
    import * as crypto from "crypto";
    import * as dns from "dns";
    import * as net from "net";
    import * as stream from "stream";

    const CLIENT_RENEG_LIMIT: number;
    const CLIENT_RENEG_WINDOW: number;

    interface Certificate {
        /**
         * Country code.
         */
        C: string;
        /**
         * Street.
         */
        ST: string;
        /**
         * Locality.
         */
        L: string;
        /**
         * Organization.
         */
        O: string;
        /**
         * Organizational unit.
         */
        OU: string;
        /**
         * Common name.
         */
        CN: string;
    }

    interface PeerCertificate {
        subject: Certificate;
        issuer: Certificate;
        subjectaltname: string;
        infoAccess: { [index: string]: string[] | undefined };
        modulus: string;
        exponent: string;
        valid_from: string;
        valid_to: string;
        fingerprint: string;
        ext_key_usage: string[];
        serialNumber: string;
        raw: Buffer;
    }

    interface DetailedPeerCertificate extends PeerCertificate {
        issuerCertificate: DetailedPeerCertificate;
    }

    interface CipherNameAndProtocol {
        /**
         * The cipher name.
         */
        name: string;
        /**
         * SSL/TLS protocol version.
         */
        version: string;
    }

    class TLSSocket extends net.Socket {
        /**
         * Construct a new tls.TLSSocket object from an existing TCP socket.
         */
        constructor(socket: net.Socket, options?: {
            /**
             * An optional TLS context object from tls.createSecureContext()
             */
            secureContext?: SecureContext,
            /**
             * If true the TLS socket will be instantiated in server-mode.
             * Defaults to false.
             */
            isServer?: boolean,
            /**
             * An optional net.Server instance.
             */
            server?: net.Server,
            /**
             * If true the server will request a certificate from clients that
             * connect and attempt to verify that certificate. Defaults to
             * false.
             */
            requestCert?: boolean,
            /**
             * If true the server will reject any connection which is not
             * authorized with the list of supplied CAs. This option only has an
             * effect if requestCert is true. Defaults to false.
             */
            rejectUnauthorized?: boolean,
            /**
             * An array of strings or a Buffer naming possible NPN protocols.
             * (Protocols should be ordered by their priority.)
             */
            NPNProtocols?: string[] | Buffer[] | Uint8Array[] | Buffer | Uint8Array,
            /**
             * An array of strings or a Buffer naming possible ALPN protocols.
             * (Protocols should be ordered by their priority.) When the server
             * receives both NPN and ALPN extensions from the client, ALPN takes
             * precedence over NPN and the server does not send an NPN extension
             * to the client.
             */
            ALPNProtocols?: string[] | Buffer[] | Uint8Array[] | Buffer | Uint8Array,
            /**
             * SNICallback(servername, cb) <Function> A function that will be
             * called if the client supports SNI TLS extension. Two arguments
             * will be passed when called: servername and cb. SNICallback should
             * invoke cb(null, ctx), where ctx is a SecureContext instance.
             * (tls.createSecureContext(...) can be used to get a proper
             * SecureContext.) If SNICallback wasn't provided the default callback
             * with high-level API will be used (see below).
             */
            SNICallback?: (servername: string, cb: (err: Error | null, ctx: SecureContext) => void) => void,
            /**
             * An optional Buffer instance containing a TLS session.
             */
            session?: Buffer,
            /**
             * If true, specifies that the OCSP status request extension will be
             * added to the client hello and an 'OCSPResponse' event will be
             * emitted on the socket before establishing a secure communication
             */
            requestOCSP?: boolean
        });

        /**
         * A boolean that is true if the peer certificate was signed by one of the specified CAs, otherwise false.
         */
        authorized: boolean;
        /**
         * The reason why the peer's certificate has not been verified.
         * This property becomes available only when tlsSocket.authorized === false.
         */
        authorizationError: Error;
        /**
         * Static boolean value, always true.
         * May be used to distinguish TLS sockets from regular ones.
         */
        encrypted: boolean;

        /**
         * String containing the selected ALPN protocol.
         * When ALPN has no selected protocol, tlsSocket.alpnProtocol equals false.
         */
        alpnProtocol?: string;

        /**
         * Returns an object representing the cipher name and the SSL/TLS protocol version of the current connection.
         * @returns Returns an object representing the cipher name
         * and the SSL/TLS protocol version of the current connection.
         */
        getCipher(): CipherNameAndProtocol;
        /**
         * Returns an object representing the peer's certificate.
         * The returned object has some properties corresponding to the field of the certificate.
         * If detailed argument is true the full chain with issuer property will be returned,
         * if false only the top certificate without issuer property.
         * If the peer does not provide a certificate, it returns null or an empty object.
         * @param detailed - If true; the full chain with issuer property will be returned.
         * @returns An object representing the peer's certificate.
         */
        getPeerCertificate(detailed: true): DetailedPeerCertificate;
        getPeerCertificate(detailed?: false): PeerCertificate;
        getPeerCertificate(detailed?: boolean): PeerCertificate | DetailedPeerCertificate;
        /**
         * Returns a string containing the negotiated SSL/TLS protocol version of the current connection.
         * The value `'unknown'` will be returned for connected sockets that have not completed the handshaking process.
         * The value `null` will be returned for server sockets or disconnected client sockets.
         * See https://www.openssl.org/docs/man1.0.2/ssl/SSL_get_version.html for more information.
         * @returns negotiated SSL/TLS protocol version of the current connection
         */
        getProtocol(): string | null;
        /**
         * Could be used to speed up handshake establishment when reconnecting to the server.
         * @returns ASN.1 encoded TLS session or undefined if none was negotiated.
         */
        getSession(): any;
        /**
         * NOTE: Works only with client TLS sockets.
         * Useful only for debugging, for session reuse provide session option to tls.connect().
         * @returns TLS session ticket or undefined if none was negotiated.
         */
        getTLSTicket(): any;
        /**
         * Initiate TLS renegotiation process.
         *
         * NOTE: Can be used to request peer's certificate after the secure connection has been established.
         * ANOTHER NOTE: When running as the server, socket will be destroyed with an error after handshakeTimeout timeout.
         * @param options - The options may contain the following fields: rejectUnauthorized,
         * requestCert (See tls.createServer() for details).
         * @param callback - callback(err) will be executed with null as err, once the renegotiation
         * is successfully completed.
         */
        renegotiate(options: { rejectUnauthorized?: boolean, requestCert?: boolean }, callback: (err: Error | null) => void): any;
        /**
         * Set maximum TLS fragment size (default and maximum value is: 16384, minimum is: 512).
         * Smaller fragment size decreases buffering latency on the client: large fragments are buffered by
         * the TLS layer until the entire fragment is received and its integrity is verified;
         * large fragments can span multiple roundtrips, and their processing can be delayed due to packet
         * loss or reordering. However, smaller fragments add extra TLS framing bytes and CPU overhead,
         * which may decrease overall server throughput.
         * @param size - TLS fragment size (default and maximum value is: 16384, minimum is: 512).
         * @returns Returns true on success, false otherwise.
         */
        setMaxSendFragment(size: number): boolean;

        /**
         * events.EventEmitter
         * 1. OCSPResponse
         * 2. secureConnect
         */
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "OCSPResponse", listener: (response: Buffer) => void): this;
        addListener(event: "secureConnect", listener: () => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "OCSPResponse", response: Buffer): boolean;
        emit(event: "secureConnect"): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "OCSPResponse", listener: (response: Buffer) => void): this;
        on(event: "secureConnect", listener: () => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "OCSPResponse", listener: (response: Buffer) => void): this;
        once(event: "secureConnect", listener: () => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "OCSPResponse", listener: (response: Buffer) => void): this;
        prependListener(event: "secureConnect", listener: () => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "OCSPResponse", listener: (response: Buffer) => void): this;
        prependOnceListener(event: "secureConnect", listener: () => void): this;
    }

    interface TlsOptions extends SecureContextOptions {
        handshakeTimeout?: number;
        requestCert?: boolean;
        rejectUnauthorized?: boolean;
        NPNProtocols?: string[] | Buffer[] | Uint8Array[] | Buffer | Uint8Array;
        ALPNProtocols?: string[] | Buffer[] | Uint8Array[] | Buffer | Uint8Array;
        SNICallback?: (servername: string, cb: (err: Error | null, ctx: SecureContext) => void) => void;
        sessionTimeout?: number;
        ticketKeys?: Buffer;
    }

    interface ConnectionOptions extends SecureContextOptions {
        host?: string;
        port?: number;
        path?: string; // Creates unix socket connection to path. If this option is specified, `host` and `port` are ignored.
        socket?: net.Socket; // Establish secure connection on a given socket rather than creating a new socket
        rejectUnauthorized?: boolean; // Defaults to true
        NPNProtocols?: string[] | Buffer[] | Uint8Array[] | Buffer | Uint8Array;
        ALPNProtocols?: string[] | Buffer[] | Uint8Array[] | Buffer | Uint8Array;
        checkServerIdentity?: typeof checkServerIdentity;
        servername?: string; // SNI TLS Extension
        session?: Buffer;
        minDHSize?: number;
        secureContext?: SecureContext; // If not provided, the entire ConnectionOptions object will be passed to tls.createSecureContext()
        lookup?: net.LookupFunction;
    }

    class Server extends net.Server {
        addContext(hostName: string, credentials: {
            key: string;
            cert: string;
            ca: string;
        }): void;

        /**
         * events.EventEmitter
         * 1. tlsClientError
         * 2. newSession
         * 3. OCSPRequest
         * 4. resumeSession
         * 5. secureConnection
         */
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "tlsClientError", listener: (err: Error, tlsSocket: TLSSocket) => void): this;
        addListener(event: "newSession", listener: (sessionId: any, sessionData: any, callback: (err: Error, resp: Buffer) => void) => void): this;
        addListener(event: "OCSPRequest", listener: (certificate: Buffer, issuer: Buffer, callback: Function) => void): this;
        addListener(event: "resumeSession", listener: (sessionId: any, callback: (err: Error, sessionData: any) => void) => void): this;
        addListener(event: "secureConnection", listener: (tlsSocket: TLSSocket) => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "tlsClientError", err: Error, tlsSocket: TLSSocket): boolean;
        emit(event: "newSession", sessionId: any, sessionData: any, callback: (err: Error, resp: Buffer) => void): boolean;
        emit(event: "OCSPRequest", certificate: Buffer, issuer: Buffer, callback: Function): boolean;
        emit(event: "resumeSession", sessionId: any, callback: (err: Error, sessionData: any) => void): boolean;
        emit(event: "secureConnection", tlsSocket: TLSSocket): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "tlsClientError", listener: (err: Error, tlsSocket: TLSSocket) => void): this;
        on(event: "newSession", listener: (sessionId: any, sessionData: any, callback: (err: Error, resp: Buffer) => void) => void): this;
        on(event: "OCSPRequest", listener: (certificate: Buffer, issuer: Buffer, callback: Function) => void): this;
        on(event: "resumeSession", listener: (sessionId: any, callback: (err: Error, sessionData: any) => void) => void): this;
        on(event: "secureConnection", listener: (tlsSocket: TLSSocket) => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "tlsClientError", listener: (err: Error, tlsSocket: TLSSocket) => void): this;
        once(event: "newSession", listener: (sessionId: any, sessionData: any, callback: (err: Error, resp: Buffer) => void) => void): this;
        once(event: "OCSPRequest", listener: (certificate: Buffer, issuer: Buffer, callback: Function) => void): this;
        once(event: "resumeSession", listener: (sessionId: any, callback: (err: Error, sessionData: any) => void) => void): this;
        once(event: "secureConnection", listener: (tlsSocket: TLSSocket) => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "tlsClientError", listener: (err: Error, tlsSocket: TLSSocket) => void): this;
        prependListener(event: "newSession", listener: (sessionId: any, sessionData: any, callback: (err: Error, resp: Buffer) => void) => void): this;
        prependListener(event: "OCSPRequest", listener: (certificate: Buffer, issuer: Buffer, callback: Function) => void): this;
        prependListener(event: "resumeSession", listener: (sessionId: any, callback: (err: Error, sessionData: any) => void) => void): this;
        prependListener(event: "secureConnection", listener: (tlsSocket: TLSSocket) => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "tlsClientError", listener: (err: Error, tlsSocket: TLSSocket) => void): this;
        prependOnceListener(event: "newSession", listener: (sessionId: any, sessionData: any, callback: (err: Error, resp: Buffer) => void) => void): this;
        prependOnceListener(event: "OCSPRequest", listener: (certificate: Buffer, issuer: Buffer, callback: Function) => void): this;
        prependOnceListener(event: "resumeSession", listener: (sessionId: any, callback: (err: Error, sessionData: any) => void) => void): this;
        prependOnceListener(event: "secureConnection", listener: (tlsSocket: TLSSocket) => void): this;
    }

    interface SecurePair {
        encrypted: any;
        cleartext: any;
    }

    interface SecureContextOptions {
        pfx?: string | Buffer | Array<string | Buffer | Object>;
        key?: string | Buffer | Array<Buffer | Object>;
        passphrase?: string;
        cert?: string | Buffer | Array<string | Buffer>;
        ca?: string | Buffer | Array<string | Buffer>;
        ciphers?: string;
        honorCipherOrder?: boolean;
        ecdhCurve?: string;
        clientCertEngine?: string;
        crl?: string | Buffer | Array<string | Buffer>;
        dhparam?: string | Buffer;
        secureOptions?: number; // Value is a numeric bitmask of the `SSL_OP_*` options
        secureProtocol?: string; // SSL Method, e.g. SSLv23_method
        sessionIdContext?: string;
    }

    interface SecureContext {
        context: any;
    }

    /*
     * Verifies the certificate `cert` is issued to host `host`.
     * @host The hostname to verify the certificate against
     * @cert PeerCertificate representing the peer's certificate
     *
     * Returns Error object, populating it with the reason, host and cert on failure.  On success, returns undefined.
     */
    function checkServerIdentity(host: string, cert: PeerCertificate): Error | undefined;
    function createServer(options: TlsOptions, secureConnectionListener?: (socket: TLSSocket) => void): Server;
    function connect(options: ConnectionOptions, secureConnectionListener?: () => void): TLSSocket;
    function connect(port: number, host?: string, options?: ConnectionOptions, secureConnectListener?: () => void): TLSSocket;
    function connect(port: number, options?: ConnectionOptions, secureConnectListener?: () => void): TLSSocket;
    function createSecurePair(credentials?: crypto.Credentials, isServer?: boolean, requestCert?: boolean, rejectUnauthorized?: boolean): SecurePair;
    function createSecureContext(details: SecureContextOptions): SecureContext;
    function getCiphers(): string[];

    const DEFAULT_ECDH_CURVE: string;
}

declare module "crypto" {
    import * as stream from "stream";

    interface Certificate {
        exportChallenge(spkac: string | Buffer | NodeJS.TypedArray | DataView): Buffer;
        exportPublicKey(spkac: string | Buffer | NodeJS.TypedArray | DataView): Buffer;
        verifySpkac(spkac: Buffer | NodeJS.TypedArray | DataView): boolean;
    }
    const Certificate: {
        new(): Certificate;
        (): Certificate;
    };

    /** @deprecated since v10.0.0 */
    const fips: boolean;

    interface CredentialDetails {
        pfx: string;
        key: string;
        passphrase: string;
        cert: string;
        ca: string | string[];
        crl: string | string[];
        ciphers: string;
    }
    interface Credentials { context?: any; }
    function createCredentials(details: CredentialDetails): Credentials;
    function createHash(algorithm: string, options?: stream.TransformOptions): Hash;
    function createHmac(algorithm: string, key: string | Buffer | NodeJS.TypedArray | DataView, options?: stream.TransformOptions): Hmac;

    type Utf8AsciiLatin1Encoding = "utf8" | "ascii" | "latin1";
    type HexBase64Latin1Encoding = "latin1" | "hex" | "base64";
    type Utf8AsciiBinaryEncoding = "utf8" | "ascii" | "binary";
    type HexBase64BinaryEncoding = "binary" | "base64" | "hex";
    type ECDHKeyFormat = "compressed" | "uncompressed" | "hybrid";

    interface Hash extends NodeJS.ReadWriteStream {
        update(data: string | Buffer | NodeJS.TypedArray | DataView): Hash;
        update(data: string, input_encoding: Utf8AsciiLatin1Encoding): Hash;
        digest(): Buffer;
        digest(encoding: HexBase64Latin1Encoding): string;
    }
    interface Hmac extends NodeJS.ReadWriteStream {
        update(data: string | Buffer | NodeJS.TypedArray | DataView): Hmac;
        update(data: string, input_encoding: Utf8AsciiLatin1Encoding): Hmac;
        digest(): Buffer;
        digest(encoding: HexBase64Latin1Encoding): string;
    }
    type CipherCCMTypes = 'aes-128-ccm' | 'aes-192-ccm' | 'aes-256-ccm';
    type CipherGCMTypes = 'aes-128-gcm' | 'aes-192-gcm' | 'aes-256-gcm';
    interface CipherCCMOptions extends stream.TransformOptions {
        authTagLength: number;
    }
    interface CipherGCMOptions extends stream.TransformOptions {
        authTagLength?: number;
    }
    /** @deprecated since v10.0.0 use createCipheriv() */
    function createCipher(algorithm: CipherCCMTypes, password: string | Buffer | NodeJS.TypedArray | DataView, options: CipherCCMOptions): CipherCCM;
    /** @deprecated since v10.0.0 use createCipheriv() */
    function createCipher(algorithm: CipherGCMTypes, password: string | Buffer | NodeJS.TypedArray | DataView, options?: CipherGCMOptions): CipherGCM;
    /** @deprecated since v10.0.0 use createCipheriv() */
    function createCipher(algorithm: string, password: string | Buffer | NodeJS.TypedArray | DataView, options?: stream.TransformOptions): Cipher;

    function createCipheriv(algorithm: CipherCCMTypes, key: string | Buffer | NodeJS.TypedArray | DataView, iv: string | Buffer | NodeJS.TypedArray | DataView, options: CipherCCMOptions): CipherCCM;
    function createCipheriv(algorithm: CipherGCMTypes, key: string | Buffer | NodeJS.TypedArray | DataView, iv: string | Buffer | NodeJS.TypedArray | DataView, options?: CipherGCMOptions): CipherGCM;
    function createCipheriv(algorithm: string, key: string | Buffer | NodeJS.TypedArray | DataView, iv: string | Buffer | NodeJS.TypedArray | DataView, options?: stream.TransformOptions): Cipher;

    interface Cipher extends NodeJS.ReadWriteStream {
        update(data: string | Buffer | NodeJS.TypedArray | DataView): Buffer;
        update(data: string, input_encoding: Utf8AsciiBinaryEncoding): Buffer;
        update(data: Buffer | NodeJS.TypedArray | DataView, output_encoding: HexBase64BinaryEncoding): string;
        update(data: Buffer | NodeJS.TypedArray | DataView, input_encoding: any, output_encoding: HexBase64BinaryEncoding): string;
        // second arg ignored
        update(data: string, input_encoding: Utf8AsciiBinaryEncoding, output_encoding: HexBase64BinaryEncoding): string;
        final(): Buffer;
        final(output_encoding: string): string;
        setAutoPadding(auto_padding?: boolean): this;
        // getAuthTag(): Buffer;
        // setAAD(buffer: Buffer): this; // docs only say buffer
    }
    interface CipherCCM extends Cipher {
        setAAD(buffer: Buffer, options: { plaintextLength: number }): this;
        getAuthTag(): Buffer;
    }
    interface CipherGCM extends Cipher {
        setAAD(buffer: Buffer, options?: { plaintextLength: number }): this;
        getAuthTag(): Buffer;
    }
    /** @deprecated since v10.0.0 use createCipheriv() */
    function createDecipher(algorithm: CipherCCMTypes, password: string | Buffer | NodeJS.TypedArray | DataView, options: CipherCCMOptions): DecipherCCM;
    /** @deprecated since v10.0.0 use createCipheriv() */
    function createDecipher(algorithm: CipherGCMTypes, password: string | Buffer | NodeJS.TypedArray | DataView, options?: CipherGCMOptions): DecipherGCM;
    /** @deprecated since v10.0.0 use createCipheriv() */
    function createDecipher(algorithm: string, password: string | Buffer | NodeJS.TypedArray | DataView, options?: stream.TransformOptions): Decipher;

    function createDecipheriv(
        algorithm: CipherCCMTypes,
        key: string | Buffer | NodeJS.TypedArray | DataView,
        iv: string | Buffer | NodeJS.TypedArray | DataView,
        options: CipherCCMOptions,
    ): DecipherCCM;
    function createDecipheriv(
        algorithm: CipherGCMTypes,
        key: string | Buffer | NodeJS.TypedArray | DataView,
        iv: string | Buffer | NodeJS.TypedArray | DataView,
        options?: CipherGCMOptions,
    ): DecipherGCM;
    function createDecipheriv(algorithm: string, key: string | Buffer | NodeJS.TypedArray | DataView, iv: string | Buffer | NodeJS.TypedArray | DataView, options?: stream.TransformOptions): Decipher;

    interface Decipher extends NodeJS.ReadWriteStream {
        update(data: Buffer | NodeJS.TypedArray | DataView): Buffer;
        update(data: string, input_encoding: HexBase64BinaryEncoding): Buffer;
        update(data: Buffer | NodeJS.TypedArray | DataView, input_encoding: any, output_encoding: Utf8AsciiBinaryEncoding): string;
        // second arg is ignored
        update(data: string, input_encoding: HexBase64BinaryEncoding, output_encoding: Utf8AsciiBinaryEncoding): string;
        final(): Buffer;
        final(output_encoding: string): string;
        setAutoPadding(auto_padding?: boolean): this;
        // setAuthTag(tag: Buffer | NodeJS.TypedArray | DataView): this;
        // setAAD(buffer: Buffer | NodeJS.TypedArray | DataView): this;
    }
    interface DecipherCCM extends Decipher {
        setAuthTag(buffer: Buffer | NodeJS.TypedArray | DataView): this;
        setAAD(buffer: Buffer | NodeJS.TypedArray | DataView, options: { plaintextLength: number }): this;
    }
    interface DecipherGCM extends Decipher {
        setAuthTag(buffer: Buffer | NodeJS.TypedArray | DataView): this;
        setAAD(buffer: Buffer | NodeJS.TypedArray | DataView, options?: { plaintextLength: number }): this;
    }

    function createSign(algorithm: string, options?: stream.WritableOptions): Signer;
    interface Signer extends NodeJS.WritableStream {
        update(data: string | Buffer | NodeJS.TypedArray | DataView): Signer;
        update(data: string, input_encoding: Utf8AsciiLatin1Encoding): Signer;
        sign(private_key: string | { key: string; passphrase?: string, padding?: number, saltLength?: number }): Buffer;
        sign(private_key: string | { key: string; passphrase?: string, padding?: number, saltLength?: number }, output_format: HexBase64Latin1Encoding): string;
    }
    function createVerify(algorith: string, options?: stream.WritableOptions): Verify;
    interface Verify extends NodeJS.WritableStream {
        update(data: string | Buffer | NodeJS.TypedArray | DataView): Verify;
        update(data: string, input_encoding: Utf8AsciiLatin1Encoding): Verify;
        verify(object: string | Object, signature: Buffer | NodeJS.TypedArray | DataView): boolean;
        verify(object: string | Object, signature: string, signature_format: HexBase64Latin1Encoding): boolean;
        // https://nodejs.org/api/crypto.html#crypto_verifier_verify_object_signature_signature_format
        // The signature field accepts a TypedArray type, but it is only available starting ES2017
    }
    function createDiffieHellman(prime_length: number, generator?: number | Buffer | NodeJS.TypedArray | DataView): DiffieHellman;
    function createDiffieHellman(prime: Buffer | NodeJS.TypedArray | DataView): DiffieHellman;
    function createDiffieHellman(prime: string, prime_encoding: HexBase64Latin1Encoding): DiffieHellman;
    function createDiffieHellman(prime: string, prime_encoding: HexBase64Latin1Encoding, generator: number | Buffer | NodeJS.TypedArray | DataView): DiffieHellman;
    function createDiffieHellman(prime: string, prime_encoding: HexBase64Latin1Encoding, generator: string, generator_encoding: HexBase64Latin1Encoding): DiffieHellman;
    interface DiffieHellman {
        generateKeys(): Buffer;
        generateKeys(encoding: HexBase64Latin1Encoding): string;
        computeSecret(other_public_key: Buffer | NodeJS.TypedArray | DataView): Buffer;
        computeSecret(other_public_key: string, input_encoding: HexBase64Latin1Encoding): Buffer;
        computeSecret(other_public_key: Buffer | NodeJS.TypedArray | DataView, output_encoding: HexBase64Latin1Encoding): string;
        computeSecret(other_public_key: string, input_encoding: HexBase64Latin1Encoding, output_encoding: HexBase64Latin1Encoding): string;
        getPrime(): Buffer;
        getPrime(encoding: HexBase64Latin1Encoding): string;
        getGenerator(): Buffer;
        getGenerator(encoding: HexBase64Latin1Encoding): string;
        getPublicKey(): Buffer;
        getPublicKey(encoding: HexBase64Latin1Encoding): string;
        getPrivateKey(): Buffer;
        getPrivateKey(encoding: HexBase64Latin1Encoding): string;
        setPublicKey(public_key: Buffer | NodeJS.TypedArray | DataView): void;
        setPublicKey(public_key: string, encoding: string): void;
        setPrivateKey(private_key: Buffer | NodeJS.TypedArray | DataView): void;
        setPrivateKey(private_key: string, encoding: string): void;
        verifyError: number;
    }
    function getDiffieHellman(group_name: string): DiffieHellman;
    function pbkdf2(
        password: string | Buffer | NodeJS.TypedArray | DataView,
        salt: string | Buffer | NodeJS.TypedArray | DataView,
        iterations: number,
        keylen: number,
        digest: string,
        callback: (err: Error | null, derivedKey: Buffer) => any,
    ): void;
    function pbkdf2Sync(password: string | Buffer | NodeJS.TypedArray | DataView, salt: string | Buffer | NodeJS.TypedArray | DataView, iterations: number, keylen: number, digest: string): Buffer;

    function randomBytes(size: number): Buffer;
    function randomBytes(size: number, callback: (err: Error | null, buf: Buffer) => void): void;
    function pseudoRandomBytes(size: number): Buffer;
    function pseudoRandomBytes(size: number, callback: (err: Error | null, buf: Buffer) => void): void;

    function randomFillSync<T extends Buffer | NodeJS.TypedArray | DataView>(buffer: T, offset?: number, size?: number): T;
    function randomFill<T extends Buffer | NodeJS.TypedArray | DataView>(buffer: T, callback: (err: Error | null, buf: T) => void): void;
    function randomFill<T extends Buffer | NodeJS.TypedArray | DataView>(buffer: T, offset: number, callback: (err: Error | null, buf: T) => void): void;
    function randomFill<T extends Buffer | NodeJS.TypedArray | DataView>(buffer: T, offset: number, size: number, callback: (err: Error | null, buf: T) => void): void;

    interface ScryptOptions {
        N?: number;
        r?: number;
        p?: number;
        maxmem?: number;
    }
    function scrypt(
        password: string | Buffer | NodeJS.TypedArray | DataView,
        salt: string | Buffer | NodeJS.TypedArray | DataView,
        keylen: number, callback: (err: Error | null, derivedKey: Buffer) => void,
    ): void;
    function scrypt(
        password: string | Buffer | NodeJS.TypedArray | DataView,
        salt: string | Buffer | NodeJS.TypedArray | DataView,
        keylen: number,
        options: ScryptOptions,
        callback: (err: Error | null, derivedKey: Buffer) => void,
    ): void;
    function scryptSync(password: string | Buffer | NodeJS.TypedArray | DataView, salt: string | Buffer | NodeJS.TypedArray | DataView, keylen: number, options?: ScryptOptions): Buffer;

    interface RsaPublicKey {
        key: string;
        padding?: number;
    }
    interface RsaPrivateKey {
        key: string;
        passphrase?: string;
        padding?: number;
    }
    function publicEncrypt(public_key: string | RsaPublicKey, buffer: Buffer | NodeJS.TypedArray | DataView): Buffer;
    function privateDecrypt(private_key: string | RsaPrivateKey, buffer: Buffer | NodeJS.TypedArray | DataView): Buffer;
    function privateEncrypt(private_key: string | RsaPrivateKey, buffer: Buffer | NodeJS.TypedArray | DataView): Buffer;
    function publicDecrypt(public_key: string | RsaPublicKey, buffer: Buffer | NodeJS.TypedArray | DataView): Buffer;
    function getCiphers(): string[];
    function getCurves(): string[];
    function getHashes(): string[];
    class ECDH {
        static convertKey(
            key: string | Buffer | NodeJS.TypedArray | DataView,
            curve: string,
            inputEncoding?: HexBase64Latin1Encoding,
            outputEncoding?: "latin1" | "hex" | "base64",
            format?: "uncompressed" | "compressed" | "hybrid",
        ): Buffer | string;
        generateKeys(): Buffer;
        generateKeys(encoding: HexBase64Latin1Encoding, format?: ECDHKeyFormat): string;
        computeSecret(other_public_key: Buffer | NodeJS.TypedArray | DataView): Buffer;
        computeSecret(other_public_key: string, input_encoding: HexBase64Latin1Encoding): Buffer;
        computeSecret(other_public_key: Buffer | NodeJS.TypedArray | DataView, output_encoding: HexBase64Latin1Encoding): string;
        computeSecret(other_public_key: string, input_encoding: HexBase64Latin1Encoding, output_encoding: HexBase64Latin1Encoding): string;
        getPrivateKey(): Buffer;
        getPrivateKey(encoding: HexBase64Latin1Encoding): string;
        getPublicKey(): Buffer;
        getPublicKey(encoding: HexBase64Latin1Encoding, format?: ECDHKeyFormat): string;
        setPrivateKey(private_key: Buffer | NodeJS.TypedArray | DataView): void;
        setPrivateKey(private_key: string, encoding: HexBase64Latin1Encoding): void;
    }
    function createECDH(curve_name: string): ECDH;
    function timingSafeEqual(a: Buffer | NodeJS.TypedArray | DataView, b: Buffer | NodeJS.TypedArray | DataView): boolean;
    /** @deprecated since v10.0.0 */
    const DEFAULT_ENCODING: string;

    export type KeyType = 'rsa' | 'dsa' | 'ec';
    export type KeyFormat = 'pem' | 'der';

    interface BasePrivateKeyEncodingOptions<T extends KeyFormat> {
        format: T;
        cipher: string;
        passphrase: string;
    }

    interface RSAKeyPairOptions<PubF extends KeyFormat, PrivF extends KeyFormat> {
        /**
         * Key size in bits
         */
        modulusLength: number;
        /**
         * @default 0x10001
         */
        publicExponent?: number;

        publicKeyEncoding: {
            type: 'pkcs1' | 'spki';
            format: PubF;
        };
        privateKeyEncoding: BasePrivateKeyEncodingOptions<PrivF> & {
            type: 'pkcs1' | 'pkcs8';
        };
    }

    interface DSAKeyPairOptions<PubF extends KeyFormat, PrivF extends KeyFormat> {
        /**
         * Key size in bits
         */
        modulusLength: number;
        /**
         * Size of q in bits
         */
        divisorLength: number;

        publicKeyEncoding: {
            type: 'spki';
            format: PubF;
        };
        privateKeyEncoding: BasePrivateKeyEncodingOptions<PrivF> & {
            type: 'pkcs8';
        };
    }

    interface ECKeyPairOptions<PubF extends KeyFormat, PrivF extends KeyFormat> {
        /**
         * Name of the curve to use.
         */
        namedCurve: string;

        publicKeyEncoding: {
            type: 'pkcs1' | 'spki';
            format: PubF;
        };
        privateKeyEncoding: BasePrivateKeyEncodingOptions<PrivF> & {
            type: 'sec1' | 'pkcs8';
        };
    }

    interface KeyPairSyncResult<T1 extends string | Buffer, T2 extends string | Buffer> {
        publicKey: T1;
        privateKey: T2;
    }

    function generateKeyPairSync(type: 'rsa', options: RSAKeyPairOptions<'pem', 'pem'>): KeyPairSyncResult<string, string>;
    function generateKeyPairSync(type: 'rsa', options: RSAKeyPairOptions<'pem', 'der'>): KeyPairSyncResult<string, Buffer>;
    function generateKeyPairSync(type: 'rsa', options: RSAKeyPairOptions<'der', 'pem'>): KeyPairSyncResult<Buffer, string>;
    function generateKeyPairSync(type: 'rsa', options: RSAKeyPairOptions<'der', 'der'>): KeyPairSyncResult<Buffer, Buffer>;

    function generateKeyPairSync(type: 'dsa', options: DSAKeyPairOptions<'pem', 'pem'>): KeyPairSyncResult<string, string>;
    function generateKeyPairSync(type: 'dsa', options: DSAKeyPairOptions<'pem', 'der'>): KeyPairSyncResult<string, Buffer>;
    function generateKeyPairSync(type: 'dsa', options: DSAKeyPairOptions<'der', 'pem'>): KeyPairSyncResult<Buffer, string>;
    function generateKeyPairSync(type: 'dsa', options: DSAKeyPairOptions<'der', 'der'>): KeyPairSyncResult<Buffer, Buffer>;

    function generateKeyPairSync(type: 'ec', options: ECKeyPairOptions<'pem', 'pem'>): KeyPairSyncResult<string, string>;
    function generateKeyPairSync(type: 'ec', options: ECKeyPairOptions<'pem', 'der'>): KeyPairSyncResult<string, Buffer>;
    function generateKeyPairSync(type: 'ec', options: ECKeyPairOptions<'der', 'pem'>): KeyPairSyncResult<Buffer, string>;
    function generateKeyPairSync(type: 'ec', options: ECKeyPairOptions<'der', 'der'>): KeyPairSyncResult<Buffer, Buffer>;

    function generateKeyPair(type: 'rsa', options: RSAKeyPairOptions<'pem', 'pem'>, callback: (err: Error | null, publicKey: string, privateKey: string) => void): void;
    function generateKeyPair(type: 'rsa', options: RSAKeyPairOptions<'pem', 'der'>, callback: (err: Error | null, publicKey: string, privateKey: Buffer) => void): void;
    function generateKeyPair(type: 'rsa', options: RSAKeyPairOptions<'der', 'pem'>, callback: (err: Error | null, publicKey: Buffer, privateKey: string) => void): void;
    function generateKeyPair(type: 'rsa', options: RSAKeyPairOptions<'der', 'der'>, callback: (err: Error | null, publicKey: Buffer, privateKey: Buffer) => void): void;

    function generateKeyPair(type: 'dsa', options: DSAKeyPairOptions<'pem', 'pem'>, callback: (err: Error | null, publicKey: string, privateKey: string) => void): void;
    function generateKeyPair(type: 'dsa', options: DSAKeyPairOptions<'pem', 'der'>, callback: (err: Error | null, publicKey: string, privateKey: Buffer) => void): void;
    function generateKeyPair(type: 'dsa', options: DSAKeyPairOptions<'der', 'pem'>, callback: (err: Error | null, publicKey: Buffer, privateKey: string) => void): void;
    function generateKeyPair(type: 'dsa', options: DSAKeyPairOptions<'der', 'der'>, callback: (err: Error | null, publicKey: Buffer, privateKey: Buffer) => void): void;

    function generateKeyPair(type: 'ec', options: ECKeyPairOptions<'pem', 'pem'>, callback: (err: Error | null, publicKey: string, privateKey: string) => void): void;
    function generateKeyPair(type: 'ec', options: ECKeyPairOptions<'pem', 'der'>, callback: (err: Error | null, publicKey: string, privateKey: Buffer) => void): void;
    function generateKeyPair(type: 'ec', options: ECKeyPairOptions<'der', 'pem'>, callback: (err: Error | null, publicKey: Buffer, privateKey: string) => void): void;
    function generateKeyPair(type: 'ec', options: ECKeyPairOptions<'der', 'der'>, callback: (err: Error | null, publicKey: Buffer, privateKey: Buffer) => void): void;

    namespace generateKeyPair {
        function __promisify__(type: "rsa", options: RSAKeyPairOptions<'pem', 'pem'>): Promise<{ publicKey: string, privateKey: string }>;
        function __promisify__(type: "rsa", options: RSAKeyPairOptions<'pem', 'der'>): Promise<{ publicKey: string, privateKey: Buffer }>;
        function __promisify__(type: "rsa", options: RSAKeyPairOptions<'der', 'pem'>): Promise<{ publicKey: Buffer, privateKey: string }>;
        function __promisify__(type: "rsa", options: RSAKeyPairOptions<'der', 'der'>): Promise<{ publicKey: Buffer, privateKey: Buffer }>;

        function __promisify__(type: "dsa", options: DSAKeyPairOptions<'pem', 'pem'>): Promise<{ publicKey: string, privateKey: string }>;
        function __promisify__(type: "dsa", options: DSAKeyPairOptions<'pem', 'der'>): Promise<{ publicKey: string, privateKey: Buffer }>;
        function __promisify__(type: "dsa", options: DSAKeyPairOptions<'der', 'pem'>): Promise<{ publicKey: Buffer, privateKey: string }>;
        function __promisify__(type: "dsa", options: DSAKeyPairOptions<'der', 'der'>): Promise<{ publicKey: Buffer, privateKey: Buffer }>;

        function __promisify__(type: "ec", options: ECKeyPairOptions<'pem', 'pem'>): Promise<{ publicKey: string, privateKey: string }>;
        function __promisify__(type: "ec", options: ECKeyPairOptions<'pem', 'der'>): Promise<{ publicKey: string, privateKey: Buffer }>;
        function __promisify__(type: "ec", options: ECKeyPairOptions<'der', 'pem'>): Promise<{ publicKey: Buffer, privateKey: string }>;
        function __promisify__(type: "ec", options: ECKeyPairOptions<'der', 'der'>): Promise<{ publicKey: Buffer, privateKey: Buffer }>;
    }
}

declare module "stream" {
    import * as events from "events";

    class internal extends events.EventEmitter {
        pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; }): T;
    }

    namespace internal {
        class Stream extends internal { }

        interface ReadableOptions {
            highWaterMark?: number;
            encoding?: string;
            objectMode?: boolean;
            read?(this: Readable, size: number): void;
            destroy?(this: Readable, error: Error | null, callback: (error: Error | null) => void): void;
        }

        class Readable extends Stream implements NodeJS.ReadableStream {
            readable: boolean;
            readonly readableHighWaterMark: number;
            readonly readableLength: number;
            constructor(opts?: ReadableOptions);
            _read(size: number): void;
            read(size?: number): any;
            setEncoding(encoding: string): this;
            pause(): this;
            resume(): this;
            isPaused(): boolean;
            unpipe(destination?: NodeJS.WritableStream): this;
            unshift(chunk: any): void;
            wrap(oldStream: NodeJS.ReadableStream): this;
            push(chunk: any, encoding?: string): boolean;
            _destroy(error: Error | null, callback: (error: Error | null) => void): void;
            destroy(error?: Error): void;

            /**
             * Event emitter
             * The defined events on documents including:
             * 1. close
             * 2. data
             * 3. end
             * 4. readable
             * 5. error
             */
            addListener(event: "close", listener: () => void): this;
            addListener(event: "data", listener: (chunk: any) => void): this;
            addListener(event: "end", listener: () => void): this;
            addListener(event: "readable", listener: () => void): this;
            addListener(event: "error", listener: (err: Error) => void): this;
            addListener(event: string | symbol, listener: (...args: any[]) => void): this;

            emit(event: "close"): boolean;
            emit(event: "data", chunk: any): boolean;
            emit(event: "end"): boolean;
            emit(event: "readable"): boolean;
            emit(event: "error", err: Error): boolean;
            emit(event: string | symbol, ...args: any[]): boolean;

            on(event: "close", listener: () => void): this;
            on(event: "data", listener: (chunk: any) => void): this;
            on(event: "end", listener: () => void): this;
            on(event: "readable", listener: () => void): this;
            on(event: "error", listener: (err: Error) => void): this;
            on(event: string | symbol, listener: (...args: any[]) => void): this;

            once(event: "close", listener: () => void): this;
            once(event: "data", listener: (chunk: any) => void): this;
            once(event: "end", listener: () => void): this;
            once(event: "readable", listener: () => void): this;
            once(event: "error", listener: (err: Error) => void): this;
            once(event: string | symbol, listener: (...args: any[]) => void): this;

            prependListener(event: "close", listener: () => void): this;
            prependListener(event: "data", listener: (chunk: any) => void): this;
            prependListener(event: "end", listener: () => void): this;
            prependListener(event: "readable", listener: () => void): this;
            prependListener(event: "error", listener: (err: Error) => void): this;
            prependListener(event: string | symbol, listener: (...args: any[]) => void): this;

            prependOnceListener(event: "close", listener: () => void): this;
            prependOnceListener(event: "data", listener: (chunk: any) => void): this;
            prependOnceListener(event: "end", listener: () => void): this;
            prependOnceListener(event: "readable", listener: () => void): this;
            prependOnceListener(event: "error", listener: (err: Error) => void): this;
            prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;

            removeListener(event: "close", listener: () => void): this;
            removeListener(event: "data", listener: (chunk: any) => void): this;
            removeListener(event: "end", listener: () => void): this;
            removeListener(event: "readable", listener: () => void): this;
            removeListener(event: "error", listener: (err: Error) => void): this;
            removeListener(event: string | symbol, listener: (...args: any[]) => void): this;

            [Symbol.asyncIterator](): AsyncIterableIterator<any>;
        }

        interface WritableOptions {
            highWaterMark?: number;
            decodeStrings?: boolean;
            objectMode?: boolean;
            write?(this: Writable, chunk: any, encoding: string, callback: (error?: Error | null) => void): void;
            writev?(this: Writable, chunks: Array<{ chunk: any, encoding: string }>, callback: (error?: Error | null) => void): void;
            destroy?(this: Writable, error: Error | null, callback: (error: Error | null) => void): void;
            final?(this: Writable, callback: (error?: Error | null) => void): void;
        }

        class Writable extends Stream implements NodeJS.WritableStream {
            writable: boolean;
            readonly writableHighWaterMark: number;
            readonly writableLength: number;
            constructor(opts?: WritableOptions);
            _write(chunk: any, encoding: string, callback: (error?: Error | null) => void): void;
            _writev?(chunks: Array<{ chunk: any, encoding: string }>, callback: (error?: Error | null) => void): void;
            _destroy(error: Error | null, callback: (error: Error | null) => void): void;
            _final(callback: (error?: Error | null) => void): void;
            write(chunk: any, cb?: (error: Error | null | undefined) => void): boolean;
            write(chunk: any, encoding?: string, cb?: (error: Error | null | undefined) => void): boolean;
            setDefaultEncoding(encoding: string): this;
            end(cb?: () => void): void;
            end(chunk: any, cb?: () => void): void;
            end(chunk: any, encoding?: string, cb?: () => void): void;
            cork(): void;
            uncork(): void;
            destroy(error?: Error): void;

            /**
             * Event emitter
             * The defined events on documents including:
             * 1. close
             * 2. drain
             * 3. error
             * 4. finish
             * 5. pipe
             * 6. unpipe
             */
            addListener(event: "close", listener: () => void): this;
            addListener(event: "drain", listener: () => void): this;
            addListener(event: "error", listener: (err: Error) => void): this;
            addListener(event: "finish", listener: () => void): this;
            addListener(event: "pipe", listener: (src: Readable) => void): this;
            addListener(event: "unpipe", listener: (src: Readable) => void): this;
            addListener(event: string | symbol, listener: (...args: any[]) => void): this;

            emit(event: "close"): boolean;
            emit(event: "drain"): boolean;
            emit(event: "error", err: Error): boolean;
            emit(event: "finish"): boolean;
            emit(event: "pipe", src: Readable): boolean;
            emit(event: "unpipe", src: Readable): boolean;
            emit(event: string | symbol, ...args: any[]): boolean;

            on(event: "close", listener: () => void): this;
            on(event: "drain", listener: () => void): this;
            on(event: "error", listener: (err: Error) => void): this;
            on(event: "finish", listener: () => void): this;
            on(event: "pipe", listener: (src: Readable) => void): this;
            on(event: "unpipe", listener: (src: Readable) => void): this;
            on(event: string | symbol, listener: (...args: any[]) => void): this;

            once(event: "close", listener: () => void): this;
            once(event: "drain", listener: () => void): this;
            once(event: "error", listener: (err: Error) => void): this;
            once(event: "finish", listener: () => void): this;
            once(event: "pipe", listener: (src: Readable) => void): this;
            once(event: "unpipe", listener: (src: Readable) => void): this;
            once(event: string | symbol, listener: (...args: any[]) => void): this;

            prependListener(event: "close", listener: () => void): this;
            prependListener(event: "drain", listener: () => void): this;
            prependListener(event: "error", listener: (err: Error) => void): this;
            prependListener(event: "finish", listener: () => void): this;
            prependListener(event: "pipe", listener: (src: Readable) => void): this;
            prependListener(event: "unpipe", listener: (src: Readable) => void): this;
            prependListener(event: string | symbol, listener: (...args: any[]) => void): this;

            prependOnceListener(event: "close", listener: () => void): this;
            prependOnceListener(event: "drain", listener: () => void): this;
            prependOnceListener(event: "error", listener: (err: Error) => void): this;
            prependOnceListener(event: "finish", listener: () => void): this;
            prependOnceListener(event: "pipe", listener: (src: Readable) => void): this;
            prependOnceListener(event: "unpipe", listener: (src: Readable) => void): this;
            prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;

            removeListener(event: "close", listener: () => void): this;
            removeListener(event: "drain", listener: () => void): this;
            removeListener(event: "error", listener: (err: Error) => void): this;
            removeListener(event: "finish", listener: () => void): this;
            removeListener(event: "pipe", listener: (src: Readable) => void): this;
            removeListener(event: "unpipe", listener: (src: Readable) => void): this;
            removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
        }

        interface DuplexOptions extends ReadableOptions, WritableOptions {
            allowHalfOpen?: boolean;
            readableObjectMode?: boolean;
            writableObjectMode?: boolean;
            read?(this: Duplex, size: number): void;
            write?(this: Duplex, chunk: any, encoding: string, callback: (error?: Error | null) => void): void;
            writev?(this: Duplex, chunks: Array<{ chunk: any, encoding: string }>, callback: (error?: Error | null) => void): void;
            final?(this: Duplex, callback: (error?: Error | null) => void): void;
            destroy?(this: Duplex, error: Error | null, callback: (error: Error | null) => void): void;
        }

        // Note: Duplex extends both Readable and Writable.
        class Duplex extends Readable implements Writable {
            writable: boolean;
            readonly writableHighWaterMark: number;
            readonly writableLength: number;
            constructor(opts?: DuplexOptions);
            _write(chunk: any, encoding: string, callback: (error?: Error | null) => void): void;
            _writev?(chunks: Array<{ chunk: any, encoding: string }>, callback: (error?: Error | null) => void): void;
            _destroy(error: Error | null, callback: (error: Error | null) => void): void;
            _final(callback: (error?: Error | null) => void): void;
            write(chunk: any, cb?: (error: Error | null | undefined) => void): boolean;
            write(chunk: any, encoding?: string, cb?: (error: Error | null | undefined) => void): boolean;
            setDefaultEncoding(encoding: string): this;
            end(cb?: () => void): void;
            end(chunk: any, cb?: () => void): void;
            end(chunk: any, encoding?: string, cb?: () => void): void;
            cork(): void;
            uncork(): void;
        }

        type TransformCallback = (error?: Error, data?: any) => void;

        interface TransformOptions extends DuplexOptions {
            read?(this: Transform, size: number): void;
            write?(this: Transform, chunk: any, encoding: string, callback: (error?: Error | null) => void): void;
            writev?(this: Transform, chunks: Array<{ chunk: any, encoding: string }>, callback: (error?: Error | null) => void): void;
            final?(this: Transform, callback: (error?: Error | null) => void): void;
            destroy?(this: Transform, error: Error | null, callback: (error: Error | null) => void): void;
            transform?(this: Transform, chunk: any, encoding: string, callback: TransformCallback): void;
            flush?(this: Transform, callback: TransformCallback): void;
        }

        class Transform extends Duplex {
            constructor(opts?: TransformOptions);
            _transform(chunk: any, encoding: string, callback: TransformCallback): void;
            _flush(callback: TransformCallback): void;
        }

        class PassThrough extends Transform { }

        function finished(stream: NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream, callback: (err?: NodeJS.ErrnoException) => void): () => void;
        namespace finished {
            function __promisify__(stream: NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream): Promise<void>;
        }

        function pipeline<T extends NodeJS.WritableStream>(stream1: NodeJS.ReadableStream, stream2: T, callback?: (err: NodeJS.ErrnoException) => void): T;
        function pipeline<T extends NodeJS.WritableStream>(stream1: NodeJS.ReadableStream, stream2: NodeJS.ReadWriteStream, stream3: T, callback?: (err: NodeJS.ErrnoException) => void): T;
        function pipeline<T extends NodeJS.WritableStream>(
            stream1: NodeJS.ReadableStream,
            stream2: NodeJS.ReadWriteStream,
            stream3: NodeJS.ReadWriteStream,
            stream4: T,
            callback?: (err: NodeJS.ErrnoException) => void,
        ): T;
        function pipeline<T extends NodeJS.WritableStream>(
            stream1: NodeJS.ReadableStream,
            stream2: NodeJS.ReadWriteStream,
            stream3: NodeJS.ReadWriteStream,
            stream4: NodeJS.ReadWriteStream,
            stream5: T,
            callback?: (err: NodeJS.ErrnoException) => void,
        ): T;
        function pipeline(streams: Array<NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream>, callback?: (err: NodeJS.ErrnoException) => void): NodeJS.WritableStream;
        function pipeline(
            stream1: NodeJS.ReadableStream,
            stream2: NodeJS.ReadWriteStream | NodeJS.WritableStream,
            ...streams: Array<NodeJS.ReadWriteStream | NodeJS.WritableStream | ((err: NodeJS.ErrnoException) => void)>,
        ): NodeJS.WritableStream;
        namespace pipeline {
            function __promisify__(stream1: NodeJS.ReadableStream, stream2: NodeJS.WritableStream): Promise<void>;
            function __promisify__(stream1: NodeJS.ReadableStream, stream2: NodeJS.ReadWriteStream, stream3: NodeJS.WritableStream): Promise<void>;
            function __promisify__(stream1: NodeJS.ReadableStream, stream2: NodeJS.ReadWriteStream, stream3: NodeJS.ReadWriteStream, stream4: NodeJS.WritableStream): Promise<void>;
            function __promisify__(
                stream1: NodeJS.ReadableStream,
                stream2: NodeJS.ReadWriteStream,
                stream3: NodeJS.ReadWriteStream,
                stream4: NodeJS.ReadWriteStream,
                stream5: NodeJS.WritableStream,
            ): Promise<void>;
            function __promisify__(streams: Array<NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream>): Promise<void>;
            function __promisify__(
                stream1: NodeJS.ReadableStream,
                stream2: NodeJS.ReadWriteStream | NodeJS.WritableStream,
                ...streams: Array<NodeJS.ReadWriteStream | NodeJS.WritableStream>,
            ): Promise<void>;
        }
    }

    export = internal;
}

declare module "util" {
    interface InspectOptions extends NodeJS.InspectOptions { }
    function format(format: any, ...param: any[]): string;
    function formatWithOptions(inspectOptions: InspectOptions, format: string, ...param: any[]): string;
    /** @deprecated since v0.11.3 - use `console.error()` instead. */
    function debug(string: string): void;
    /** @deprecated since v0.11.3 - use `console.error()` instead. */
    function error(...param: any[]): void;
    /** @deprecated since v0.11.3 - use `console.log()` instead. */
    function puts(...param: any[]): void;
    /** @deprecated since v0.11.3 - use `console.log()` instead. */
    function print(...param: any[]): void;
    /** @deprecated since v0.11.3 - use a third party module instead. */
    function log(string: string): void;
    const inspect: {
        (object: any, showHidden?: boolean, depth?: number | null, color?: boolean): string;
        (object: any, options: InspectOptions): string;
        colors: {
            [color: string]: [number, number] | undefined
        }
        styles: {
            [style: string]: string | undefined
        }
        defaultOptions: InspectOptions;
        custom: symbol;
    };
    /** @deprecated since v4.0.0 - use `Array.isArray()` instead. */
    function isArray(object: any): object is any[];
    /** @deprecated since v4.0.0 - use `util.types.isRegExp()` instead. */
    function isRegExp(object: any): object is RegExp;
    /** @deprecated since v4.0.0 - use `util.types.isDate()` instead. */
    function isDate(object: any): object is Date;
    /** @deprecated since v4.0.0 - use `util.types.isNativeError()` instead. */
    function isError(object: any): object is Error;
    function inherits(constructor: any, superConstructor: any): void;
    function debuglog(key: string): (msg: string, ...param: any[]) => void;
    /** @deprecated since v4.0.0 - use `typeof value === 'boolean'` instead. */
    function isBoolean(object: any): object is boolean;
    /** @deprecated since v4.0.0 - use `Buffer.isBuffer()` instead. */
    function isBuffer(object: any): object is Buffer;
    /** @deprecated since v4.0.0 - use `typeof value === 'function'` instead. */
    function isFunction(object: any): boolean;
    /** @deprecated since v4.0.0 - use `value === null` instead. */
    function isNull(object: any): object is null;
    /** @deprecated since v4.0.0 - use `value === null || value === undefined` instead. */
    function isNullOrUndefined(object: any): object is null | undefined;
    /** @deprecated since v4.0.0 - use `typeof value === 'number'` instead. */
    function isNumber(object: any): object is number;
    /** @deprecated since v4.0.0 - use `value !== null && typeof value === 'object'` instead. */
    function isObject(object: any): boolean;
    /** @deprecated since v4.0.0 - use `(typeof value !== 'object' && typeof value !== 'function') || value === null` instead. */
    function isPrimitive(object: any): boolean;
    /** @deprecated since v4.0.0 - use `typeof value === 'string'` instead. */
    function isString(object: any): object is string;
    /** @deprecated since v4.0.0 - use `typeof value === 'symbol'` instead. */
    function isSymbol(object: any): object is symbol;
    /** @deprecated since v4.0.0 - use `value === undefined` instead. */
    function isUndefined(object: any): object is undefined;
    function deprecate<T extends Function>(fn: T, message: string): T;
    function isDeepStrictEqual(val1: any, val2: any): boolean;

    interface CustomPromisify<TCustom extends Function> extends Function {
        __promisify__: TCustom;
    }

    function callbackify(fn: () => Promise<void>): (callback: (err: NodeJS.ErrnoException) => void) => void;
    function callbackify<TResult>(fn: () => Promise<TResult>): (callback: (err: NodeJS.ErrnoException, result: TResult) => void) => void;
    function callbackify<T1>(fn: (arg1: T1) => Promise<void>): (arg1: T1, callback: (err: NodeJS.ErrnoException) => void) => void;
    function callbackify<T1, TResult>(fn: (arg1: T1) => Promise<TResult>): (arg1: T1, callback: (err: NodeJS.ErrnoException, result: TResult) => void) => void;
    function callbackify<T1, T2>(fn: (arg1: T1, arg2: T2) => Promise<void>): (arg1: T1, arg2: T2, callback: (err: NodeJS.ErrnoException) => void) => void;
    function callbackify<T1, T2, TResult>(fn: (arg1: T1, arg2: T2) => Promise<TResult>): (arg1: T1, arg2: T2, callback: (err: NodeJS.ErrnoException, result: TResult) => void) => void;
    function callbackify<T1, T2, T3>(fn: (arg1: T1, arg2: T2, arg3: T3) => Promise<void>): (arg1: T1, arg2: T2, arg3: T3, callback: (err: NodeJS.ErrnoException) => void) => void;
    function callbackify<T1, T2, T3, TResult>(
        fn: (arg1: T1, arg2: T2, arg3: T3) => Promise<TResult>): (arg1: T1, arg2: T2, arg3: T3, callback: (err: NodeJS.ErrnoException, result: TResult) => void) => void;
    function callbackify<T1, T2, T3, T4>(
        fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<void>): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, callback: (err: NodeJS.ErrnoException) => void) => void;
    function callbackify<T1, T2, T3, T4, TResult>(
        fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<TResult>): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, callback: (err: NodeJS.ErrnoException, result: TResult) => void) => void;
    function callbackify<T1, T2, T3, T4, T5>(
        fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<void>): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5, callback: (err: NodeJS.ErrnoException) => void) => void;
    function callbackify<T1, T2, T3, T4, T5, TResult>(
        fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<TResult>,
    ): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5, callback: (err: NodeJS.ErrnoException, result: TResult) => void) => void;
    function callbackify<T1, T2, T3, T4, T5, T6>(
        fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5, arg6: T6) => Promise<void>,
    ): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5, arg6: T6, callback: (err: NodeJS.ErrnoException) => void) => void;
    function callbackify<T1, T2, T3, T4, T5, T6, TResult>(
        fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5, arg6: T6) => Promise<TResult>
    ): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5, arg6: T6, callback: (err: NodeJS.ErrnoException, result: TResult) => void) => void;

    function promisify<TCustom extends Function>(fn: CustomPromisify<TCustom>): TCustom;
    function promisify<TResult>(fn: (callback: (err: Error | null, result: TResult) => void) => void): () => Promise<TResult>;
    function promisify(fn: (callback: (err?: Error | null) => void) => void): () => Promise<void>;
    function promisify<T1, TResult>(fn: (arg1: T1, callback: (err: Error | null, result: TResult) => void) => void): (arg1: T1) => Promise<TResult>;
    function promisify<T1>(fn: (arg1: T1, callback: (err?: Error | null) => void) => void): (arg1: T1) => Promise<void>;
    function promisify<T1, T2, TResult>(fn: (arg1: T1, arg2: T2, callback: (err: Error | null, result: TResult) => void) => void): (arg1: T1, arg2: T2) => Promise<TResult>;
    function promisify<T1, T2>(fn: (arg1: T1, arg2: T2, callback: (err?: Error | null) => void) => void): (arg1: T1, arg2: T2) => Promise<void>;
    function promisify<T1, T2, T3, TResult>(fn: (arg1: T1, arg2: T2, arg3: T3, callback: (err: Error | null, result: TResult) => void) => void): (arg1: T1, arg2: T2, arg3: T3) => Promise<TResult>;
    function promisify<T1, T2, T3>(fn: (arg1: T1, arg2: T2, arg3: T3, callback: (err?: Error | null) => void) => void): (arg1: T1, arg2: T2, arg3: T3) => Promise<void>;
    function promisify<T1, T2, T3, T4, TResult>(
        fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, callback: (err: Error | null, result: TResult) => void) => void,
    ): (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<TResult>;
    function promisify<T1, T2, T3, T4>(fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, callback: (err?: Error | null) => void) => void): (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => Promise<void>;
    function promisify<T1, T2, T3, T4, T5, TResult>(
        fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5, callback: (err: Error | null, result: TResult) => void) => void,
    ): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<TResult>;
    function promisify<T1, T2, T3, T4, T5>(
        fn: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5, callback: (err?: Error | null) => void) => void,
    ): (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => Promise<void>;
    function promisify(fn: Function): Function;
    namespace promisify {
        const custom: symbol;
    }

    namespace types {
        function isAnyArrayBuffer(object: any): boolean;
        function isArgumentsObject(object: any): object is IArguments;
        function isArrayBuffer(object: any): object is ArrayBuffer;
        function isAsyncFunction(object: any): boolean;
        function isBooleanObject(object: any): object is Boolean;
        function isBoxedPrimitive(object: any): object is (Number | Boolean | String | Symbol /* BigInt */);
        function isDataView(object: any): object is DataView;
        function isDate(object: any): object is Date;
        function isExternal(object: any): boolean;
        function isFloat32Array(object: any): object is Float32Array;
        function isFloat64Array(object: any): object is Float64Array;
        function isGeneratorFunction(object: any): boolean;
        function isGeneratorObject(object: any): boolean;
        function isInt8Array(object: any): object is Int8Array;
        function isInt16Array(object: any): object is Int16Array;
        function isInt32Array(object: any): object is Int32Array;
        function isMap(object: any): boolean;
        function isMapIterator(object: any): boolean;
        function isNativeError(object: any): object is Error;
        function isNumberObject(object: any): object is Number;
        function isPromise(object: any): boolean;
        function isProxy(object: any): boolean;
        function isRegExp(object: any): object is RegExp;
        function isSet(object: any): boolean;
        function isSetIterator(object: any): boolean;
        function isSharedArrayBuffer(object: any): boolean;
        function isStringObject(object: any): boolean;
        function isSymbolObject(object: any): boolean;
        function isTypedArray(object: any): object is NodeJS.TypedArray;
        function isUint8Array(object: any): object is Uint8Array;
        function isUint8ClampedArray(object: any): object is Uint8ClampedArray;
        function isUint16Array(object: any): object is Uint16Array;
        function isUint32Array(object: any): object is Uint32Array;
        function isWeakMap(object: any): boolean;
        function isWeakSet(object: any): boolean;
        function isWebAssemblyCompiledModule(object: any): boolean;
    }

    class TextDecoder {
        readonly encoding: string;
        readonly fatal: boolean;
        readonly ignoreBOM: boolean;
        constructor(
          encoding?: string,
          options?: { fatal?: boolean; ignoreBOM?: boolean }
        );
        decode(
          input?: NodeJS.TypedArray | DataView | ArrayBuffer | null,
          options?: { stream?: boolean }
        ): string;
    }

    class TextEncoder {
        readonly encoding: string;
        constructor();
        encode(input?: string): Uint8Array;
    }
}

declare module "assert" {
    function internal(value: any, message?: string | Error): void;
    namespace internal {
        class AssertionError implements Error {
            name: string;
            message: string;
            actual: any;
            expected: any;
            operator: string;
            generatedMessage: boolean;
            code: 'ERR_ASSERTION';

            constructor(options?: {
                message?: string; actual?: any; expected?: any;
                operator?: string; stackStartFn?: Function
            });
        }

        function fail(message?: string | Error): never;
        /** @deprecated since v10.0.0 - use fail([message]) or other assert functions instead. */
        function fail(actual: any, expected: any, message?: string | Error, operator?: string, stackStartFn?: Function): never;
        function ok(value: any, message?: string | Error): void;
        /** @deprecated since v9.9.0 - use strictEqual() instead. */
        function equal(actual: any, expected: any, message?: string | Error): void;
        /** @deprecated since v9.9.0 - use notStrictEqual() instead. */
        function notEqual(actual: any, expected: any, message?: string | Error): void;
        /** @deprecated since v9.9.0 - use deepStrictEqual() instead. */
        function deepEqual(actual: any, expected: any, message?: string | Error): void;
        /** @deprecated since v9.9.0 - use notDeepStrictEqual() instead. */
        function notDeepEqual(actual: any, expected: any, message?: string | Error): void;
        function strictEqual(actual: any, expected: any, message?: string | Error): void;
        function notStrictEqual(actual: any, expected: any, message?: string | Error): void;
        function deepStrictEqual(actual: any, expected: any, message?: string | Error): void;
        function notDeepStrictEqual(actual: any, expected: any, message?: string | Error): void;

        function throws(block: Function, message?: string | Error): void;
        function throws(block: Function, error: RegExp | Function | Object | Error, message?: string | Error): void;
        function doesNotThrow(block: Function, message?: string | Error): void;
        function doesNotThrow(block: Function, error: RegExp | Function, message?: string | Error): void;

        function ifError(value: any): void;

        function rejects(block: Function | Promise<any>, message?: string | Error): Promise<void>;
        function rejects(block: Function | Promise<any>, error: RegExp | Function | Object | Error, message?: string | Error): Promise<void>;
        function doesNotReject(block: Function | Promise<any>, message?: string | Error): Promise<void>;
        function doesNotReject(block: Function | Promise<any>, error: RegExp | Function, message?: string | Error): Promise<void>;

        const strict: typeof internal;
    }

    export = internal;
}

declare module "tty" {
    import * as net from "net";

    function isatty(fd: number): boolean;
    class ReadStream extends net.Socket {
        isRaw: boolean;
        setRawMode(mode: boolean): void;
        isTTY: boolean;
    }
    class WriteStream extends net.Socket {
        columns: number;
        rows: number;
        isTTY: boolean;
    }
}

declare module "domain" {
    import * as events from "events";

    class Domain extends events.EventEmitter implements NodeJS.Domain {
        run(fn: Function): void;
        add(emitter: events.EventEmitter): void;
        remove(emitter: events.EventEmitter): void;
        bind(cb: (err: Error, data: any) => any): any;
        intercept(cb: (data: any) => any): any;
        members: any[];
        enter(): void;
        exit(): void;
    }

    function create(): Domain;
}

declare module "constants" {
    const E2BIG: number;
    const EACCES: number;
    const EADDRINUSE: number;
    const EADDRNOTAVAIL: number;
    const EAFNOSUPPORT: number;
    const EAGAIN: number;
    const EALREADY: number;
    const EBADF: number;
    const EBADMSG: number;
    const EBUSY: number;
    const ECANCELED: number;
    const ECHILD: number;
    const ECONNABORTED: number;
    const ECONNREFUSED: number;
    const ECONNRESET: number;
    const EDEADLK: number;
    const EDESTADDRREQ: number;
    const EDOM: number;
    const EEXIST: number;
    const EFAULT: number;
    const EFBIG: number;
    const EHOSTUNREACH: number;
    const EIDRM: number;
    const EILSEQ: number;
    const EINPROGRESS: number;
    const EINTR: number;
    const EINVAL: number;
    const EIO: number;
    const EISCONN: number;
    const EISDIR: number;
    const ELOOP: number;
    const EMFILE: number;
    const EMLINK: number;
    const EMSGSIZE: number;
    const ENAMETOOLONG: number;
    const ENETDOWN: number;
    const ENETRESET: number;
    const ENETUNREACH: number;
    const ENFILE: number;
    const ENOBUFS: number;
    const ENODATA: number;
    const ENODEV: number;
    const ENOENT: number;
    const ENOEXEC: number;
    const ENOLCK: number;
    const ENOLINK: number;
    const ENOMEM: number;
    const ENOMSG: number;
    const ENOPROTOOPT: number;
    const ENOSPC: number;
    const ENOSR: number;
    const ENOSTR: number;
    const ENOSYS: number;
    const ENOTCONN: number;
    const ENOTDIR: number;
    const ENOTEMPTY: number;
    const ENOTSOCK: number;
    const ENOTSUP: number;
    const ENOTTY: number;
    const ENXIO: number;
    const EOPNOTSUPP: number;
    const EOVERFLOW: number;
    const EPERM: number;
    const EPIPE: number;
    const EPROTO: number;
    const EPROTONOSUPPORT: number;
    const EPROTOTYPE: number;
    const ERANGE: number;
    const EROFS: number;
    const ESPIPE: number;
    const ESRCH: number;
    const ETIME: number;
    const ETIMEDOUT: number;
    const ETXTBSY: number;
    const EWOULDBLOCK: number;
    const EXDEV: number;
    const WSAEINTR: number;
    const WSAEBADF: number;
    const WSAEACCES: number;
    const WSAEFAULT: number;
    const WSAEINVAL: number;
    const WSAEMFILE: number;
    const WSAEWOULDBLOCK: number;
    const WSAEINPROGRESS: number;
    const WSAEALREADY: number;
    const WSAENOTSOCK: number;
    const WSAEDESTADDRREQ: number;
    const WSAEMSGSIZE: number;
    const WSAEPROTOTYPE: number;
    const WSAENOPROTOOPT: number;
    const WSAEPROTONOSUPPORT: number;
    const WSAESOCKTNOSUPPORT: number;
    const WSAEOPNOTSUPP: number;
    const WSAEPFNOSUPPORT: number;
    const WSAEAFNOSUPPORT: number;
    const WSAEADDRINUSE: number;
    const WSAEADDRNOTAVAIL: number;
    const WSAENETDOWN: number;
    const WSAENETUNREACH: number;
    const WSAENETRESET: number;
    const WSAECONNABORTED: number;
    const WSAECONNRESET: number;
    const WSAENOBUFS: number;
    const WSAEISCONN: number;
    const WSAENOTCONN: number;
    const WSAESHUTDOWN: number;
    const WSAETOOMANYREFS: number;
    const WSAETIMEDOUT: number;
    const WSAECONNREFUSED: number;
    const WSAELOOP: number;
    const WSAENAMETOOLONG: number;
    const WSAEHOSTDOWN: number;
    const WSAEHOSTUNREACH: number;
    const WSAENOTEMPTY: number;
    const WSAEPROCLIM: number;
    const WSAEUSERS: number;
    const WSAEDQUOT: number;
    const WSAESTALE: number;
    const WSAEREMOTE: number;
    const WSASYSNOTREADY: number;
    const WSAVERNOTSUPPORTED: number;
    const WSANOTINITIALISED: number;
    const WSAEDISCON: number;
    const WSAENOMORE: number;
    const WSAECANCELLED: number;
    const WSAEINVALIDPROCTABLE: number;
    const WSAEINVALIDPROVIDER: number;
    const WSAEPROVIDERFAILEDINIT: number;
    const WSASYSCALLFAILURE: number;
    const WSASERVICE_NOT_FOUND: number;
    const WSATYPE_NOT_FOUND: number;
    const WSA_E_NO_MORE: number;
    const WSA_E_CANCELLED: number;
    const WSAEREFUSED: number;
    const SIGHUP: number;
    const SIGINT: number;
    const SIGILL: number;
    const SIGABRT: number;
    const SIGFPE: number;
    const SIGKILL: number;
    const SIGSEGV: number;
    const SIGTERM: number;
    const SIGBREAK: number;
    const SIGWINCH: number;
    const SSL_OP_ALL: number;
    const SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION: number;
    const SSL_OP_CIPHER_SERVER_PREFERENCE: number;
    const SSL_OP_CISCO_ANYCONNECT: number;
    const SSL_OP_COOKIE_EXCHANGE: number;
    const SSL_OP_CRYPTOPRO_TLSEXT_BUG: number;
    const SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS: number;
    const SSL_OP_EPHEMERAL_RSA: number;
    const SSL_OP_LEGACY_SERVER_CONNECT: number;
    const SSL_OP_MICROSOFT_BIG_SSLV3_BUFFER: number;
    const SSL_OP_MICROSOFT_SESS_ID_BUG: number;
    const SSL_OP_MSIE_SSLV2_RSA_PADDING: number;
    const SSL_OP_NETSCAPE_CA_DN_BUG: number;
    const SSL_OP_NETSCAPE_CHALLENGE_BUG: number;
    const SSL_OP_NETSCAPE_DEMO_CIPHER_CHANGE_BUG: number;
    const SSL_OP_NETSCAPE_REUSE_CIPHER_CHANGE_BUG: number;
    const SSL_OP_NO_COMPRESSION: number;
    const SSL_OP_NO_QUERY_MTU: number;
    const SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION: number;
    const SSL_OP_NO_SSLv2: number;
    const SSL_OP_NO_SSLv3: number;
    const SSL_OP_NO_TICKET: number;
    const SSL_OP_NO_TLSv1: number;
    const SSL_OP_NO_TLSv1_1: number;
    const SSL_OP_NO_TLSv1_2: number;
    const SSL_OP_PKCS1_CHECK_1: number;
    const SSL_OP_PKCS1_CHECK_2: number;
    const SSL_OP_SINGLE_DH_USE: number;
    const SSL_OP_SINGLE_ECDH_USE: number;
    const SSL_OP_SSLEAY_080_CLIENT_DH_BUG: number;
    const SSL_OP_SSLREF2_REUSE_CERT_TYPE_BUG: number;
    const SSL_OP_TLS_BLOCK_PADDING_BUG: number;
    const SSL_OP_TLS_D5_BUG: number;
    const SSL_OP_TLS_ROLLBACK_BUG: number;
    const ENGINE_METHOD_DSA: number;
    const ENGINE_METHOD_DH: number;
    const ENGINE_METHOD_RAND: number;
    const ENGINE_METHOD_ECDH: number;
    const ENGINE_METHOD_ECDSA: number;
    const ENGINE_METHOD_CIPHERS: number;
    const ENGINE_METHOD_DIGESTS: number;
    const ENGINE_METHOD_STORE: number;
    const ENGINE_METHOD_PKEY_METHS: number;
    const ENGINE_METHOD_PKEY_ASN1_METHS: number;
    const ENGINE_METHOD_ALL: number;
    const ENGINE_METHOD_NONE: number;
    const DH_CHECK_P_NOT_SAFE_PRIME: number;
    const DH_CHECK_P_NOT_PRIME: number;
    const DH_UNABLE_TO_CHECK_GENERATOR: number;
    const DH_NOT_SUITABLE_GENERATOR: number;
    const NPN_ENABLED: number;
    const RSA_PKCS1_PADDING: number;
    const RSA_SSLV23_PADDING: number;
    const RSA_NO_PADDING: number;
    const RSA_PKCS1_OAEP_PADDING: number;
    const RSA_X931_PADDING: number;
    const RSA_PKCS1_PSS_PADDING: number;
    const POINT_CONVERSION_COMPRESSED: number;
    const POINT_CONVERSION_UNCOMPRESSED: number;
    const POINT_CONVERSION_HYBRID: number;
    const O_RDONLY: number;
    const O_WRONLY: number;
    const O_RDWR: number;
    const S_IFMT: number;
    const S_IFREG: number;
    const S_IFDIR: number;
    const S_IFCHR: number;
    const S_IFBLK: number;
    const S_IFIFO: number;
    const S_IFSOCK: number;
    const S_IRWXU: number;
    const S_IRUSR: number;
    const S_IWUSR: number;
    const S_IXUSR: number;
    const S_IRWXG: number;
    const S_IRGRP: number;
    const S_IWGRP: number;
    const S_IXGRP: number;
    const S_IRWXO: number;
    const S_IROTH: number;
    const S_IWOTH: number;
    const S_IXOTH: number;
    const S_IFLNK: number;
    const O_CREAT: number;
    const O_EXCL: number;
    const O_NOCTTY: number;
    const O_DIRECTORY: number;
    const O_NOATIME: number;
    const O_NOFOLLOW: number;
    const O_SYNC: number;
    const O_DSYNC: number;
    const O_SYMLINK: number;
    const O_DIRECT: number;
    const O_NONBLOCK: number;
    const O_TRUNC: number;
    const O_APPEND: number;
    const F_OK: number;
    const R_OK: number;
    const W_OK: number;
    const X_OK: number;
    const COPYFILE_EXCL: number;
    const COPYFILE_FICLONE: number;
    const COPYFILE_FICLONE_FORCE: number;
    const UV_UDP_REUSEADDR: number;
    const SIGQUIT: number;
    const SIGTRAP: number;
    const SIGIOT: number;
    const SIGBUS: number;
    const SIGUSR1: number;
    const SIGUSR2: number;
    const SIGPIPE: number;
    const SIGALRM: number;
    const SIGCHLD: number;
    const SIGSTKFLT: number;
    const SIGCONT: number;
    const SIGSTOP: number;
    const SIGTSTP: number;
    const SIGTTIN: number;
    const SIGTTOU: number;
    const SIGURG: number;
    const SIGXCPU: number;
    const SIGXFSZ: number;
    const SIGVTALRM: number;
    const SIGPROF: number;
    const SIGIO: number;
    const SIGPOLL: number;
    const SIGPWR: number;
    const SIGSYS: number;
    const SIGUNUSED: number;
    const defaultCoreCipherList: string;
    const defaultCipherList: string;
    const ENGINE_METHOD_RSA: number;
    const ALPN_ENABLED: number;
}

declare module "module" {
    export = NodeJS.Module;
}

declare module "process" {
    export = process;
}

declare module "v8" {
    interface HeapSpaceInfo {
        space_name: string;
        space_size: number;
        space_used_size: number;
        space_available_size: number;
        physical_space_size: number;
    }

    // ** Signifies if the --zap_code_space option is enabled or not.  1 == enabled, 0 == disabled. */
    type DoesZapCodeSpaceFlag = 0 | 1;

    interface HeapInfo {
        total_heap_size: number;
        total_heap_size_executable: number;
        total_physical_size: number;
        total_available_size: number;
        used_heap_size: number;
        heap_size_limit: number;
        malloced_memory: number;
        peak_malloced_memory: number;
        does_zap_garbage: DoesZapCodeSpaceFlag;
    }

    function getHeapStatistics(): HeapInfo;
    function getHeapSpaceStatistics(): HeapSpaceInfo[];
    function setFlagsFromString(flags: string): void;
}

declare module "timers" {
    function setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout;
    namespace setTimeout {
        function __promisify__(ms: number): Promise<void>;
        function __promisify__<T>(ms: number, value: T): Promise<T>;
    }
    function clearTimeout(timeoutId: NodeJS.Timeout): void;
    function setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout;
    function clearInterval(intervalId: NodeJS.Timeout): void;
    function setImmediate(callback: (...args: any[]) => void, ...args: any[]): NodeJS.Immediate;
    namespace setImmediate {
        function __promisify__(): Promise<void>;
        function __promisify__<T>(value: T): Promise<T>;
    }
    function clearImmediate(immediateId: NodeJS.Immediate): void;
}

declare module "console" {
    export = console;
}

/**
 * Async Hooks module: https://nodejs.org/api/async_hooks.html
 */
declare module "async_hooks" {
    /**
     * Returns the asyncId of the current execution context.
     */
    function executionAsyncId(): number;

    /**
     * Returns the ID of the resource responsible for calling the callback that is currently being executed.
     */
    function triggerAsyncId(): number;

    interface HookCallbacks {
        /**
         * Called when a class is constructed that has the possibility to emit an asynchronous event.
         * @param asyncId a unique ID for the async resource
         * @param type the type of the async resource
         * @param triggerAsyncId the unique ID of the async resource in whose execution context this async resource was created
         * @param resource reference to the resource representing the async operation, needs to be released during destroy
         */
        init?(asyncId: number, type: string, triggerAsyncId: number, resource: Object): void;

        /**
         * When an asynchronous operation is initiated or completes a callback is called to notify the user.
         * The before callback is called just before said callback is executed.
         * @param asyncId the unique identifier assigned to the resource about to execute the callback.
         */
        before?(asyncId: number): void;

        /**
         * Called immediately after the callback specified in before is completed.
         * @param asyncId the unique identifier assigned to the resource which has executed the callback.
         */
        after?(asyncId: number): void;

        /**
         * Called when a promise has resolve() called. This may not be in the same execution id
         * as the promise itself.
         * @param asyncId the unique id for the promise that was resolve()d.
         */
        promiseResolve?(asyncId: number): void;

        /**
         * Called after the resource corresponding to asyncId is destroyed
         * @param asyncId a unique ID for the async resource
         */
        destroy?(asyncId: number): void;
    }

    interface AsyncHook {
        /**
         * Enable the callbacks for a given AsyncHook instance. If no callbacks are provided enabling is a noop.
         */
        enable(): this;

        /**
         * Disable the callbacks for a given AsyncHook instance from the global pool of AsyncHook callbacks to be executed. Once a hook has been disabled it will not be called again until enabled.
         */
        disable(): this;
    }

    /**
     * Registers functions to be called for different lifetime events of each async operation.
     * @param options the callbacks to register
     * @return an AsyncHooks instance used for disabling and enabling hooks
     */
    function createHook(options: HookCallbacks): AsyncHook;

    interface AsyncResourceOptions {
      /**
       * The ID of the execution context that created this async event.
       * Default: `executionAsyncId()`
       */
      triggerAsyncId?: number;

      /**
       * Disables automatic `emitDestroy` when the object is garbage collected.
       * This usually does not need to be set (even if `emitDestroy` is called
       * manually), unless the resource's `asyncId` is retrieved and the
       * sensitive API's `emitDestroy` is called with it.
       * Default: `false`
       */
      requireManualDestroy?: boolean;
    }

    /**
     * The class AsyncResource was designed to be extended by the embedder's async resources.
     * Using this users can easily trigger the lifetime events of their own resources.
     */
    class AsyncResource {
        /**
         * AsyncResource() is meant to be extended. Instantiating a
         * new AsyncResource() also triggers init. If triggerAsyncId is omitted then
         * async_hook.executionAsyncId() is used.
         * @param type The type of async event.
         * @param triggerAsyncId The ID of the execution context that created
         *   this async event (default: `executionAsyncId()`), or an
         *   AsyncResourceOptions object (since 9.3)
         */
        constructor(type: string, triggerAsyncId?: number|AsyncResourceOptions);

        /**
         * Call AsyncHooks before callbacks.
         * @deprecated since 9.6 - Use asyncResource.runInAsyncScope() instead.
         */
        emitBefore(): void;

        /**
         * Call AsyncHooks after callbacks.
         * @deprecated since 9.6 - Use asyncResource.runInAsyncScope() instead.
         */
        emitAfter(): void;

        /**
         * Call the provided function with the provided arguments in the
         * execution context of the async resource. This will establish the
         * context, trigger the AsyncHooks before callbacks, call the function,
         * trigger the AsyncHooks after callbacks, and then restore the original
         * execution context.
         * @param fn The function to call in the execution context of this
         *   async resource.
         * @param thisArg The receiver to be used for the function call.
         * @param args Optional arguments to pass to the function.
         */
        runInAsyncScope<This, Result>(fn: (this: This, ...args: any[]) => Result, thisArg?: This, ...args: any[]): Result;

        /**
         * Call AsyncHooks destroy callbacks.
         */
        emitDestroy(): void;

        /**
         * @return the unique ID assigned to this AsyncResource instance.
         */
        asyncId(): number;

        /**
         * @return the trigger ID for this AsyncResource instance.
         */
        triggerAsyncId(): number;
    }
}

declare module "http2" {
    import * as events from "events";
    import * as fs from "fs";
    import * as net from "net";
    import * as stream from "stream";
    import * as tls from "tls";
    import * as url from "url";

    import { IncomingHttpHeaders as Http1IncomingHttpHeaders, OutgoingHttpHeaders } from "http";
    export { OutgoingHttpHeaders } from "http";

    export interface IncomingHttpStatusHeader {
        ":status"?: number;
    }

    export interface IncomingHttpHeaders extends Http1IncomingHttpHeaders {
        ":path"?: string;
        ":method"?: string;
        ":authority"?: string;
        ":scheme"?: string;
    }

    // Http2Stream

    export interface StreamPriorityOptions {
        exclusive?: boolean;
        parent?: number;
        weight?: number;
        silent?: boolean;
    }

    export interface StreamState {
        localWindowSize?: number;
        state?: number;
        streamLocalClose?: number;
        streamRemoteClose?: number;
        sumDependencyWeight?: number;
        weight?: number;
    }

    export interface ServerStreamResponseOptions {
        endStream?: boolean;
        waitForTrailers?: boolean;
    }

    export interface StatOptions {
        offset: number;
        length: number;
    }

    export interface ServerStreamFileResponseOptions {
        statCheck?: (stats: fs.Stats, headers: OutgoingHttpHeaders, statOptions: StatOptions) => void | boolean;
        getTrailers?: (trailers: OutgoingHttpHeaders) => void;
        offset?: number;
        length?: number;
    }

    export interface ServerStreamFileResponseOptionsWithError extends ServerStreamFileResponseOptions {
        onError?: (err: NodeJS.ErrnoException) => void;
    }

    export interface Http2Stream extends stream.Duplex {
        readonly aborted: boolean;
        readonly closed: boolean;
        readonly destroyed: boolean;
        readonly pending: boolean;
        readonly rstCode: number;
        readonly sentHeaders: OutgoingHttpHeaders;
        readonly sentInfoHeaders?: OutgoingHttpHeaders[];
        readonly sentTrailers?: OutgoingHttpHeaders;
        readonly session: Http2Session;
        readonly state: StreamState;
        /**
         * Set the true if the END_STREAM flag was set in the request or response HEADERS frame received,
         * indicating that no additional data should be received and the readable side of the Http2Stream will be closed.
         */
        readonly endAfterHeaders: boolean;
        close(code?: number, callback?: () => void): void;
        priority(options: StreamPriorityOptions): void;
        setTimeout(msecs: number, callback?: () => void): void;

        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "aborted", listener: () => void): this;
        addListener(event: "close", listener: () => void): this;
        addListener(event: "data", listener: (chunk: Buffer | string) => void): this;
        addListener(event: "drain", listener: () => void): this;
        addListener(event: "end", listener: () => void): this;
        addListener(event: "error", listener: (err: Error) => void): this;
        addListener(event: "finish", listener: () => void): this;
        addListener(event: "frameError", listener: (frameType: number, errorCode: number) => void): this;
        addListener(event: "pipe", listener: (src: stream.Readable) => void): this;
        addListener(event: "unpipe", listener: (src: stream.Readable) => void): this;
        addListener(event: "streamClosed", listener: (code: number) => void): this;
        addListener(event: "timeout", listener: () => void): this;
        addListener(event: "trailers", listener: (trailers: IncomingHttpHeaders, flags: number) => void): this;
        addListener(event: "wantTrailers", listener: () => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "aborted"): boolean;
        emit(event: "close"): boolean;
        emit(event: "data", chunk: Buffer | string): boolean;
        emit(event: "drain"): boolean;
        emit(event: "end"): boolean;
        emit(event: "error", err: Error): boolean;
        emit(event: "finish"): boolean;
        emit(event: "frameError", frameType: number, errorCode: number): boolean;
        emit(event: "pipe", src: stream.Readable): boolean;
        emit(event: "unpipe", src: stream.Readable): boolean;
        emit(event: "streamClosed", code: number): boolean;
        emit(event: "timeout"): boolean;
        emit(event: "trailers", trailers: IncomingHttpHeaders, flags: number): boolean;
        emit(event: "wantTrailers"): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "aborted", listener: () => void): this;
        on(event: "close", listener: () => void): this;
        on(event: "data", listener: (chunk: Buffer | string) => void): this;
        on(event: "drain", listener: () => void): this;
        on(event: "end", listener: () => void): this;
        on(event: "error", listener: (err: Error) => void): this;
        on(event: "finish", listener: () => void): this;
        on(event: "frameError", listener: (frameType: number, errorCode: number) => void): this;
        on(event: "pipe", listener: (src: stream.Readable) => void): this;
        on(event: "unpipe", listener: (src: stream.Readable) => void): this;
        on(event: "streamClosed", listener: (code: number) => void): this;
        on(event: "timeout", listener: () => void): this;
        on(event: "trailers", listener: (trailers: IncomingHttpHeaders, flags: number) => void): this;
        on(event: "wantTrailers", listener: () => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "aborted", listener: () => void): this;
        once(event: "close", listener: () => void): this;
        once(event: "data", listener: (chunk: Buffer | string) => void): this;
        once(event: "drain", listener: () => void): this;
        once(event: "end", listener: () => void): this;
        once(event: "error", listener: (err: Error) => void): this;
        once(event: "finish", listener: () => void): this;
        once(event: "frameError", listener: (frameType: number, errorCode: number) => void): this;
        once(event: "pipe", listener: (src: stream.Readable) => void): this;
        once(event: "unpipe", listener: (src: stream.Readable) => void): this;
        once(event: "streamClosed", listener: (code: number) => void): this;
        once(event: "timeout", listener: () => void): this;
        once(event: "trailers", listener: (trailers: IncomingHttpHeaders, flags: number) => void): this;
        once(event: "wantTrailers", listener: () => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "aborted", listener: () => void): this;
        prependListener(event: "close", listener: () => void): this;
        prependListener(event: "data", listener: (chunk: Buffer | string) => void): this;
        prependListener(event: "drain", listener: () => void): this;
        prependListener(event: "end", listener: () => void): this;
        prependListener(event: "error", listener: (err: Error) => void): this;
        prependListener(event: "finish", listener: () => void): this;
        prependListener(event: "frameError", listener: (frameType: number, errorCode: number) => void): this;
        prependListener(event: "pipe", listener: (src: stream.Readable) => void): this;
        prependListener(event: "unpipe", listener: (src: stream.Readable) => void): this;
        prependListener(event: "streamClosed", listener: (code: number) => void): this;
        prependListener(event: "timeout", listener: () => void): this;
        prependListener(event: "trailers", listener: (trailers: IncomingHttpHeaders, flags: number) => void): this;
        prependListener(event: "wantTrailers", listener: () => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "aborted", listener: () => void): this;
        prependOnceListener(event: "close", listener: () => void): this;
        prependOnceListener(event: "data", listener: (chunk: Buffer | string) => void): this;
        prependOnceListener(event: "drain", listener: () => void): this;
        prependOnceListener(event: "end", listener: () => void): this;
        prependOnceListener(event: "error", listener: (err: Error) => void): this;
        prependOnceListener(event: "finish", listener: () => void): this;
        prependOnceListener(event: "frameError", listener: (frameType: number, errorCode: number) => void): this;
        prependOnceListener(event: "pipe", listener: (src: stream.Readable) => void): this;
        prependOnceListener(event: "unpipe", listener: (src: stream.Readable) => void): this;
        prependOnceListener(event: "streamClosed", listener: (code: number) => void): this;
        prependOnceListener(event: "timeout", listener: () => void): this;
        prependOnceListener(event: "trailers", listener: (trailers: IncomingHttpHeaders, flags: number) => void): this;
        prependOnceListener(event: "wantTrailers", listener: () => void): this;

        sendTrailers(headers: OutgoingHttpHeaders): this;
    }

    export interface ClientHttp2Stream extends Http2Stream {
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "headers", listener: (headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;
        addListener(event: "push", listener: (headers: IncomingHttpHeaders, flags: number) => void): this;
        addListener(event: "response", listener: (headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "headers", headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number): boolean;
        emit(event: "push", headers: IncomingHttpHeaders, flags: number): boolean;
        emit(event: "response", headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "headers", listener: (headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;
        on(event: "push", listener: (headers: IncomingHttpHeaders, flags: number) => void): this;
        on(event: "response", listener: (headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "headers", listener: (headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;
        once(event: "push", listener: (headers: IncomingHttpHeaders, flags: number) => void): this;
        once(event: "response", listener: (headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "headers", listener: (headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;
        prependListener(event: "push", listener: (headers: IncomingHttpHeaders, flags: number) => void): this;
        prependListener(event: "response", listener: (headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "headers", listener: (headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;
        prependOnceListener(event: "push", listener: (headers: IncomingHttpHeaders, flags: number) => void): this;
        prependOnceListener(event: "response", listener: (headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;
    }

    export interface ServerHttp2Stream extends Http2Stream {
        additionalHeaders(headers: OutgoingHttpHeaders): void;
        readonly headersSent: boolean;
        readonly pushAllowed: boolean;
        pushStream(headers: OutgoingHttpHeaders, callback?: (err: Error | null, pushStream: ServerHttp2Stream, headers: OutgoingHttpHeaders) => void): void;
        pushStream(headers: OutgoingHttpHeaders, options?: StreamPriorityOptions, callback?: (err: Error | null, pushStream: ServerHttp2Stream, headers: OutgoingHttpHeaders) => void): void;
        respond(headers?: OutgoingHttpHeaders, options?: ServerStreamResponseOptions): void;
        respondWithFD(fd: number, headers?: OutgoingHttpHeaders, options?: ServerStreamFileResponseOptions): void;
        respondWithFile(path: string, headers?: OutgoingHttpHeaders, options?: ServerStreamFileResponseOptionsWithError): void;
    }

    // Http2Session

    export interface Settings {
        headerTableSize?: number;
        enablePush?: boolean;
        initialWindowSize?: number;
        maxFrameSize?: number;
        maxConcurrentStreams?: number;
        maxHeaderListSize?: number;
    }

    export interface ClientSessionRequestOptions {
        endStream?: boolean;
        exclusive?: boolean;
        parent?: number;
        weight?: number;
        getTrailers?: (trailers: OutgoingHttpHeaders, flags: number) => void;
    }

    export interface SessionState {
        effectiveLocalWindowSize?: number;
        effectiveRecvDataLength?: number;
        nextStreamID?: number;
        localWindowSize?: number;
        lastProcStreamID?: number;
        remoteWindowSize?: number;
        outboundQueueSize?: number;
        deflateDynamicTableSize?: number;
        inflateDynamicTableSize?: number;
    }

    export interface Http2Session extends events.EventEmitter {
        readonly alpnProtocol?: string;
        close(callback?: () => void): void;
        readonly closed: boolean;
        readonly connecting: boolean;
        destroy(error?: Error, code?: number): void;
        readonly destroyed: boolean;
        readonly encrypted?: boolean;
        goaway(code?: number, lastStreamID?: number, opaqueData?: Buffer | DataView | NodeJS.TypedArray): void;
        readonly localSettings: Settings;
        readonly originSet?: string[];
        readonly pendingSettingsAck: boolean;
        ping(callback: (err: Error | null, duration: number, payload: Buffer) => void): boolean;
        ping(payload: Buffer | DataView | NodeJS.TypedArray , callback: (err: Error | null, duration: number, payload: Buffer) => void): boolean;
        ref(): void;
        readonly remoteSettings: Settings;
        rstStream(stream: Http2Stream, code?: number): void;
        setTimeout(msecs: number, callback?: () => void): void;
        readonly socket: net.Socket | tls.TLSSocket;
        readonly state: SessionState;
        priority(stream: Http2Stream, options: StreamPriorityOptions): void;
        settings(settings: Settings): void;
        readonly type: number;
        unref(): void;

        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "close", listener: () => void): this;
        addListener(event: "error", listener: (err: Error) => void): this;
        addListener(event: "frameError", listener: (frameType: number, errorCode: number, streamID: number) => void): this;
        addListener(event: "goaway", listener: (errorCode: number, lastStreamID: number, opaqueData: Buffer) => void): this;
        addListener(event: "localSettings", listener: (settings: Settings) => void): this;
        addListener(event: "remoteSettings", listener: (settings: Settings) => void): this;
        addListener(event: "timeout", listener: () => void): this;
        addListener(event: "ping", listener: () => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "close"): boolean;
        emit(event: "error", err: Error): boolean;
        emit(event: "frameError", frameType: number, errorCode: number, streamID: number): boolean;
        emit(event: "goaway", errorCode: number, lastStreamID: number, opaqueData: Buffer): boolean;
        emit(event: "localSettings", settings: Settings): boolean;
        emit(event: "remoteSettings", settings: Settings): boolean;
        emit(event: "timeout"): boolean;
        emit(event: "ping"): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "close", listener: () => void): this;
        on(event: "error", listener: (err: Error) => void): this;
        on(event: "frameError", listener: (frameType: number, errorCode: number, streamID: number) => void): this;
        on(event: "goaway", listener: (errorCode: number, lastStreamID: number, opaqueData: Buffer) => void): this;
        on(event: "localSettings", listener: (settings: Settings) => void): this;
        on(event: "remoteSettings", listener: (settings: Settings) => void): this;
        on(event: "timeout", listener: () => void): this;
        on(event: "ping", listener: () => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "close", listener: () => void): this;
        once(event: "error", listener: (err: Error) => void): this;
        once(event: "frameError", listener: (frameType: number, errorCode: number, streamID: number) => void): this;
        once(event: "goaway", listener: (errorCode: number, lastStreamID: number, opaqueData: Buffer) => void): this;
        once(event: "localSettings", listener: (settings: Settings) => void): this;
        once(event: "remoteSettings", listener: (settings: Settings) => void): this;
        once(event: "timeout", listener: () => void): this;
        once(event: "ping", listener: () => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "close", listener: () => void): this;
        prependListener(event: "error", listener: (err: Error) => void): this;
        prependListener(event: "frameError", listener: (frameType: number, errorCode: number, streamID: number) => void): this;
        prependListener(event: "goaway", listener: (errorCode: number, lastStreamID: number, opaqueData: Buffer) => void): this;
        prependListener(event: "localSettings", listener: (settings: Settings) => void): this;
        prependListener(event: "remoteSettings", listener: (settings: Settings) => void): this;
        prependListener(event: "timeout", listener: () => void): this;
        prependListener(event: "ping", listener: () => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "close", listener: () => void): this;
        prependOnceListener(event: "error", listener: (err: Error) => void): this;
        prependOnceListener(event: "frameError", listener: (frameType: number, errorCode: number, streamID: number) => void): this;
        prependOnceListener(event: "goaway", listener: (errorCode: number, lastStreamID: number, opaqueData: Buffer) => void): this;
        prependOnceListener(event: "localSettings", listener: (settings: Settings) => void): this;
        prependOnceListener(event: "remoteSettings", listener: (settings: Settings) => void): this;
        prependOnceListener(event: "timeout", listener: () => void): this;
        prependOnceListener(event: "ping", listener: () => void): this;
    }

    export interface ClientHttp2Session extends Http2Session {
        request(headers?: OutgoingHttpHeaders, options?: ClientSessionRequestOptions): ClientHttp2Stream;

        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "altsvc", listener: (alt: string, origin: string, stream: number) => void): this;
        addListener(event: "connect", listener: (session: ClientHttp2Session, socket: net.Socket | tls.TLSSocket) => void): this;
        addListener(event: "stream", listener: (stream: ClientHttp2Stream, headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "altsvc", alt: string, origin: string, stream: number): boolean;
        emit(event: "connect", session: ClientHttp2Session, socket: net.Socket | tls.TLSSocket): boolean;
        emit(event: "stream", stream: ClientHttp2Stream, headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "altsvc", listener: (alt: string, origin: string, stream: number) => void): this;
        on(event: "connect", listener: (session: ClientHttp2Session, socket: net.Socket | tls.TLSSocket) => void): this;
        on(event: "stream", listener: (stream: ClientHttp2Stream, headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "altsvc", listener: (alt: string, origin: string, stream: number) => void): this;
        once(event: "connect", listener: (session: ClientHttp2Session, socket: net.Socket | tls.TLSSocket) => void): this;
        once(event: "stream", listener: (stream: ClientHttp2Stream, headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "altsvc", listener: (alt: string, origin: string, stream: number) => void): this;
        prependListener(event: "connect", listener: (session: ClientHttp2Session, socket: net.Socket | tls.TLSSocket) => void): this;
        prependListener(event: "stream", listener: (stream: ClientHttp2Stream, headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "altsvc", listener: (alt: string, origin: string, stream: number) => void): this;
        prependOnceListener(event: "connect", listener: (session: ClientHttp2Session, socket: net.Socket | tls.TLSSocket) => void): this;
        prependOnceListener(event: "stream", listener: (stream: ClientHttp2Stream, headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number) => void): this;
    }

    export interface AlternativeServiceOptions {
        origin: number | string | url.URL;
    }

    export interface ServerHttp2Session extends Http2Session {
        altsvc(alt: string, originOrStream: number | string | url.URL | AlternativeServiceOptions): void;
        readonly server: Http2Server | Http2SecureServer;

        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "connect", listener: (session: ServerHttp2Session, socket: net.Socket | tls.TLSSocket) => void): this;
        addListener(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "connect", session: ServerHttp2Session, socket: net.Socket | tls.TLSSocket): boolean;
        emit(event: "stream", stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "connect", listener: (session: ServerHttp2Session, socket: net.Socket | tls.TLSSocket) => void): this;
        on(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "connect", listener: (session: ServerHttp2Session, socket: net.Socket | tls.TLSSocket) => void): this;
        once(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "connect", listener: (session: ServerHttp2Session, socket: net.Socket | tls.TLSSocket) => void): this;
        prependListener(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "connect", listener: (session: ServerHttp2Session, socket: net.Socket | tls.TLSSocket) => void): this;
        prependOnceListener(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;
    }

    // Http2Server

    export interface SessionOptions {
        maxDeflateDynamicTableSize?: number;
        maxReservedRemoteStreams?: number;
        maxSendHeaderBlockLength?: number;
        paddingStrategy?: number;
        peerMaxConcurrentStreams?: number;
        selectPadding?: (frameLen: number, maxFrameLen: number) => number;
        settings?: Settings;
        createConnection?: (option: SessionOptions) => stream.Duplex;
    }

    export type ClientSessionOptions = SessionOptions;
    export type ServerSessionOptions = SessionOptions;

    export interface SecureClientSessionOptions extends ClientSessionOptions, tls.ConnectionOptions { }
    export interface SecureServerSessionOptions extends ServerSessionOptions, tls.TlsOptions { }

    export interface ServerOptions extends ServerSessionOptions {
        allowHTTP1?: boolean;
    }

    export interface SecureServerOptions extends SecureServerSessionOptions {
        allowHTTP1?: boolean;
    }

    export interface Http2Server extends net.Server {
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "checkContinue", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        addListener(event: "request", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        addListener(event: "sessionError", listener: (err: Error) => void): this;
        addListener(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;
        addListener(event: "timeout", listener: () => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "checkContinue", request: Http2ServerRequest, response: Http2ServerResponse): boolean;
        emit(event: "request", request: Http2ServerRequest, response: Http2ServerResponse): boolean;
        emit(event: "sessionError", err: Error): boolean;
        emit(event: "stream", stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number): boolean;
        emit(event: "timeout"): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "checkContinue", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        on(event: "request", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        on(event: "sessionError", listener: (err: Error) => void): this;
        on(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;
        on(event: "timeout", listener: () => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "checkContinue", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        once(event: "request", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        once(event: "sessionError", listener: (err: Error) => void): this;
        once(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;
        once(event: "timeout", listener: () => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "checkContinue", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        prependListener(event: "request", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        prependListener(event: "sessionError", listener: (err: Error) => void): this;
        prependListener(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;
        prependListener(event: "timeout", listener: () => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "checkContinue", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        prependOnceListener(event: "request", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        prependOnceListener(event: "sessionError", listener: (err: Error) => void): this;
        prependOnceListener(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;
        prependOnceListener(event: "timeout", listener: () => void): this;
    }

    export interface Http2SecureServer extends tls.Server {
        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "checkContinue", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        addListener(event: "request", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        addListener(event: "sessionError", listener: (err: Error) => void): this;
        addListener(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;
        addListener(event: "timeout", listener: () => void): this;
        addListener(event: "unknownProtocol", listener: (socket: tls.TLSSocket) => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "checkContinue", request: Http2ServerRequest, response: Http2ServerResponse): boolean;
        emit(event: "request", request: Http2ServerRequest, response: Http2ServerResponse): boolean;
        emit(event: "sessionError", err: Error): boolean;
        emit(event: "stream", stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number): boolean;
        emit(event: "timeout"): boolean;
        emit(event: "unknownProtocol", socket: tls.TLSSocket): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "checkContinue", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        on(event: "request", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        on(event: "sessionError", listener: (err: Error) => void): this;
        on(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;
        on(event: "timeout", listener: () => void): this;
        on(event: "unknownProtocol", listener: (socket: tls.TLSSocket) => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "checkContinue", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        once(event: "request", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        once(event: "sessionError", listener: (err: Error) => void): this;
        once(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;
        once(event: "timeout", listener: () => void): this;
        once(event: "unknownProtocol", listener: (socket: tls.TLSSocket) => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "checkContinue", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        prependListener(event: "request", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        prependListener(event: "sessionError", listener: (err: Error) => void): this;
        prependListener(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;
        prependListener(event: "timeout", listener: () => void): this;
        prependListener(event: "unknownProtocol", listener: (socket: tls.TLSSocket) => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "checkContinue", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        prependOnceListener(event: "request", listener: (request: Http2ServerRequest, response: Http2ServerResponse) => void): this;
        prependOnceListener(event: "sessionError", listener: (err: Error) => void): this;
        prependOnceListener(event: "stream", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders, flags: number) => void): this;
        prependOnceListener(event: "timeout", listener: () => void): this;
        prependOnceListener(event: "unknownProtocol", listener: (socket: tls.TLSSocket) => void): this;
    }

    export class Http2ServerRequest extends stream.Readable {
        private constructor();
        headers: IncomingHttpHeaders;
        httpVersion: string;
        method: string;
        rawHeaders: string[];
        rawTrailers: string[];
        setTimeout(msecs: number, callback?: () => void): void;
        socket: net.Socket | tls.TLSSocket;
        stream: ServerHttp2Stream;
        trailers: IncomingHttpHeaders;
        url: string;

        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "aborted", listener: (hadError: boolean, code: number) => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "aborted", hadError: boolean, code: number): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "aborted", listener: (hadError: boolean, code: number) => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "aborted", listener: (hadError: boolean, code: number) => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "aborted", listener: (hadError: boolean, code: number) => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "aborted", listener: (hadError: boolean, code: number) => void): this;
    }

    export class Http2ServerResponse extends events.EventEmitter {
        private constructor();
        addTrailers(trailers: OutgoingHttpHeaders): void;
        connection: net.Socket | tls.TLSSocket;
        end(callback?: () => void): void;
        end(data?: string | Buffer, callback?: () => void): void;
        end(data?: string | Buffer, encoding?: string, callback?: () => void): void;
        readonly finished: boolean;
        getHeader(name: string): string;
        getHeaderNames(): string[];
        getHeaders(): OutgoingHttpHeaders;
        hasHeader(name: string): boolean;
        readonly headersSent: boolean;
        removeHeader(name: string): void;
        sendDate: boolean;
        setHeader(name: string, value: number | string | string[]): void;
        setTimeout(msecs: number, callback?: () => void): void;
        socket: net.Socket | tls.TLSSocket;
        statusCode: number;
        statusMessage: '';
        stream: ServerHttp2Stream;
        write(chunk: string | Buffer, callback?: (err: Error) => void): boolean;
        write(chunk: string | Buffer, encoding?: string, callback?: (err: Error) => void): boolean;
        writeContinue(): void;
        writeHead(statusCode: number, headers?: OutgoingHttpHeaders): void;
        writeHead(statusCode: number, statusMessage?: string, headers?: OutgoingHttpHeaders): void;
        createPushResponse(headers: OutgoingHttpHeaders, callback: (err: Error | null, res: Http2ServerResponse) => void): void;

        addListener(event: string, listener: (...args: any[]) => void): this;
        addListener(event: "aborted", listener: (hadError: boolean, code: number) => void): this;
        addListener(event: "close", listener: () => void): this;
        addListener(event: "drain", listener: () => void): this;
        addListener(event: "error", listener: (error: Error) => void): this;
        addListener(event: "finish", listener: () => void): this;

        emit(event: string | symbol, ...args: any[]): boolean;
        emit(event: "aborted", hadError: boolean, code: number): boolean;
        emit(event: "close"): boolean;
        emit(event: "drain"): boolean;
        emit(event: "error", error: Error): boolean;
        emit(event: "finish"): boolean;

        on(event: string, listener: (...args: any[]) => void): this;
        on(event: "aborted", listener: (hadError: boolean, code: number) => void): this;
        on(event: "close", listener: () => void): this;
        on(event: "drain", listener: () => void): this;
        on(event: "error", listener: (error: Error) => void): this;
        on(event: "finish", listener: () => void): this;

        once(event: string, listener: (...args: any[]) => void): this;
        once(event: "aborted", listener: (hadError: boolean, code: number) => void): this;
        once(event: "close", listener: () => void): this;
        once(event: "drain", listener: () => void): this;
        once(event: "error", listener: (error: Error) => void): this;
        once(event: "finish", listener: () => void): this;

        prependListener(event: string, listener: (...args: any[]) => void): this;
        prependListener(event: "aborted", listener: (hadError: boolean, code: number) => void): this;
        prependListener(event: "close", listener: () => void): this;
        prependListener(event: "drain", listener: () => void): this;
        prependListener(event: "error", listener: (error: Error) => void): this;
        prependListener(event: "finish", listener: () => void): this;

        prependOnceListener(event: string, listener: (...args: any[]) => void): this;
        prependOnceListener(event: "aborted", listener: (hadError: boolean, code: number) => void): this;
        prependOnceListener(event: "close", listener: () => void): this;
        prependOnceListener(event: "drain", listener: () => void): this;
        prependOnceListener(event: "error", listener: (error: Error) => void): this;
        prependOnceListener(event: "finish", listener: () => void): this;
    }

    // Public API

    export namespace constants {
        const NGHTTP2_SESSION_SERVER: number;
        const NGHTTP2_SESSION_CLIENT: number;
        const NGHTTP2_STREAM_STATE_IDLE: number;
        const NGHTTP2_STREAM_STATE_OPEN: number;
        const NGHTTP2_STREAM_STATE_RESERVED_LOCAL: number;
        const NGHTTP2_STREAM_STATE_RESERVED_REMOTE: number;
        const NGHTTP2_STREAM_STATE_HALF_CLOSED_LOCAL: number;
        const NGHTTP2_STREAM_STATE_HALF_CLOSED_REMOTE: number;
        const NGHTTP2_STREAM_STATE_CLOSED: number;
        const NGHTTP2_NO_ERROR: number;
        const NGHTTP2_PROTOCOL_ERROR: number;
        const NGHTTP2_INTERNAL_ERROR: number;
        const NGHTTP2_FLOW_CONTROL_ERROR: number;
        const NGHTTP2_SETTINGS_TIMEOUT: number;
        const NGHTTP2_STREAM_CLOSED: number;
        const NGHTTP2_FRAME_SIZE_ERROR: number;
        const NGHTTP2_REFUSED_STREAM: number;
        const NGHTTP2_CANCEL: number;
        const NGHTTP2_COMPRESSION_ERROR: number;
        const NGHTTP2_CONNECT_ERROR: number;
        const NGHTTP2_ENHANCE_YOUR_CALM: number;
        const NGHTTP2_INADEQUATE_SECURITY: number;
        const NGHTTP2_HTTP_1_1_REQUIRED: number;
        const NGHTTP2_ERR_FRAME_SIZE_ERROR: number;
        const NGHTTP2_FLAG_NONE: number;
        const NGHTTP2_FLAG_END_STREAM: number;
        const NGHTTP2_FLAG_END_HEADERS: number;
        const NGHTTP2_FLAG_ACK: number;
        const NGHTTP2_FLAG_PADDED: number;
        const NGHTTP2_FLAG_PRIORITY: number;
        const DEFAULT_SETTINGS_HEADER_TABLE_SIZE: number;
        const DEFAULT_SETTINGS_ENABLE_PUSH: number;
        const DEFAULT_SETTINGS_INITIAL_WINDOW_SIZE: number;
        const DEFAULT_SETTINGS_MAX_FRAME_SIZE: number;
        const MAX_MAX_FRAME_SIZE: number;
        const MIN_MAX_FRAME_SIZE: number;
        const MAX_INITIAL_WINDOW_SIZE: number;
        const NGHTTP2_DEFAULT_WEIGHT: number;
        const NGHTTP2_SETTINGS_HEADER_TABLE_SIZE: number;
        const NGHTTP2_SETTINGS_ENABLE_PUSH: number;
        const NGHTTP2_SETTINGS_MAX_CONCURRENT_STREAMS: number;
        const NGHTTP2_SETTINGS_INITIAL_WINDOW_SIZE: number;
        const NGHTTP2_SETTINGS_MAX_FRAME_SIZE: number;
        const NGHTTP2_SETTINGS_MAX_HEADER_LIST_SIZE: number;
        const PADDING_STRATEGY_NONE: number;
        const PADDING_STRATEGY_MAX: number;
        const PADDING_STRATEGY_CALLBACK: number;
        const HTTP2_HEADER_STATUS: string;
        const HTTP2_HEADER_METHOD: string;
        const HTTP2_HEADER_AUTHORITY: string;
        const HTTP2_HEADER_SCHEME: string;
        const HTTP2_HEADER_PATH: string;
        const HTTP2_HEADER_ACCEPT_CHARSET: string;
        const HTTP2_HEADER_ACCEPT_ENCODING: string;
        const HTTP2_HEADER_ACCEPT_LANGUAGE: string;
        const HTTP2_HEADER_ACCEPT_RANGES: string;
        const HTTP2_HEADER_ACCEPT: string;
        const HTTP2_HEADER_ACCESS_CONTROL_ALLOW_ORIGIN: string;
        const HTTP2_HEADER_AGE: string;
        const HTTP2_HEADER_ALLOW: string;
        const HTTP2_HEADER_AUTHORIZATION: string;
        const HTTP2_HEADER_CACHE_CONTROL: string;
        const HTTP2_HEADER_CONNECTION: string;
        const HTTP2_HEADER_CONTENT_DISPOSITION: string;
        const HTTP2_HEADER_CONTENT_ENCODING: string;
        const HTTP2_HEADER_CONTENT_LANGUAGE: string;
        const HTTP2_HEADER_CONTENT_LENGTH: string;
        const HTTP2_HEADER_CONTENT_LOCATION: string;
        const HTTP2_HEADER_CONTENT_MD5: string;
        const HTTP2_HEADER_CONTENT_RANGE: string;
        const HTTP2_HEADER_CONTENT_TYPE: string;
        const HTTP2_HEADER_COOKIE: string;
        const HTTP2_HEADER_DATE: string;
        const HTTP2_HEADER_ETAG: string;
        const HTTP2_HEADER_EXPECT: string;
        const HTTP2_HEADER_EXPIRES: string;
        const HTTP2_HEADER_FROM: string;
        const HTTP2_HEADER_HOST: string;
        const HTTP2_HEADER_IF_MATCH: string;
        const HTTP2_HEADER_IF_MODIFIED_SINCE: string;
        const HTTP2_HEADER_IF_NONE_MATCH: string;
        const HTTP2_HEADER_IF_RANGE: string;
        const HTTP2_HEADER_IF_UNMODIFIED_SINCE: string;
        const HTTP2_HEADER_LAST_MODIFIED: string;
        const HTTP2_HEADER_LINK: string;
        const HTTP2_HEADER_LOCATION: string;
        const HTTP2_HEADER_MAX_FORWARDS: string;
        const HTTP2_HEADER_PREFER: string;
        const HTTP2_HEADER_PROXY_AUTHENTICATE: string;
        const HTTP2_HEADER_PROXY_AUTHORIZATION: string;
        const HTTP2_HEADER_RANGE: string;
        const HTTP2_HEADER_REFERER: string;
        const HTTP2_HEADER_REFRESH: string;
        const HTTP2_HEADER_RETRY_AFTER: string;
        const HTTP2_HEADER_SERVER: string;
        const HTTP2_HEADER_SET_COOKIE: string;
        const HTTP2_HEADER_STRICT_TRANSPORT_SECURITY: string;
        const HTTP2_HEADER_TRANSFER_ENCODING: string;
        const HTTP2_HEADER_TE: string;
        const HTTP2_HEADER_UPGRADE: string;
        const HTTP2_HEADER_USER_AGENT: string;
        const HTTP2_HEADER_VARY: string;
        const HTTP2_HEADER_VIA: string;
        const HTTP2_HEADER_WWW_AUTHENTICATE: string;
        const HTTP2_HEADER_HTTP2_SETTINGS: string;
        const HTTP2_HEADER_KEEP_ALIVE: string;
        const HTTP2_HEADER_PROXY_CONNECTION: string;
        const HTTP2_METHOD_ACL: string;
        const HTTP2_METHOD_BASELINE_CONTROL: string;
        const HTTP2_METHOD_BIND: string;
        const HTTP2_METHOD_CHECKIN: string;
        const HTTP2_METHOD_CHECKOUT: string;
        const HTTP2_METHOD_CONNECT: string;
        const HTTP2_METHOD_COPY: string;
        const HTTP2_METHOD_DELETE: string;
        const HTTP2_METHOD_GET: string;
        const HTTP2_METHOD_HEAD: string;
        const HTTP2_METHOD_LABEL: string;
        const HTTP2_METHOD_LINK: string;
        const HTTP2_METHOD_LOCK: string;
        const HTTP2_METHOD_MERGE: string;
        const HTTP2_METHOD_MKACTIVITY: string;
        const HTTP2_METHOD_MKCALENDAR: string;
        const HTTP2_METHOD_MKCOL: string;
        const HTTP2_METHOD_MKREDIRECTREF: string;
        const HTTP2_METHOD_MKWORKSPACE: string;
        const HTTP2_METHOD_MOVE: string;
        const HTTP2_METHOD_OPTIONS: string;
        const HTTP2_METHOD_ORDERPATCH: string;
        const HTTP2_METHOD_PATCH: string;
        const HTTP2_METHOD_POST: string;
        const HTTP2_METHOD_PRI: string;
        const HTTP2_METHOD_PROPFIND: string;
        const HTTP2_METHOD_PROPPATCH: string;
        const HTTP2_METHOD_PUT: string;
        const HTTP2_METHOD_REBIND: string;
        const HTTP2_METHOD_REPORT: string;
        const HTTP2_METHOD_SEARCH: string;
        const HTTP2_METHOD_TRACE: string;
        const HTTP2_METHOD_UNBIND: string;
        const HTTP2_METHOD_UNCHECKOUT: string;
        const HTTP2_METHOD_UNLINK: string;
        const HTTP2_METHOD_UNLOCK: string;
        const HTTP2_METHOD_UPDATE: string;
        const HTTP2_METHOD_UPDATEREDIRECTREF: string;
        const HTTP2_METHOD_VERSION_CONTROL: string;
        const HTTP_STATUS_CONTINUE: number;
        const HTTP_STATUS_SWITCHING_PROTOCOLS: number;
        const HTTP_STATUS_PROCESSING: number;
        const HTTP_STATUS_OK: number;
        const HTTP_STATUS_CREATED: number;
        const HTTP_STATUS_ACCEPTED: number;
        const HTTP_STATUS_NON_AUTHORITATIVE_INFORMATION: number;
        const HTTP_STATUS_NO_CONTENT: number;
        const HTTP_STATUS_RESET_CONTENT: number;
        const HTTP_STATUS_PARTIAL_CONTENT: number;
        const HTTP_STATUS_MULTI_STATUS: number;
        const HTTP_STATUS_ALREADY_REPORTED: number;
        const HTTP_STATUS_IM_USED: number;
        const HTTP_STATUS_MULTIPLE_CHOICES: number;
        const HTTP_STATUS_MOVED_PERMANENTLY: number;
        const HTTP_STATUS_FOUND: number;
        const HTTP_STATUS_SEE_OTHER: number;
        const HTTP_STATUS_NOT_MODIFIED: number;
        const HTTP_STATUS_USE_PROXY: number;
        const HTTP_STATUS_TEMPORARY_REDIRECT: number;
        const HTTP_STATUS_PERMANENT_REDIRECT: number;
        const HTTP_STATUS_BAD_REQUEST: number;
        const HTTP_STATUS_UNAUTHORIZED: number;
        const HTTP_STATUS_PAYMENT_REQUIRED: number;
        const HTTP_STATUS_FORBIDDEN: number;
        const HTTP_STATUS_NOT_FOUND: number;
        const HTTP_STATUS_METHOD_NOT_ALLOWED: number;
        const HTTP_STATUS_NOT_ACCEPTABLE: number;
        const HTTP_STATUS_PROXY_AUTHENTICATION_REQUIRED: number;
        const HTTP_STATUS_REQUEST_TIMEOUT: number;
        const HTTP_STATUS_CONFLICT: number;
        const HTTP_STATUS_GONE: number;
        const HTTP_STATUS_LENGTH_REQUIRED: number;
        const HTTP_STATUS_PRECONDITION_FAILED: number;
        const HTTP_STATUS_PAYLOAD_TOO_LARGE: number;
        const HTTP_STATUS_URI_TOO_LONG: number;
        const HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE: number;
        const HTTP_STATUS_RANGE_NOT_SATISFIABLE: number;
        const HTTP_STATUS_EXPECTATION_FAILED: number;
        const HTTP_STATUS_TEAPOT: number;
        const HTTP_STATUS_MISDIRECTED_REQUEST: number;
        const HTTP_STATUS_UNPROCESSABLE_ENTITY: number;
        const HTTP_STATUS_LOCKED: number;
        const HTTP_STATUS_FAILED_DEPENDENCY: number;
        const HTTP_STATUS_UNORDERED_COLLECTION: number;
        const HTTP_STATUS_UPGRADE_REQUIRED: number;
        const HTTP_STATUS_PRECONDITION_REQUIRED: number;
        const HTTP_STATUS_TOO_MANY_REQUESTS: number;
        const HTTP_STATUS_REQUEST_HEADER_FIELDS_TOO_LARGE: number;
        const HTTP_STATUS_UNAVAILABLE_FOR_LEGAL_REASONS: number;
        const HTTP_STATUS_INTERNAL_SERVER_ERROR: number;
        const HTTP_STATUS_NOT_IMPLEMENTED: number;
        const HTTP_STATUS_BAD_GATEWAY: number;
        const HTTP_STATUS_SERVICE_UNAVAILABLE: number;
        const HTTP_STATUS_GATEWAY_TIMEOUT: number;
        const HTTP_STATUS_HTTP_VERSION_NOT_SUPPORTED: number;
        const HTTP_STATUS_VARIANT_ALSO_NEGOTIATES: number;
        const HTTP_STATUS_INSUFFICIENT_STORAGE: number;
        const HTTP_STATUS_LOOP_DETECTED: number;
        const HTTP_STATUS_BANDWIDTH_LIMIT_EXCEEDED: number;
        const HTTP_STATUS_NOT_EXTENDED: number;
        const HTTP_STATUS_NETWORK_AUTHENTICATION_REQUIRED: number;
    }

    export function getDefaultSettings(): Settings;
    export function getPackedSettings(settings: Settings): Settings;
    export function getUnpackedSettings(buf: Buffer | Uint8Array): Settings;

    export function createServer(onRequestHandler?: (request: Http2ServerRequest, response: Http2ServerResponse) => void): Http2Server;
    export function createServer(options: ServerOptions, onRequestHandler?: (request: Http2ServerRequest, response: Http2ServerResponse) => void): Http2Server;

    export function createSecureServer(onRequestHandler?: (request: Http2ServerRequest, response: Http2ServerResponse) => void): Http2SecureServer;
    export function createSecureServer(options: SecureServerOptions, onRequestHandler?: (request: Http2ServerRequest, response: Http2ServerResponse) => void): Http2SecureServer;

    export function connect(authority: string | url.URL, listener?: (session: ClientHttp2Session, socket: net.Socket | tls.TLSSocket) => void): ClientHttp2Session;
    export function connect(
        authority: string | url.URL,
        options?: ClientSessionOptions | SecureClientSessionOptions,
        listener?: (session: ClientHttp2Session, socket: net.Socket | tls.TLSSocket) => void,
    ): ClientHttp2Session;
}

declare module "perf_hooks" {
    import { AsyncResource } from "async_hooks";

    interface PerformanceEntry {
        /**
         * The total number of milliseconds elapsed for this entry.
         * This value will not be meaningful for all Performance Entry types.
         */
        readonly duration: number;

        /**
         * The name of the performance entry.
         */
        readonly name: string;

        /**
         * The high resolution millisecond timestamp marking the starting time of the Performance Entry.
         */
        readonly startTime: number;

        /**
         * The type of the performance entry.
         * Currently it may be one of: 'node', 'mark', 'measure', 'gc', or 'function'.
         */
        readonly entryType: string;

        /**
         * When performanceEntry.entryType is equal to 'gc', the performance.kind property identifies
         * the type of garbage collection operation that occurred.
         * The value may be one of perf_hooks.constants.
         */
        readonly kind?: number;
    }

    interface PerformanceNodeTiming extends PerformanceEntry {
        /**
         * The high resolution millisecond timestamp at which the Node.js process completed bootstrap.
         */
        readonly bootstrapComplete: number;

        /**
         * The high resolution millisecond timestamp at which cluster processing ended.
         */
        readonly clusterSetupEnd: number;

        /**
         * The high resolution millisecond timestamp at which cluster processing started.
         */
        readonly clusterSetupStart: number;

        /**
         * The high resolution millisecond timestamp at which the Node.js event loop exited.
         */
        readonly loopExit: number;

        /**
         * The high resolution millisecond timestamp at which the Node.js event loop started.
         */
        readonly loopStart: number;

        /**
         * The high resolution millisecond timestamp at which main module load ended.
         */
        readonly moduleLoadEnd: number;

        /**
         * The high resolution millisecond timestamp at which main module load started.
         */
        readonly moduleLoadStart: number;

        /**
         * The high resolution millisecond timestamp at which the Node.js process was initialized.
         */
        readonly nodeStart: number;

        /**
         * The high resolution millisecond timestamp at which preload module load ended.
         */
        readonly preloadModuleLoadEnd: number;

        /**
         * The high resolution millisecond timestamp at which preload module load started.
         */
        readonly preloadModuleLoadStart: number;

        /**
         * The high resolution millisecond timestamp at which third_party_main processing ended.
         */
        readonly thirdPartyMainEnd: number;

        /**
         * The high resolution millisecond timestamp at which third_party_main processing started.
         */
        readonly thirdPartyMainStart: number;

        /**
         * The high resolution millisecond timestamp at which the V8 platform was initialized.
         */
        readonly v8Start: number;
    }

    interface Performance {
        /**
         * If name is not provided, removes all PerformanceFunction objects from the Performance Timeline.
         * If name is provided, removes entries with name.
         * @param name
         */
        clearFunctions(name?: string): void;

        /**
         * If name is not provided, removes all PerformanceMark objects from the Performance Timeline.
         * If name is provided, removes only the named mark.
         * @param name
         */
        clearMarks(name?: string): void;

        /**
         * If name is not provided, removes all PerformanceMeasure objects from the Performance Timeline.
         * If name is provided, removes only objects whose performanceEntry.name matches name.
         */
        clearMeasures(name?: string): void;

        /**
         * Returns a list of all PerformanceEntry objects in chronological order with respect to performanceEntry.startTime.
         * @return list of all PerformanceEntry objects
         */
        getEntries(): PerformanceEntry[];

        /**
         * Returns a list of all PerformanceEntry objects in chronological order with respect to performanceEntry.startTime
         * whose performanceEntry.name is equal to name, and optionally, whose performanceEntry.entryType is equal to type.
         * @param name
         * @param type
         * @return list of all PerformanceEntry objects
         */
        getEntriesByName(name: string, type?: string): PerformanceEntry[];

        /**
         * Returns a list of all PerformanceEntry objects in chronological order with respect to performanceEntry.startTime
         * whose performanceEntry.entryType is equal to type.
         * @param type
         * @return list of all PerformanceEntry objects
         */
        getEntriesByType(type: string): PerformanceEntry[];

        /**
         * Creates a new PerformanceMark entry in the Performance Timeline.
         * A PerformanceMark is a subclass of PerformanceEntry whose performanceEntry.entryType is always 'mark',
         * and whose performanceEntry.duration is always 0.
         * Performance marks are used to mark specific significant moments in the Performance Timeline.
         * @param name
         */
        mark(name?: string): void;

        /**
         * Creates a new PerformanceMeasure entry in the Performance Timeline.
         * A PerformanceMeasure is a subclass of PerformanceEntry whose performanceEntry.entryType is always 'measure',
         * and whose performanceEntry.duration measures the number of milliseconds elapsed since startMark and endMark.
         *
         * The startMark argument may identify any existing PerformanceMark in the the Performance Timeline, or may identify
         * any of the timestamp properties provided by the PerformanceNodeTiming class. If the named startMark does not exist,
         * then startMark is set to timeOrigin by default.
         *
         * The endMark argument must identify any existing PerformanceMark in the the Performance Timeline or any of the timestamp
         * properties provided by the PerformanceNodeTiming class. If the named endMark does not exist, an error will be thrown.
         * @param name
         * @param startMark
         * @param endMark
         */
        measure(name: string, startMark: string, endMark: string): void;

        /**
         * An instance of the PerformanceNodeTiming class that provides performance metrics for specific Node.js operational milestones.
         */
        readonly nodeTiming: PerformanceNodeTiming;

        /**
         * @return the current high resolution millisecond timestamp
         */
        now(): number;

        /**
         * The timeOrigin specifies the high resolution millisecond timestamp from which all performance metric durations are measured.
         */
        readonly timeOrigin: number;

        /**
         * Wraps a function within a new function that measures the running time of the wrapped function.
         * A PerformanceObserver must be subscribed to the 'function' event type in order for the timing details to be accessed.
         * @param fn
         */
        timerify<T extends (...optionalParams: any[]) => any>(fn: T): T;
    }

    interface PerformanceObserverEntryList {
        /**
         * @return a list of PerformanceEntry objects in chronological order with respect to performanceEntry.startTime.
         */
        getEntries(): PerformanceEntry[];

        /**
         * @return a list of PerformanceEntry objects in chronological order with respect to performanceEntry.startTime
         * whose performanceEntry.name is equal to name, and optionally, whose performanceEntry.entryType is equal to type.
         */
        getEntriesByName(name: string, type?: string): PerformanceEntry[];

        /**
         * @return Returns a list of PerformanceEntry objects in chronological order with respect to performanceEntry.startTime
         * whose performanceEntry.entryType is equal to type.
         */
        getEntriesByType(type: string): PerformanceEntry[];
    }

    type PerformanceObserverCallback = (list: PerformanceObserverEntryList, observer: PerformanceObserver) => void;

    class PerformanceObserver extends AsyncResource {
        constructor(callback: PerformanceObserverCallback);

        /**
         * Disconnects the PerformanceObserver instance from all notifications.
         */
        disconnect(): void;

        /**
         * Subscribes the PerformanceObserver instance to notifications of new PerformanceEntry instances identified by options.entryTypes.
         * When options.buffered is false, the callback will be invoked once for every PerformanceEntry instance.
         * Property buffered defaults to false.
         * @param options
         */
        observe(options: { entryTypes: string[], buffered?: boolean }): void;
    }

    namespace constants {
        const NODE_PERFORMANCE_GC_MAJOR: number;
        const NODE_PERFORMANCE_GC_MINOR: number;
        const NODE_PERFORMANCE_GC_INCREMENTAL: number;
        const NODE_PERFORMANCE_GC_WEAKCB: number;
    }

    const performance: Performance;
}

declare module "trace_events" {
    /**
     * The `Tracing` object is used to enable or disable tracing for sets of
     * categories. Instances are created using the
     * `trace_events.createTracing()` method.
     *
     * When created, the `Tracing` object is disabled. Calling the
     * `tracing.enable()` method adds the categories to the set of enabled trace
     * event categories. Calling `tracing.disable()` will remove the categories
     * from the set of enabled trace event categories.
     */
    export interface Tracing {
        /**
         * A comma-separated list of the trace event categories covered by this
         * `Tracing` object.
         */
        readonly categories: string;

        /**
         * Disables this `Tracing` object.
         *
         * Only trace event categories _not_ covered by other enabled `Tracing`
         * objects and _not_ specified by the `--trace-event-categories` flag
         * will be disabled.
         */
        disable(): void;

        /**
         * Enables this `Tracing` object for the set of categories covered by
         * the `Tracing` object.
         */
        enable(): void;

        /**
         * `true` only if the `Tracing` object has been enabled.
         */
        readonly enabled: boolean;
    }

    interface CreateTracingOptions {
        /**
         * An array of trace category names. Values included in the array are
         * coerced to a string when possible. An error will be thrown if the
         * value cannot be coerced.
         */
        categories: string[];
    }

    /**
     * Creates and returns a Tracing object for the given set of categories.
     */
    export function createTracing(options: CreateTracingOptions): Tracing;

    /**
     * Returns a comma-separated list of all currently-enabled trace event
     * categories. The current set of enabled trace event categories is
     * determined by the union of all currently-enabled `Tracing` objects and
     * any categories enabled using the `--trace-event-categories` flag.
     */
    export function getEnabledCategories(): string;
}
