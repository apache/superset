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

// Tree transformer helpers.

function TreeTransformer(before, after) {
    TreeWalker.call(this);
    this.before = before;
    this.after = after;
}
TreeTransformer.prototype = new TreeWalker;

(function(undefined) {

    function _(node, descend) {
        node.DEFMETHOD("transform", function(tw, in_list) {
            var x, y;
            tw.push(this);
            if (tw.before) x = tw.before(this, descend, in_list);
            if (x === undefined) {
                x = this;
                descend(x, tw);
                if (tw.after) {
                    y = tw.after(x, in_list);
                    if (y !== undefined) x = y;
                }
            }
            tw.pop();
            return x;
        });
    }

    function do_list(list, tw) {
        return MAP(list, function(node) {
            return node.transform(tw, true);
        });
    }

    _(AST_Node, noop);

    _(AST_LabeledStatement, function(self, tw) {
        self.label = self.label.transform(tw);
        self.body = self.body.transform(tw);
    });

    _(AST_SimpleStatement, function(self, tw) {
        self.body = self.body.transform(tw);
    });

    _(AST_Block, function(self, tw) {
        self.body = do_list(self.body, tw);
    });

    _(AST_Do, function(self, tw) {
        self.body = self.body.transform(tw);
        self.condition = self.condition.transform(tw);
    });

    _(AST_While, function(self, tw) {
        self.condition = self.condition.transform(tw);
        self.body = self.body.transform(tw);
    });

    _(AST_For, function(self, tw) {
        if (self.init) self.init = self.init.transform(tw);
        if (self.condition) self.condition = self.condition.transform(tw);
        if (self.step) self.step = self.step.transform(tw);
        self.body = self.body.transform(tw);
    });

    _(AST_ForIn, function(self, tw) {
        self.init = self.init.transform(tw);
        self.object = self.object.transform(tw);
        self.body = self.body.transform(tw);
    });

    _(AST_With, function(self, tw) {
        self.expression = self.expression.transform(tw);
        self.body = self.body.transform(tw);
    });

    _(AST_Exit, function(self, tw) {
        if (self.value) self.value = self.value.transform(tw);
    });

    _(AST_LoopControl, function(self, tw) {
        if (self.label) self.label = self.label.transform(tw);
    });

    _(AST_If, function(self, tw) {
        self.condition = self.condition.transform(tw);
        self.body = self.body.transform(tw);
        if (self.alternative) self.alternative = self.alternative.transform(tw);
    });

    _(AST_Switch, function(self, tw) {
        self.expression = self.expression.transform(tw);
        self.body = do_list(self.body, tw);
    });

    _(AST_Case, function(self, tw) {
        self.expression = self.expression.transform(tw);
        self.body = do_list(self.body, tw);
    });

    _(AST_Try, function(self, tw) {
        self.body = do_list(self.body, tw);
        if (self.bcatch) self.bcatch = self.bcatch.transform(tw);
        if (self.bfinally) self.bfinally = self.bfinally.transform(tw);
    });

    _(AST_Catch, function(self, tw) {
        if (self.argname) self.argname = self.argname.transform(tw);
        self.body = do_list(self.body, tw);
    });

    _(AST_Definitions, function(self, tw) {
        self.definitions = do_list(self.definitions, tw);
    });

    _(AST_VarDef, function(self, tw) {
        self.name = self.name.transform(tw);
        if (self.value) self.value = self.value.transform(tw);
    });

    _(AST_Destructuring, function(self, tw) {
        self.names = do_list(self.names, tw);
    });

    _(AST_Lambda, function(self, tw) {
        if (self.name) self.name = self.name.transform(tw);
        self.argnames = do_list(self.argnames, tw);
        if (self.body instanceof AST_Node) {
            self.body = self.body.transform(tw);
        } else {
            self.body = do_list(self.body, tw);
        }
    });

    _(AST_Call, function(self, tw) {
        self.expression = self.expression.transform(tw);
        self.args = do_list(self.args, tw);
    });

    _(AST_Sequence, function(self, tw) {
        self.expressions = do_list(self.expressions, tw);
    });

    _(AST_Dot, function(self, tw) {
        self.expression = self.expression.transform(tw);
    });

    _(AST_Sub, function(self, tw) {
        self.expression = self.expression.transform(tw);
        self.property = self.property.transform(tw);
    });

    _(AST_Yield, function(self, tw) {
        if (self.expression) self.expression = self.expression.transform(tw);
    });

    _(AST_Await, function(self, tw) {
        self.expression = self.expression.transform(tw);
    });

    _(AST_Unary, function(self, tw) {
        self.expression = self.expression.transform(tw);
    });

    _(AST_Binary, function(self, tw) {
        self.left = self.left.transform(tw);
        self.right = self.right.transform(tw);
    });

    _(AST_Conditional, function(self, tw) {
        self.condition = self.condition.transform(tw);
        self.consequent = self.consequent.transform(tw);
        self.alternative = self.alternative.transform(tw);
    });

    _(AST_Array, function(self, tw) {
        self.elements = do_list(self.elements, tw);
    });

    _(AST_Object, function(self, tw) {
        self.properties = do_list(self.properties, tw);
    });

    _(AST_ObjectProperty, function(self, tw) {
        if (self.key instanceof AST_Node) {
            self.key = self.key.transform(tw);
        }
        self.value = self.value.transform(tw);
    });

    _(AST_Class, function(self, tw) {
        if (self.name) self.name = self.name.transform(tw);
        if (self.extends) self.extends = self.extends.transform(tw);
        self.properties = do_list(self.properties, tw);
    });

    _(AST_Expansion, function(self, tw) {
        self.expression = self.expression.transform(tw);
    });

    _(AST_NameMapping, function(self, tw) {
        self.foreign_name = self.foreign_name.transform(tw);
        self.name = self.name.transform(tw);
    });

    _(AST_Import, function(self, tw) {
        if (self.imported_name) self.imported_name = self.imported_name.transform(tw);
        if (self.imported_names) do_list(self.imported_names, tw);
        self.module_name = self.module_name.transform(tw);
    });

    _(AST_Export, function(self, tw) {
        if (self.exported_definition) self.exported_definition = self.exported_definition.transform(tw);
        if (self.exported_value) self.exported_value = self.exported_value.transform(tw);
        if (self.exported_names) do_list(self.exported_names, tw);
        if (self.module_name) self.module_name = self.module_name.transform(tw);
    });

    _(AST_TemplateString, function(self, tw) {
        self.segments = do_list(self.segments, tw);
    });

    _(AST_PrefixedTemplateString, function(self, tw) {
        self.prefix = self.prefix.transform(tw);
        self.template_string = self.template_string.transform(tw);
    });

})();
