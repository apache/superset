// Export a new default each time
module.exports = function() {
    return {
        /* Inline Javascript - @plugin still allowed */
        javascriptEnabled: false,

        /* Outputs a makefile import dependency list to stdout. */
        depends: false,

        /* (DEPRECATED) Compress using less built-in compression. 
         * This does an okay job but does not utilise all the tricks of 
         * dedicated css compression. */
        compress: false,

        /* Runs the less parser and just reports errors without any output. */
        lint: false,

        /* Sets available include paths.
         * If the file in an @import rule does not exist at that exact location, 
         * less will look for it at the location(s) passed to this option. 
         * You might use this for instance to specify a path to a library which 
         * you want to be referenced simply and relatively in the less files. */
        paths: [],

        /* color output in the terminal */
        color: true,

        /* The strictImports controls whether the compiler will allow an @import inside of either 
         * @media blocks or (a later addition) other selector blocks.
         * See: https://github.com/less/less.js/issues/656 */
        strictImports: false,

        /* Allow Imports from Insecure HTTPS Hosts */
        insecure: false,

        /* Allows you to add a path to every generated import and url in your css. 
         * This does not affect less import statements that are processed, just ones 
         * that are left in the output css. */
        rootpath: '',

        /* By default URLs are kept as-is, so if you import a file in a sub-directory 
         * that references an image, exactly the same URL will be output in the css. 
         * This option allows you to re-write URL's in imported files so that the 
         * URL is always relative to the base imported file */
        rewriteUrls: false,

        /* Compatibility with IE8. Used for limiting data-uri length */
        ieCompat: false,  // true until 3.0

        /* How to process math 
         *   0 always           - eagerly try to solve all operations
         *   1 parens-division  - require parens for division "/"
         *   2 parens | strict  - require parens for all operations
         *   3 strict-legacy    - legacy strict behavior (super-strict)
         */
        math: 0,

        /* Without this option, less attempts to guess at the output unit when it does maths. */
        strictUnits: false,

        /* Effectively the declaration is put at the top of your base Less file, 
         * meaning it can be used but it also can be overridden if this variable 
         * is defined in the file. */
        globalVars: null,

        /* As opposed to the global variable option, this puts the declaration at the
         * end of your base file, meaning it will override anything defined in your Less file. */
        modifyVars: null,

        /* This option allows you to specify a argument to go on to every URL.  */
        urlArgs: ''
    }
}