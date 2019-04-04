/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

"use strict";

function SymbolDef(scope, orig, init) {
    this.name = orig.name;
    this.orig = [ orig ];
    this.init = init;
    this.eliminated = 0;
    this.scope = scope;
    this.references = [];
    this.replaced = 0;
    this.global = false;
    this.export = false;
    this.mangled_name = null;
    this.undeclared = false;
    this.id = SymbolDef.next_id++;
}

SymbolDef.next_id = 1;

var MASK_EXPORT_DONT_MANGLE = 1 << 0;
var MASK_EXPORT_WANT_MANGLE = 1 << 1;

SymbolDef.prototype = {
    unmangleable: function(options) {
        if (!options) options = {};

        return this.global && !options.toplevel
            || (this.export & MASK_EXPORT_DONT_MANGLE)
            || this.undeclared
            || !options.eval && this.scope.pinned()
            || (this.orig[0] instanceof AST_SymbolLambda
                  || this.orig[0] instanceof AST_SymbolDefun) && keep_name(options.keep_fnames, this.orig[0].name)
            || this.orig[0] instanceof AST_SymbolMethod
            || (this.orig[0] instanceof AST_SymbolClass
                  || this.orig[0] instanceof AST_SymbolDefClass) && keep_name(options.keep_classnames, this.orig[0].name);
    },
    mangle: function(options) {
        var cache = options.cache && options.cache.props;
        if (this.global && cache && cache.has(this.name)) {
            this.mangled_name = cache.get(this.name);
        } else if (!this.mangled_name && !this.unmangleable(options)) {
            var s = this.scope;
            var sym = this.orig[0];
            if (options.ie8 && sym instanceof AST_SymbolLambda)
                s = s.parent_scope;
            var def;
            if (def = this.redefined()) {
                this.mangled_name = def.mangled_name || def.name;
            } else
                this.mangled_name = s.next_mangled(options, this);
            if (this.global && cache) {
                cache.set(this.name, this.mangled_name);
            }
        }
    },
    redefined: function() {
        return this.defun && this.defun.variables.get(this.name);
    }
};

AST_Toplevel.DEFMETHOD("figure_out_scope", function(options) {
    options = defaults(options, {
        cache: null,
        ie8: false,
        safari10: false,
    });

    // pass 1: setup scope chaining and handle definitions
    var self = this;
    var scope = self.parent_scope = null;
    var labels = new Dictionary();
    var defun = null;
    var in_destructuring = null;
    var for_scopes = [];
    var tw = new TreeWalker(function(node, descend) {
        if (node.is_block_scope()) {
            var save_scope = scope;
            node.block_scope = scope = new AST_Scope(node);
            scope.init_scope_vars(save_scope);
            if (!(node instanceof AST_Scope)) {
                scope.uses_with = save_scope.uses_with;
                scope.uses_eval = save_scope.uses_eval;
                scope.directives = save_scope.directives;
            }
            if (options.safari10) {
                if (node instanceof AST_For || node instanceof AST_ForIn) {
                    for_scopes.push(scope);
                }
            }
            descend();
            scope = save_scope;
            return true;
        }
        if (node instanceof AST_Destructuring) {
            in_destructuring = node;  // These don't nest
            descend();
            in_destructuring = null;
            return true;
        }
        if (node instanceof AST_Scope) {
            node.init_scope_vars(scope);
            var save_scope = scope;
            var save_defun = defun;
            var save_labels = labels;
            defun = scope = node;
            labels = new Dictionary();
            descend();
            scope = save_scope;
            defun = save_defun;
            labels = save_labels;
            return true;        // don't descend again in TreeWalker
        }
        if (node instanceof AST_LabeledStatement) {
            var l = node.label;
            if (labels.has(l.name)) {
                throw new Error(string_template("Label {name} defined twice", l));
            }
            labels.set(l.name, l);
            descend();
            labels.del(l.name);
            return true;        // no descend again
        }
        if (node instanceof AST_With) {
            for (var s = scope; s; s = s.parent_scope)
                s.uses_with = true;
            return;
        }
        if (node instanceof AST_Symbol) {
            node.scope = scope;
        }
        if (node instanceof AST_Label) {
            node.thedef = node;
            node.references = [];
        }
        if (node instanceof AST_SymbolLambda) {
            defun.def_function(node, node.name == "arguments" ? undefined : defun);
        } else if (node instanceof AST_SymbolDefun) {
            // Careful here, the scope where this should be defined is
            // the parent scope.  The reason is that we enter a new
            // scope when we encounter the AST_Defun node (which is
            // instanceof AST_Scope) but we get to the symbol a bit
            // later.
            mark_export((node.scope = defun.parent_scope.get_defun_scope()).def_function(node, defun), 1);
        } else if (node instanceof AST_SymbolClass) {
            mark_export(defun.def_variable(node, defun), 1);
        } else if (node instanceof AST_SymbolImport) {
            scope.def_variable(node);
        } else if (node instanceof AST_SymbolDefClass) {
            // This deals with the name of the class being available
            // inside the class.
            mark_export((node.scope = defun.parent_scope).def_function(node, defun), 1);
        } else if (node instanceof AST_SymbolVar
            || node instanceof AST_SymbolLet
            || node instanceof AST_SymbolConst) {
            var def;
            if (node instanceof AST_SymbolBlockDeclaration) {
                def = scope.def_variable(node, null);
            } else {
                def = defun.def_variable(node, node.TYPE == "SymbolVar" ? null : undefined);
            }
            if (!all(def.orig, function(sym) {
                if (sym === node) return true;
                if (node instanceof AST_SymbolBlockDeclaration) {
                    return sym instanceof AST_SymbolLambda;
                }
                return !(sym instanceof AST_SymbolLet || sym instanceof AST_SymbolConst);
            })) {
                js_error(
                    node.name + " redeclared",
                    node.start.file,
                    node.start.line,
                    node.start.col,
                    node.start.pos
                );
            }
            if (!(node instanceof AST_SymbolFunarg)) mark_export(def, 2);
            def.destructuring = in_destructuring;
            if (defun !== scope) {
                node.mark_enclosed(options);
                var def = scope.find_variable(node);
                if (node.thedef !== def) {
                    node.thedef = def;
                    node.reference(options);
                }
            }
        } else if (node instanceof AST_SymbolCatch) {
            scope.def_variable(node).defun = defun;
        } else if (node instanceof AST_LabelRef) {
            var sym = labels.get(node.name);
            if (!sym) throw new Error(string_template("Undefined label {name} [{line},{col}]", {
                name: node.name,
                line: node.start.line,
                col: node.start.col
            }));
            node.thedef = sym;
        }
        if (!(scope instanceof AST_Toplevel) && (node instanceof AST_Export || node instanceof AST_Import)) {
            js_error(
                node.TYPE + " statement may only appear at top level",
                node.start.file,
                node.start.line,
                node.start.col,
                node.start.pos
            );
        }

        function mark_export(def, level) {
            if (in_destructuring) {
                var i = 0;
                do {
                    level++;
                } while (tw.parent(i++) !== in_destructuring);
            }
            var node = tw.parent(level);
            if (def.export = node instanceof AST_Export && MASK_EXPORT_DONT_MANGLE) {
                var exported = node.exported_definition;
                if ((exported instanceof AST_Defun || exported instanceof AST_DefClass) && node.is_default) {
                    def.export = MASK_EXPORT_WANT_MANGLE;
                }
            }
        }
    });
    self.walk(tw);

    // pass 2: find back references and eval
    self.globals = new Dictionary();
    var tw = new TreeWalker(function(node, descend) {
        if (node instanceof AST_LoopControl && node.label) {
            node.label.thedef.references.push(node);
            return true;
        }
        if (node instanceof AST_SymbolRef) {
            var name = node.name;
            if (name == "eval" && tw.parent() instanceof AST_Call) {
                for (var s = node.scope; s && !s.uses_eval; s = s.parent_scope) {
                    s.uses_eval = true;
                }
            }
            var sym;
            if (tw.parent() instanceof AST_NameMapping && tw.parent(1).module_name
                || !(sym = node.scope.find_variable(name))) {
                sym = self.def_global(node);
                if (node instanceof AST_SymbolExport) sym.export = MASK_EXPORT_DONT_MANGLE;
            } else if (sym.scope instanceof AST_Lambda && name == "arguments") {
                sym.scope.uses_arguments = true;
            }
            node.thedef = sym;
            node.reference(options);
            if (node.scope.is_block_scope()
                && !(sym.orig[0] instanceof AST_SymbolBlockDeclaration)) {
                node.scope = node.scope.get_defun_scope();
            }
            return true;
        }
        // ensure mangling works if catch reuses a scope variable
        var def;
        if (node instanceof AST_SymbolCatch && (def = node.definition().redefined())) {
            var s = node.scope;
            while (s) {
                push_uniq(s.enclosed, def);
                if (s === def.scope) break;
                s = s.parent_scope;
            }
        }
    });
    self.walk(tw);

    // pass 3: work around IE8 and Safari catch scope bugs
    if (options.ie8 || options.safari10) {
        self.walk(new TreeWalker(function(node, descend) {
            if (node instanceof AST_SymbolCatch) {
                var name = node.name;
                var refs = node.thedef.references;
                var scope = node.thedef.defun;
                var def = scope.find_variable(name) || self.globals.get(name) || scope.def_variable(node);
                refs.forEach(function(ref) {
                    ref.thedef = def;
                    ref.reference(options);
                });
                node.thedef = def;
                node.reference(options);
                return true;
            }
        }));
    }

    // pass 4: add symbol definitions to loop scopes
    // Safari/Webkit bug workaround - loop init let variable shadowing argument.
    // https://github.com/mishoo/UglifyJS2/issues/1753
    // https://bugs.webkit.org/show_bug.cgi?id=171041
    if (options.safari10) {
        for (var i = 0; i < for_scopes.length; i++) {
            var scope = for_scopes[i];
            scope.parent_scope.variables.each(function(def) {
                push_uniq(scope.enclosed, def);
            });
        }
    }
});

AST_Toplevel.DEFMETHOD("def_global", function(node) {
    var globals = this.globals, name = node.name;
    if (globals.has(name)) {
        return globals.get(name);
    } else {
        var g = new SymbolDef(this, node);
        g.undeclared = true;
        g.global = true;
        globals.set(name, g);
        return g;
    }
});

AST_Scope.DEFMETHOD("init_scope_vars", function(parent_scope) {
    this.variables = new Dictionary();  // map name to AST_SymbolVar (variables defined in this scope; includes functions)
    this.functions = new Dictionary();  // map name to AST_SymbolDefun (functions defined in this scope)
    this.uses_with = false;             // will be set to true if this or some nested scope uses the `with` statement
    this.uses_eval = false;             // will be set to true if this or nested scope uses the global `eval`
    this.parent_scope = parent_scope;   // the parent scope
    this.enclosed = [];                 // a list of variables from this or outer scope(s) that are referenced from this or inner scopes
    this.cname = -1;                    // the current index for mangling functions/variables
});

AST_Node.DEFMETHOD("is_block_scope", return_false);
AST_Class.DEFMETHOD("is_block_scope", return_false);
AST_Lambda.DEFMETHOD("is_block_scope", return_false);
AST_Toplevel.DEFMETHOD("is_block_scope", return_false);
AST_SwitchBranch.DEFMETHOD("is_block_scope", return_false);
AST_Block.DEFMETHOD("is_block_scope", return_true);
AST_IterationStatement.DEFMETHOD("is_block_scope", return_true);

AST_Lambda.DEFMETHOD("init_scope_vars", function() {
    AST_Scope.prototype.init_scope_vars.apply(this, arguments);
    this.uses_arguments = false;
    this.def_variable(new AST_SymbolFunarg({
        name: "arguments",
        start: this.start,
        end: this.end
    }));
});

AST_Arrow.DEFMETHOD("init_scope_vars", function() {
    AST_Scope.prototype.init_scope_vars.apply(this, arguments);
    this.uses_arguments = false;
});

AST_Symbol.DEFMETHOD("mark_enclosed", function(options) {
    var def = this.definition();
    var s = this.scope;
    while (s) {
        push_uniq(s.enclosed, def);
        if (options.keep_fnames) {
            s.functions.each(function(d) {
                if (keep_name(options.keep_fnames, d.name)) {
                    push_uniq(def.scope.enclosed, d);
                }
            });
        }
        if (s === def.scope) break;
        s = s.parent_scope;
    }
});

AST_Symbol.DEFMETHOD("reference", function(options) {
    this.definition().references.push(this);
    this.mark_enclosed(options);
});

AST_Scope.DEFMETHOD("find_variable", function(name) {
    if (name instanceof AST_Symbol) name = name.name;
    return this.variables.get(name)
        || (this.parent_scope && this.parent_scope.find_variable(name));
});

AST_Scope.DEFMETHOD("def_function", function(symbol, init) {
    var def = this.def_variable(symbol, init);
    if (!def.init || def.init instanceof AST_Defun) def.init = init;
    this.functions.set(symbol.name, def);
    return def;
});

AST_Scope.DEFMETHOD("def_variable", function(symbol, init) {
    var def = this.variables.get(symbol.name);
    if (def) {
        def.orig.push(symbol);
        if (def.init && (def.scope !== symbol.scope || def.init instanceof AST_Function)) {
            def.init = init;
        }
    } else {
        def = new SymbolDef(this, symbol, init);
        this.variables.set(symbol.name, def);
        def.global = !this.parent_scope;
    }
    return symbol.thedef = def;
});

function next_mangled(scope, options) {
    var ext = scope.enclosed;
    out: while (true) {
        var m = base54(++scope.cname);
        if (!is_identifier(m)) continue; // skip over "do"

        // https://github.com/mishoo/UglifyJS2/issues/242 -- do not
        // shadow a name reserved from mangling.
        if (member(m, options.reserved)) continue;

        // we must ensure that the mangled name does not shadow a name
        // from some parent scope that is referenced in this or in
        // inner scopes.
        for (var i = ext.length; --i >= 0;) {
            var sym = ext[i];
            var name = sym.mangled_name || (sym.unmangleable(options) && sym.name);
            if (m == name) continue out;
        }
        return m;
    }
}

AST_Scope.DEFMETHOD("next_mangled", function(options) {
    return next_mangled(this, options);
});

AST_Toplevel.DEFMETHOD("next_mangled", function(options) {
    var name;
    do {
        name = next_mangled(this, options);
    } while (member(name, this.mangled_names));
    return name;
});

AST_Function.DEFMETHOD("next_mangled", function(options, def) {
    // #179, #326
    // in Safari strict mode, something like (function x(x){...}) is a syntax error;
    // a function expression's argument cannot shadow the function expression's name

    var tricky_def = def.orig[0] instanceof AST_SymbolFunarg && this.name && this.name.definition();

    // the function's mangled_name is null when keep_fnames is true
    var tricky_name = tricky_def ? tricky_def.mangled_name || tricky_def.name : null;

    while (true) {
        var name = next_mangled(this, options);
        if (!tricky_name || tricky_name != name)
            return name;
    }
});

AST_Symbol.DEFMETHOD("unmangleable", function(options) {
    var def = this.definition();
    return !def || def.unmangleable(options);
});

// labels are always mangleable
AST_Label.DEFMETHOD("unmangleable", return_false);

AST_Symbol.DEFMETHOD("unreferenced", function() {
    return !this.definition().references.length && !this.scope.pinned();
});

AST_Symbol.DEFMETHOD("definition", function() {
    return this.thedef;
});

AST_Symbol.DEFMETHOD("global", function() {
    return this.definition().global;
});

AST_Toplevel.DEFMETHOD("_default_mangler_options", function(options) {
    options = defaults(options, {
        eval        : false,
        ie8         : false,
        keep_classnames: false,
        keep_fnames : false,
        module      : false,
        reserved    : [],
        toplevel    : false,
    });
    if (options["module"]) {
        options.toplevel = true;
    }
    if (!Array.isArray(options.reserved)) options.reserved = [];
    // Never mangle arguments
    push_uniq(options.reserved, "arguments");
    return options;
});

AST_Toplevel.DEFMETHOD("mangle_names", function(options) {
    options = this._default_mangler_options(options);

    // We only need to mangle declaration nodes.  Special logic wired
    // into the code generator will display the mangled name if it's
    // present (and for AST_SymbolRef-s it'll use the mangled name of
    // the AST_SymbolDeclaration that it points to).
    var lname = -1;
    var to_mangle = [];

    var mangled_names = this.mangled_names = [];
    if (options.cache) {
        this.globals.each(collect);
        if (options.cache.props) {
            options.cache.props.each(function(mangled_name) {
                push_uniq(mangled_names, mangled_name);
            });
        }
    }

    var tw = new TreeWalker(function(node, descend) {
        if (node instanceof AST_LabeledStatement) {
            // lname is incremented when we get to the AST_Label
            var save_nesting = lname;
            descend();
            lname = save_nesting;
            return true;        // don't descend again in TreeWalker
        }
        if (node instanceof AST_Scope) {
            node.variables.each(collect);
            return;
        }
        if (node.is_block_scope()) {
            node.block_scope.variables.each(collect);
            return;
        }
        if (node instanceof AST_Label) {
            var name;
            do name = base54(++lname); while (!is_identifier(name));
            node.mangled_name = name;
            return true;
        }
        if (!(options.ie8 || options.safari10) && node instanceof AST_SymbolCatch) {
            to_mangle.push(node.definition());
            return;
        }
    });
    this.walk(tw);
    to_mangle.forEach(function(def) { def.mangle(options); });

    function collect(symbol) {
        if (!member(symbol.name, options.reserved)) {
            if (!(symbol.export & MASK_EXPORT_DONT_MANGLE)) {
                to_mangle.push(symbol);
            }
        }
    }
});

AST_Toplevel.DEFMETHOD("find_colliding_names", function(options) {
    var cache = options.cache && options.cache.props;
    var avoid = Object.create(null);
    options.reserved.forEach(to_avoid);
    this.globals.each(add_def);
    this.walk(new TreeWalker(function(node) {
        if (node instanceof AST_Scope) node.variables.each(add_def);
        if (node instanceof AST_SymbolCatch) add_def(node.definition());
    }));
    return avoid;

    function to_avoid(name) {
        avoid[name] = true;
    }

    function add_def(def) {
        var name = def.name;
        if (def.global && cache && cache.has(name)) name = cache.get(name);
        else if (!def.unmangleable(options)) return;
        to_avoid(name);
    }
});

AST_Toplevel.DEFMETHOD("expand_names", function(options) {
    base54.reset();
    base54.sort();
    options = this._default_mangler_options(options);
    var avoid = this.find_colliding_names(options);
    var cname = 0;
    this.globals.each(rename);
    this.walk(new TreeWalker(function(node) {
        if (node instanceof AST_Scope) node.variables.each(rename);
        if (node instanceof AST_SymbolCatch) rename(node.definition());
    }));

    function next_name() {
        var name;
        do {
            name = base54(cname++);
        } while (avoid[name] || !is_identifier(name));
        return name;
    }

    function rename(def) {
        if (def.global && options.cache) return;
        if (def.unmangleable(options)) return;
        if (member(def.name, options.reserved)) return;
        var d = def.redefined();
        def.name = d ? d.name : next_name();
        def.orig.forEach(function(sym) {
            sym.name = def.name;
        });
        def.references.forEach(function(sym) {
            sym.name = def.name;
        });
    }
});

AST_Node.DEFMETHOD("tail_node", return_this);
AST_Sequence.DEFMETHOD("tail_node", function() {
    return this.expressions[this.expressions.length - 1];
});

AST_Toplevel.DEFMETHOD("compute_char_frequency", function(options) {
    options = this._default_mangler_options(options);
    try {
        AST_Node.prototype.print = function(stream, force_parens) {
            this._print(stream, force_parens);
            if (this instanceof AST_Symbol && !this.unmangleable(options)) {
                base54.consider(this.name, -1);
            } else if (options.properties) {
                if (this instanceof AST_Dot) {
                    base54.consider(this.property, -1);
                } else if (this instanceof AST_Sub) {
                    skip_string(this.property);
                }
            }
        };
        base54.consider(this.print_to_string(), 1);
    } finally {
        AST_Node.prototype.print = AST_Node.prototype._print;
    }
    base54.sort();

    function skip_string(node) {
        if (node instanceof AST_String) {
            base54.consider(node.value, -1);
        } else if (node instanceof AST_Conditional) {
            skip_string(node.consequent);
            skip_string(node.alternative);
        } else if (node instanceof AST_Sequence) {
            skip_string(node.tail_node());
        }
    }
});

var base54 = (function() {
    var leading = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_".split("");
    var digits = "0123456789".split("");
    var chars, frequency;
    function reset() {
        frequency = Object.create(null);
        leading.forEach(function(ch) {
            frequency[ch] = 0;
        });
        digits.forEach(function(ch) {
            frequency[ch] = 0;
        });
    }
    base54.consider = function(str, delta) {
        for (var i = str.length; --i >= 0;) {
            frequency[str[i]] += delta;
        }
    };
    function compare(a, b) {
        return frequency[b] - frequency[a];
    }
    base54.sort = function() {
        chars = mergeSort(leading, compare).concat(mergeSort(digits, compare));
    };
    base54.reset = reset;
    reset();
    function base54(num) {
        var ret = "", base = 54;
        num++;
        do {
            num--;
            ret += chars[num % base];
            num = Math.floor(num / base);
            base = 64;
        } while (num > 0);
        return ret;
    }
    return base54;
})();
