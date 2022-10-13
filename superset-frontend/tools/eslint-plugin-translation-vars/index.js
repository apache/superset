/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * @fileoverview Rule to warn about translation template variables
 * @author Apache
 */

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  rules: {
    'no-template-vars': {
      create(context) {
        function handler(node) {
          if (node.arguments.length) {
            const firstArgs = node.arguments[0];
            if (
              firstArgs.type === 'TemplateLiteral' &&
              firstArgs.expressions.length
            ) {
              context.report({
                node,
                message:
                  "Don't use variables in translation string templates. Flask-babel is a static translation translation service, so it can’t handle strings that include variables",
              });
            }
          }
        }
        return {
          "CallExpression[callee.name='t']": handler,
          "CallExpression[callee.name='tn']": handler,
        };
      },
    },
  },
};
