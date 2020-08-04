// Type definitions for yargs 12.0
// Project: https://github.com/chevex/yargs, https://yargs.js.org
// Definitions by: Martin Poelstra <https://github.com/poelstra>
//                 Mizunashi Mana <https://github.com/mizunashi-mana>
//                 Jeffery Grajkowski <https://github.com/pushplay>
//                 Jeff Kenney <https://github.com/jeffkenney>
//                 Jimi (Dimitris) Charalampidis <https://github.com/JimiC>
//                 Steffen Viken Valvåg <https://github.com/steffenvv>
//                 Emily Marigold Klassen <https://github.com/forivall>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 3.0

// The following TSLint rules have been disabled:
// unified-signatures: Because there is useful information in the argument names of the overloaded signatures

// Convention:
// Use 'union types' when:
//  - parameter types have similar signature type (i.e. 'string | ReadonlyArray<string>')
//  - parameter names have the same semantic meaning (i.e. ['command', 'commands'] , ['key', 'keys'])
//    An example for not using 'union types' is the declaration of 'env' where `prefix` and `enable` parameters
//    have different semantics. On the other hand, in the declaration of 'usage', a `command: string` parameter
//    has the same semantic meaning with declaring an overload method by using `commands: ReadonlyArray<string>`,
//    thus it's preferred to use `command: string | ReadonlyArray<string>`
// Use parameterless declaration instead of declaring all parameters optional,
// when all parameters are optional and more than one

declare namespace yargs {
    // The type parameter T is the expected shape of the parsed options.
    // Arguments<T> is those options plus _ and $0, and an indexer falling
    // back to unknown for unknown options.
    //
    // For the return type / argv property, we create a mapped type over
    // Arguments<T> to simplify the inferred type signature in client code.
    interface Argv<T = {}> {
        (): { [key in keyof Arguments<T>]: Arguments<T>[key] };
        (args: ReadonlyArray<string>, cwd?: string): Argv<T>;

        // Aliases for previously declared options can inherit the types of those options.
        alias<K1 extends keyof T, K2 extends string>(shortName: K1, longName: K2 | ReadonlyArray<K2>): Argv<T & { [key in K2]: T[K1] }>;
        alias<K1 extends keyof T, K2 extends string>(shortName: K2, longName: K1 | ReadonlyArray<K1>): Argv<T & { [key in K2]: T[K1] }>;
        alias(shortName: string | ReadonlyArray<string>, longName: string | ReadonlyArray<string>): Argv<T>;
        alias(aliases: { [shortName: string]: string | ReadonlyArray<string> }): Argv<T>;

        argv: { [key in keyof Arguments<T>]: Arguments<T>[key] };

        array<K extends keyof T>(key: K | ReadonlyArray<K>): Argv<Omit<T, K> & { [key in K]: ToArray<T[key]> }>;
        array<K extends string>(key: K | ReadonlyArray<K>): Argv<T & { [key in K]: Array<string | number> | undefined }>;

        boolean<K extends keyof T>(key: K | ReadonlyArray<K>): Argv<Omit<T, K> & { [key in K]: boolean | undefined }>;
        boolean<K extends string>(key: K | ReadonlyArray<K>): Argv<T & { [key in K]: boolean | undefined }>;

        check(func: (argv: Arguments<T>, aliases: { [alias: string]: string }) => any, global?: boolean): Argv<T>;

        choices<K extends keyof T, C extends ReadonlyArray<any>>(key: K, values: C): Argv<Omit<T, K> & { [key in K]: C[number] | undefined }>;
        choices<K extends string, C extends ReadonlyArray<any>>(key: K, values: C): Argv<T & { [key in K]: C[number] | undefined }>;
        choices<C extends { [key: string]: ReadonlyArray<any> }>(choices: C): Argv<Omit<T, keyof C> & { [key in keyof C]: C[key][number] | undefined }>;

        coerce<K extends keyof T, V>(key: K | ReadonlyArray<K>, func: (arg: any) => V): Argv<Omit<T, K> & { [key in K]: V | undefined }>;
        coerce<K extends string, V>(key: K | ReadonlyArray<K>, func: (arg: any) => V): Argv<T & { [key in K]: V | undefined }>;
        coerce<O extends { [key: string]: (arg: any) => any }>(opts: O): Argv<Omit<T, keyof O> & { [key in keyof O]: ReturnType<O[key]> | undefined }>;

        command<U>(command: string | ReadonlyArray<string>, description: string, builder?: (args: Argv<T>) => Argv<U>, handler?: (args: Arguments<U>) => void): Argv<T>;
        command<O extends { [key: string]: Options }>(command: string | ReadonlyArray<string>, description: string, builder?: O, handler?: (args: Arguments<InferredOptionTypes<O>>) => void): Argv<T>;
        command<U>(command: string | ReadonlyArray<string>, description: string, module: CommandModule<T, U>): Argv<U>;
        command<U>(command: string | ReadonlyArray<string>, showInHelp: false, builder?: (args: Argv<T>) => Argv<U>, handler?: (args: Arguments<U>) => void): Argv<T>;
        command<O extends { [key: string]: Options }>(command: string | ReadonlyArray<string>, showInHelp: false, builder?: O, handler?: (args: Arguments<InferredOptionTypes<O>>) => void): Argv<T>;
        command<U>(command: string | ReadonlyArray<string>, showInHelp: false, module: CommandModule<T, U>): Argv<U>;
        command<U>(module: CommandModule<T, U>): Argv<U>;

        // Advanced API
        commandDir(dir: string, opts?: RequireDirectoryOptions): Argv<T>;

        completion(): Argv<T>;
        completion(cmd: string, func?: AsyncCompletionFunction): Argv<T>;
        completion(cmd: string, func?: SyncCompletionFunction): Argv<T>;
        completion(cmd: string, description?: string, func?: AsyncCompletionFunction): Argv<T>;
        completion(cmd: string, description?: string, func?: SyncCompletionFunction): Argv<T>;

        config(): Argv<T>;
        config(key: string | ReadonlyArray<string>, description?: string, parseFn?: (configPath: string) => object): Argv<T>;
        config(key: string | ReadonlyArray<string>, parseFn: (configPath: string) => object): Argv<T>;
        config(explicitConfigurationObject: object): Argv<T>;

        conflicts(key: string, value: string | ReadonlyArray<string>): Argv<T>;
        conflicts(conflicts: { [key: string]: string | ReadonlyArray<string> }): Argv<T>;

        count<K extends keyof T>(key: K | ReadonlyArray<K>): Argv<Omit<T, K> & { [key in K]: number }>;
        count<K extends string>(key: K | ReadonlyArray<K>): Argv<T & { [key in K]: number }>;

        default<K extends keyof T, V>(key: K, value: V, description?: string): Argv<Omit<T, K> & { [key in K]: V }>;
        default<K extends string, V>(key: K, value: V, description?: string): Argv<T & { [key in K]: V }>;
        default<D extends { [key: string]: any }>(defaults: D, description?: string): Argv<Omit<T, keyof D> & D>;

        /**
         * @deprecated since version 6.6.0
         * Use '.demandCommand()' or '.demandOption()' instead
         */
        demand<K extends keyof T>(key: K | ReadonlyArray<K>, msg?: string | true): Argv<Defined<T, K>>;
        demand<K extends string>(key: K | ReadonlyArray<K>, msg?: string | true): Argv<T & { [key in K]: unknown }>;
        demand(key: string | ReadonlyArray<string>, required?: boolean): Argv<T>;
        demand(positionals: number, msg: string): Argv<T>;
        demand(positionals: number, required?: boolean): Argv<T>;
        demand(positionals: number, max: number, msg?: string): Argv<T>;

        demandOption<K extends keyof T>(key: K | ReadonlyArray<K>, msg?: string | true): Argv<Defined<T, K>>;
        demandOption<K extends string>(key: K | ReadonlyArray<K>, msg?: string | true): Argv<T & { [key in K]: unknown }>;
        demandOption(key: string | ReadonlyArray<string>, demand?: boolean): Argv<T>;

        demandCommand(): Argv<T>;
        demandCommand(min: number, minMsg?: string): Argv<T>;
        demandCommand(min: number, max?: number, minMsg?: string, maxMsg?: string): Argv<T>;

        describe(key: string | ReadonlyArray<string>, description: string): Argv<T>;
        describe(descriptions: { [key: string]: string }): Argv<T>;

        detectLocale(detect: boolean): Argv<T>;

        env(): Argv<T>;
        env(prefix: string): Argv<T>;
        env(enable: boolean): Argv<T>;

        epilog(msg: string): Argv<T>;

        epilogue(msg: string): Argv<T>;

        example(command: string, description: string): Argv<T>;

        exit(code: number, err: Error): void;

        exitProcess(enabled: boolean): Argv<T>;

        fail(func: (msg: string, err: Error) => any): Argv<T>;

        getCompletion(args: ReadonlyArray<string>, done: (completions: ReadonlyArray<string>) => void): Argv<T>;

        global(key: string | ReadonlyArray<string>): Argv<T>;

        group(key: string | ReadonlyArray<string>, groupName: string): Argv<T>;

        hide(key: string): Argv<T>;

        help(): Argv<T>;
        help(enableExplicit: boolean): Argv<T>;
        help(option: string, enableExplicit: boolean): Argv<T>;
        help(option: string, description?: string, enableExplicit?: boolean): Argv<T>;

        implies(key: string, value: string | ReadonlyArray<string>): Argv<T>;
        implies(implies: { [key: string]: string | ReadonlyArray<string> }): Argv<T>;

        locale(): string;
        locale(loc: string): Argv<T>;

        middleware(callbacks: MiddlewareFunction<T> | ReadonlyArray<MiddlewareFunction<T>>): Argv<T>;

        nargs(key: string, count: number): Argv<T>;
        nargs(nargs: { [key: string]: number }): Argv<T>;

        normalize<K extends keyof T>(key: K | ReadonlyArray<K>): Argv<Omit<T, K> & { [key in K]: ToString<T[key]> }>;
        normalize<K extends string>(key: K | ReadonlyArray<K>): Argv<T & { [key in K]: string | undefined }>;

        number<K extends keyof T>(key: K | ReadonlyArray<K>): Argv<Omit<T, K> & { [key in K]: ToNumber<T[key]> }>;
        number<K extends string>(key: K | ReadonlyArray<K>): Argv<T & { [key in K]: number | undefined }>;

        option<K extends keyof T, O extends Options>(key: K, options: O): Argv<Omit<T, K> & { [key in K]: InferredOptionType<O> }>;
        option<K extends string, O extends Options>(key: K, options: O): Argv<T & { [key in K]: InferredOptionType<O> }>;
        option<O extends { [key: string]: Options }>(options: O): Argv<Omit<T, keyof O> & InferredOptionTypes<O>>;

        options<K extends keyof T, O extends Options>(key: K, options: O): Argv<Omit<T, K> & { [key in K]: InferredOptionType<O> }>;
        options<K extends string, O extends Options>(key: K, options: O): Argv<T & { [key in K]: InferredOptionType<O> }>;
        options<O extends { [key: string]: Options }>(options: O): Argv<Omit<T, keyof O> & InferredOptionTypes<O>>;

        parse(): { [key in keyof Arguments<T>]: Arguments<T>[key] };
        parse(arg: string | ReadonlyArray<string>, context?: object, parseCallback?: ParseCallback<T>): { [key in keyof Arguments<T>]: Arguments<T>[key] };

        parsed: DetailedArguments | false;

        pkgConf(key: string | ReadonlyArray<string>, cwd?: string): Argv<T>;

        /**
         * 'positional' should be called in a command's builder function, and is not
         * available on the top-level yargs instance. If so, it will throw an error.
         */
        positional<K extends keyof T, O extends PositionalOptions>(key: K, opt: O): Argv<Omit<T, K> & { [key in K]: InferredOptionType<O> }>;
        positional<K extends string, O extends PositionalOptions>(key: K, opt: O): Argv<T & { [key in K]: InferredOptionType<O> }>;

        recommendCommands(): Argv<T>;

        /**
         * @deprecated since version 6.6.0
         * Use '.demandCommand()' or '.demandOption()' instead
         */
        require<K extends keyof T>(key: K | ReadonlyArray<K>, msg?: string | true): Argv<Defined<T, K>>;
        require(key: string, msg: string): Argv<T>;
        require(key: string, required: boolean): Argv<T>;
        require(keys: ReadonlyArray<number>, msg: string): Argv<T>;
        require(keys: ReadonlyArray<number>, required: boolean): Argv<T>;
        require(positionals: number, required: boolean): Argv<T>;
        require(positionals: number, msg: string): Argv<T>;

        /**
         * @deprecated since version 6.6.0
         * Use '.demandCommand()' or '.demandOption()' instead
         */
        required<K extends keyof T>(key: K | ReadonlyArray<K>, msg?: string | true): Argv<Defined<T, K>>;
        required(key: string, msg: string): Argv<T>;
        required(key: string, required: boolean): Argv<T>;
        required(keys: ReadonlyArray<number>, msg: string): Argv<T>;
        required(keys: ReadonlyArray<number>, required: boolean): Argv<T>;
        required(positionals: number, required: boolean): Argv<T>;
        required(positionals: number, msg: string): Argv<T>;

        requiresArg(key: string | ReadonlyArray<string>): Argv<T>;

        /**
         * @deprecated since version 6.6.0
         * Use '.global()' instead
         */
        reset(): Argv<T>;

        scriptName($0: string): Argv<T>;

        showCompletionScript(): Argv<T>;

        showHidden(option?: string | boolean): Argv<T>;
        showHidden(option: string, description?: string): Argv<T>;

        showHelp(consoleLevel?: string): Argv<T>;

        showHelpOnFail(enable: boolean, message?: string): Argv<T>;

        skipValidation(key: string | ReadonlyArray<string>): Argv<T>;

        strict(): Argv<T>;
        strict(enabled: boolean): Argv<T>;

        string<K extends keyof T>(key: K | ReadonlyArray<K>): Argv<Omit<T, K> & { [key in K]: ToString<T[key]> }>;
        string<K extends string>(key: K | ReadonlyArray<K>): Argv<T & { [key in K]: string | undefined }>;

        // Intended to be used with '.wrap()'
        terminalWidth(): number;

        updateLocale(obj: { [key: string]: string }): Argv<T>;

        updateStrings(obj: { [key: string]: string }): Argv<T>;

        usage(message: string): Argv<T>;
        usage<U>(command: string | ReadonlyArray<string>, description: string, builder?: (args: Argv<T>) => Argv<U>, handler?: (args: Arguments<U>) => void): Argv<T>;
        usage<U>(command: string | ReadonlyArray<string>, showInHelp: boolean, builder?: (args: Argv<T>) => Argv<U>, handler?: (args: Arguments<U>) => void): Argv<T>;
        usage<O extends { [key: string]: Options }>(command: string | ReadonlyArray<string>, description: string, builder?: O, handler?: (args: Arguments<InferredOptionTypes<O>>) => void): Argv<T>;
        usage<O extends { [key: string]: Options }>(command: string | ReadonlyArray<string>, showInHelp: boolean, builder?: O, handler?: (args: Arguments<InferredOptionTypes<O>>) => void): Argv<T>;

        version(): Argv<T>;
        version(version: string): Argv<T>;
        version(enable: boolean): Argv<T>;
        version(optionKey: string, version: string): Argv<T>;
        version(optionKey: string, description: string, version: string): Argv<T>;

        wrap(columns: number | null): Argv<T>;
    }

    type Arguments<T = {}> = T & {
        /** Non-option arguments */
        _: string[];
        /** The script name or node command */
        $0: string;
        /** All remaining options */
        [argName: string]: unknown;
    };

    interface DetailedArguments {
        argv: Arguments;
        error: Error | null;
        aliases: {[alias: string]: string[]};
        newAliases: {[alias: string]: boolean};
        configuration: Configuration;
    }

    interface Configuration {
        'boolean-negation': boolean;
        'camel-case-expansion': boolean;
        'combine-arrays': boolean;
        'dot-notation': boolean;
        'duplicate-arguments-array': boolean;
        'flatten-duplicate-arrays': boolean;
        'negation-prefix': string;
        'parse-numbers': boolean;
        'populate--': boolean;
        'set-placeholder-key': boolean;
        'short-option-groups': boolean;
    }

    interface RequireDirectoryOptions {
        recurse?: boolean;
        extensions?: ReadonlyArray<string>;
        visit?: (commandObject: any, pathToFile?: string, filename?: string) => any;
        include?: RegExp | ((pathToFile: string) => boolean);
        exclude?: RegExp | ((pathToFile: string) => boolean);
    }

    interface Options {
        alias?: string | ReadonlyArray<string>;
        array?: boolean;
        boolean?: boolean;
        choices?: Choices;
        coerce?: (arg: any) => any;
        config?: boolean;
        configParser?: (configPath: string) => object;
        conflicts?: string | ReadonlyArray<string> | { [key: string]: string | ReadonlyArray<string> };
        count?: boolean;
        default?: any;
        defaultDescription?: string;
        /**
         *  @deprecated since version 6.6.0
         *  Use 'demandOption' instead
         */
        demand?: boolean | string;
        demandOption?: boolean | string;
        desc?: string;
        describe?: string;
        description?: string;
        global?: boolean;
        group?: string;
        hidden?: boolean;
        implies?: string | ReadonlyArray<string> | { [key: string]: string | ReadonlyArray<string> };
        nargs?: number;
        normalize?: boolean;
        number?: boolean;
        /**
         *  @deprecated since version 6.6.0
         *  Use 'demandOption' instead
         */
        require?: boolean | string;
        /**
         *  @deprecated since version 6.6.0
         *  Use 'demandOption' instead
         */
        required?: boolean | string;
        requiresArg?: boolean;
        skipValidation?: boolean;
        string?: boolean;
        type?: "array" | "count" | PositionalOptionsType;
    }

    interface PositionalOptions {
        alias?: string | ReadonlyArray<string>;
        choices?: Choices;
        coerce?: (arg: any) => any;
        conflicts?: string | ReadonlyArray<string> | { [key: string]: string | ReadonlyArray<string> };
        default?: any;
        desc?: string;
        describe?: string;
        description?: string;
        implies?: string | ReadonlyArray<string> | { [key: string]: string | ReadonlyArray<string> };
        normalize?: boolean;
        type?: PositionalOptionsType;
    }

    /** Remove keys K in T */
    type Omit<T, K> = { [key in Exclude<keyof T, K>]: T[key] };

    /** Remove undefined as a possible value for keys K in T */
    type Defined<T, K extends keyof T> = Omit<T, K> & { [key in K]: Exclude<T[key], undefined> };

    /** Convert T to T[] and T | undefined to T[] | undefined */
    type ToArray<T> = Array<Exclude<T, undefined>> | Extract<T, undefined>;

    /** Gives string[] if T is an array type, otherwise string. Preserves | undefined. */
    type ToString<T> = (Exclude<T, undefined> extends any[] ? string[] : string) | Extract<T, undefined>;

    /** Gives number[] if T is an array type, otherwise number. Preserves | undefined. */
    type ToNumber<T> = (Exclude<T, undefined> extends any[] ? number[] : number) | Extract<T, undefined>;

    type InferredOptionType<O extends Options | PositionalOptions> =
        O extends { default: infer D } ? D :
        O extends { type: "count" } ? number :
        O extends { count: true } ? number :
        O extends { required: string | true } ? RequiredOptionType<O> :
        O extends { require: string | true } ? RequiredOptionType<O> :
        O extends { demand: string | true } ? RequiredOptionType<O> :
        O extends { demandOption: string | true } ? RequiredOptionType<O> :
        RequiredOptionType<O> | undefined;

    type RequiredOptionType<O extends Options | PositionalOptions> =
        O extends { type: "array", string: true } ? string[] :
        O extends { type: "array", number: true } ? number[] :
        O extends { type: "array", normalize: true } ? string[] :
        O extends { type: "string", array: true } ? string[] :
        O extends { type: "number", array: true } ? number[] :
        O extends { string: true, array: true } ? string[] :
        O extends { number: true, array: true } ? number[] :
        O extends { normalize: true, array: true } ? string[] :
        O extends { type: "array" } ? Array<string | number> :
        O extends { type: "boolean" } ? boolean :
        O extends { type: "number" } ? number :
        O extends { type: "string" } ? string :
        O extends { array: true } ? Array<string | number> :
        O extends { boolean: true } ? boolean :
        O extends { number: true } ? number :
        O extends { string: true } ? string :
        O extends { normalize: true } ? string :
        O extends { choices: ReadonlyArray<infer C> } ? C :
        O extends { coerce: (arg: any) => infer T } ? T :
        unknown;

    type InferredOptionTypes<O extends { [key: string]: Options }> = { [key in keyof O]: InferredOptionType<O[key]> };

    interface CommandModule<T = {}, U = {}> {
        aliases?: ReadonlyArray<string> | string;
        builder?: CommandBuilder<T, U>;
        command?: ReadonlyArray<string> | string;
        describe?: string | false;
        handler: (args: Arguments<U>) => void;
    }

    type ParseCallback<T = {}> = (err: Error | undefined, argv: Arguments<T>, output: string) => void;
    type CommandBuilder<T = {}, U = {}> = { [key: string]: Options } | ((args: Argv<T>) => Argv<U>);
    type SyncCompletionFunction = (current: string, argv: any) => string[];
    type AsyncCompletionFunction = (current: string, argv: any, done: (completion: ReadonlyArray<string>) => void) => void;
    type MiddlewareFunction<T = {}> = (args: Arguments<T>) => void;
    type Choices = ReadonlyArray<string | true | undefined>;
    type PositionalOptionsType = "boolean" | "number" | "string";
}

declare var yargs: yargs.Argv;
export = yargs;
