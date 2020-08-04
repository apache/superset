/* eslint-disable jsdoc/require-jsdoc, jsdoc/no-undefined-types */
"use strict";

function getPrototypeMethods(prototype) {
    /* eslint-disable local-rules/no-prototype-methods */
    return Object.getOwnPropertyNames(prototype).filter(function(name) {
        return (
            typeof prototype[name] === "function" &&
            prototype.hasOwnProperty(name)
        );
    });
}

var DISALLOWED_ARRAY_PROPS = getPrototypeMethods(Array.prototype);

var DISALLOWED_OBJECT_PROPS = getPrototypeMethods(Object.prototype);

module.exports = {
    // rule to disallow direct use of prototype methods of builtins
    "no-prototype-methods": {
        meta: {
            docs: {
                description: "disallow calling prototype methods directly",
                category: "Possible Errors",
                recommended: false,
                url: "https://eslint.org/docs/rules/no-prototype-builtins"
            },

            schema: []
        },

        create: function(context) {
            /**
             * Reports if a disallowed property is used in a CallExpression
             *
             * @param {ASTNode} node The CallExpression node.
             * @returns {void}
             */
            function disallowBuiltIns(node) {
                if (
                    node.callee.type !== "MemberExpression" ||
                    node.callee.computed ||
                    // allow static method calls
                    node.callee.object.name === "Array" ||
                    node.callee.object.name === "Object"
                ) {
                    return;
                }
                var propName = node.callee.property.name;

                if (DISALLOWED_OBJECT_PROPS.indexOf(propName) > -1) {
                    context.report({
                        message:
                            "Do not access {{obj}} prototype method '{{prop}}' from target object.",
                        loc: node.callee.property.loc.start,
                        data: {
                            obj: "Object",
                            prop: propName
                        },
                        node: node
                    });
                } else if (DISALLOWED_ARRAY_PROPS.indexOf(propName) > -1) {
                    context.report({
                        message:
                            "Do not access {{obj}} prototype method '{{prop}}' from target object.",
                        loc: node.callee.property.loc.start,
                        data: {
                            obj: "Array",
                            prop: propName
                        },
                        node: node
                    });
                }
            }

            return {
                CallExpression: disallowBuiltIns
            };
        }
    }
};
