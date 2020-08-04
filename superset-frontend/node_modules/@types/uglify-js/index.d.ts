// Type definitions for UglifyJS 3.0
// Project: https://github.com/mishoo/UglifyJS2
// Definitions by: Alan Agius <https://github.com/alan-agius4>
//                 Tanguy Krotoff <https://github.com/tkrotoff>
//                 John Reilly <https://github.com/johnnyreilly>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.2

import { RawSourceMap } from 'source-map';
export interface ParseOptions {
    /** Support top level `return` statements */
    bare_returns?: boolean;
    html5_comments?: boolean;
    /** Support `#!command` as the first line */
    shebang?: boolean;
}

export interface CompressOptions {
    /** Replace `arguments[index]` with function parameter name whenever possible. */
    arguments?: boolean;
    /** Various optimizations for boolean context, for example `!!a ? b : c → a ? b : c` */
    booleans?: boolean;
    /** Collapse single-use non-constant variables, side effects permitting. */
    collapse_vars?: boolean;
    /** Apply certain optimizations to binary nodes, e.g. `!(a <= b) → a > b,` attempts to negate binary nodes, e.g. `a = !b && !c && !d && !e → a=!(b||c||d||e)` etc */
    comparisons?: boolean;
    /** Apply optimizations for `if-s` and conditional expressions. */
    conditionals?: boolean;
    /** Remove unreachable code */
    dead_code?: boolean;
    /**
     * Pass `true` to discard calls to console.* functions.
     * If you wish to drop a specific function call such as `console.info` and/or retain side effects from function
     * arguments after dropping the function call then use `pure_funcs` instead.
     */
    drop_console?: boolean;
    /** Remove `debugger;` statements */
    drop_debugger?: boolean;
    /** Attempt to evaluate constant expressions */
    evaluate?: boolean;
    /** Pass `true` to preserve completion values from terminal statements without `return`, e.g. in bookmarklets. */
    expression?: boolean;
    global_defs?: object;
    /** hoist function declarations */
    hoist_funs?: boolean;
    /**
     * Hoist properties from constant object and array literals into regular variables subject to a set of constraints.
     * For example: `var o={p:1, q:2}; f(o.p, o.q);` is converted to `f(1, 2);`. Note: `hoist_props` works best with mangle enabled,
     * the compress option passes set to 2 or higher, and the compress option toplevel enabled.
     */
    hoist_props?: boolean;
    /** Hoist var declarations (this is `false` by default because it seems to increase the size of the output in general) */
    hoist_vars?: boolean;
    /** Optimizations for if/return and if/continue */
    if_return?: boolean;
    /**
     * Inline calls to function with simple/return statement
     * - false -- same as `Disabled`
     * - `Disabled` -- disabled inlining
     * - `SimpleFunctions` -- inline simple functions
     * - `WithArguments` -- inline functions with arguments
     * - `WithArgumentsAndVariables` -- inline functions with arguments and variables
     * - true -- same as `WithArgumentsAndVariables`
     */
    inline?: boolean | InlineFunctions;
    /** join consecutive `var` statements */
    join_vars?: boolean;
    /** Prevents the compressor from discarding unused function arguments. You need this for code which relies on `Function.length` */
    keep_fargs?: boolean;
    /** Pass true to prevent the compressor from discarding function names. Useful for code relying on `Function.prototype.name`. */
    keep_fnames?: boolean;
    /** Pass true to prevent Infinity from being compressed into `1/0`, which may cause performance issues on `Chrome` */
    keep_infinity?: boolean;
    /** Optimizations for `do`, `while` and `for` loops when we can statically determine the condition. */
    loops?: boolean;
    /** negate `Immediately-Called Function Expressions` where the return value is discarded, to avoid the parens that the code generator would insert. */
    negate_iife?: boolean;
    /** The maximum number of times to run compress. In some cases more than one pass leads to further compressed code. Keep in mind more passes will take more time. */
    passes?: number;
    /** Rewrite property access using the dot notation, for example `foo["bar"]` to `foo.bar` */
    properties?: boolean;
    /**
     * An array of names and UglifyJS will assume that those functions do not produce side effects.
     * DANGER: will not check if the name is redefined in scope.
     * An example case here, for instance `var q = Math.floor(a/b)`.
     * If variable q is not used elsewhere, UglifyJS will drop it, but will still keep the `Math.floor(a/b)`,
     * not knowing what it does. You can pass `pure_funcs: [ 'Math.floor' ]` to let it know that this function
     * won't produce any side effect, in which case the whole statement would get discarded. The current
     * implementation adds some overhead (compression will be slower).
     */
    pure_funcs?: string[];
    pure_getters?: boolean | 'strict';
    /**
     * Allows single-use functions to be inlined as function expressions when permissible allowing further optimization.
     * Enabled by default. Option depends on reduce_vars being enabled. Some code runs faster in the Chrome V8 engine if
     * this option is disabled. Does not negatively impact other major browsers.
     */
    reduce_funcs?: boolean;
    /** Improve optimization on variables assigned with and used as constant values. */
    reduce_vars?: boolean;
    sequences?: boolean;
    /** Pass false to disable potentially dropping functions marked as "pure". */
    side_effects?: boolean;
    /** De-duplicate and remove unreachable `switch` branches.  */
    switches?: boolean;
    /** Drop unreferenced functions ("funcs") and/or variables ("vars") in the top level scope (false by default, true to drop both unreferenced functions and variables) */
    toplevel?: boolean;
    /** Prevent specific toplevel functions and variables from unused removal (can be array, comma-separated, RegExp or function. Implies toplevel) */
    top_retain?: boolean;
    typeofs?: boolean;
    unsafe?: boolean;
    /** Compress expressions like a `<= b` assuming none of the operands can be (coerced to) `NaN`. */
    unsafe_comps?: boolean;
    /** Compress and mangle `Function(args, code)` when both args and code are string literals. */
    unsafe_Function?: boolean;
    /** Optimize numerical expressions like `2 * x * 3` into `6 * x`, which may give imprecise floating point results.  */
    unsafe_math?: boolean;
    /** Optimize expressions like `Array.prototype.slice.call(a)` into `[].slice.call(a)` */
    unsafe_proto?: boolean;
    /** Enable substitutions of variables with `RegExp` values the same way as if they are constants. */
    unsafe_regexp?: boolean;
    unsafe_undefined?: boolean;
    unused?: boolean;
    /** display warnings when dropping unreachable code or unused declarations etc. */
    warnings?: boolean;
}

export enum InlineFunctions {
    Disabled = 0,
    SimpleFunctions = 1,
    WithArguments = 2,
    WithArgumentsAndVariables = 3
}
export interface MangleOptions {
    /** Pass true to mangle names visible in scopes where `eval` or with are used. */
    eval?: boolean;
    /** Pass true to not mangle function names. Useful for code relying on `Function.prototype.name`. */
    keep_fnames?: boolean;
    /** Pass an array of identifiers that should be excluded from mangling. Example: `["foo", "bar"]`. */
    reserved?: string[];
    /** Pass true to mangle names declared in the top level scope. */
    toplevel?: boolean;
    properties?: boolean | ManglePropertiesOptions;
}

export interface ManglePropertiesOptions {
    /** Use true to allow the mangling of builtin DOM properties. Not recommended to override this setting. */
    builtins?: boolean;
    /** Mangle names with the original name still present. Pass an empty string "" to enable, or a non-empty string to set the debug suffix. */
    debug?: boolean;
    /** Only mangle unquoted property names */
    keep_quoted?: boolean;
    /** Pass a RegExp literal to only mangle property names matching the regular expression. */
    regex?: RegExp;
    /** Do not mangle property names listed in the reserved array */
    reserved?: string[];
}

export interface OutputOptions {
    ascii_only?: boolean;
    beautify?: boolean;
    braces?: boolean;
    comments?: boolean | 'all' | 'some' | RegExp;
    indent_level?: number;
    indent_start?: boolean;
    inline_script?: boolean;
    keep_quoted_props?: boolean;
    max_line_len?: boolean | number;
    preamble?: string;
    preserve_line?: boolean;
    quote_keys?: boolean;
    quote_style?: OutputQuoteStyle;
    semicolons?: boolean;
    shebang?: boolean;
    webkit?: boolean;
    width?: number;
    wrap_iife?: boolean;
}

export enum OutputQuoteStyle {
    PreferDouble = 0,
    AlwaysSingle = 1,
    AlwaysDouble = 2,
    AlwaysOriginal = 3
}

export interface MinifyOptions {
    /** Pass true to return compressor warnings in result.warnings. Use the value `verbose` for more detailed warnings. */
    warnings?: boolean | 'verbose';
    parse?: ParseOptions;
    compress?: boolean | CompressOptions;
    mangle?: boolean | MangleOptions;
    output?: OutputOptions;
    sourceMap?: boolean | SourceMapOptions;
    toplevel?: boolean;
    nameCache?: object;
    ie8?: boolean;
    keep_fnames?: boolean;
}

export interface MinifyOutput {
    error?: Error;
    warnings?: string[];
    code: string;
    map: string;
}

export interface SourceMapOptions {
    includeSources?: boolean;
    filename?: string;
    url?: string | 'inline';
    root?: string;
    content?: RawSourceMap;
}

export function minify(files: string | string[] | { [file: string]: string }, options?: MinifyOptions): MinifyOutput;
