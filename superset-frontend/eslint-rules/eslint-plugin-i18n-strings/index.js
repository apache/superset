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
                  "Don't use variables in translation string templates. Flask-babel is a static translation service, so it can't handle strings that include variables",
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
    'no-title-case': {
      create(context) {
        function checkTitleCase(str) {
          // Skip strings with placeholders like %s, %d, %(name)s, etc.
          if (/%[sdf]|%\([^)]+\)[sdf]/.test(str)) {
            return false;
          }

          // Skip strings that are all uppercase (likely acronyms)
          if (str === str.toUpperCase()) {
            return false;
          }

          // Skip strings with periods (likely multiple sentences)
          if (str.includes('.')) {
            return false;
          }

          // Skip single words
          const words = str.trim().split(/\s+/);
          if (words.length <= 1) {
            return false;
          }

          // Whitelist of words that are commonly capitalized in product names
          // but should not trigger title case warnings
          const productWords = [
            'Lab',
            'Server',
            'Studio',
            'Pro',
            'Plus',
            'Max',
            'Mini',
          ];

          // Common prepositions and articles that should be lowercase (unless at start)
          const lowercaseWords = [
            'a',
            'an',
            'the',
            'and',
            'or',
            'but',
            'for',
            'with',
            'to',
            'from',
            'in',
            'on',
            'at',
            'by',
            'of',
          ];

          // Check if the string uses title case (multiple words with first letter capitalized)
          const hasTitleCase = words.some((word, index) => {
            // Skip first word
            if (index === 0) {
              return false;
            }

            // Skip acronyms (all uppercase)
            if (word === word.toUpperCase()) {
              return false;
            }

            // Skip whitelisted product words when preceded by an uppercase word
            if (
              productWords.includes(word) &&
              index > 0 &&
              words[index - 1] === words[index - 1].toUpperCase()
            ) {
              return false;
            }

            // Check if it's a lowercase word that's incorrectly capitalized
            if (
              lowercaseWords.includes(word.toLowerCase()) &&
              /^[A-Z]/.test(word)
            ) {
              return true;
            }

            // For other words, check if they start with capital letter
            return (
              word.length > 1 &&
              /^[A-Z]/.test(word) &&
              !productWords.includes(word)
            );
          });

          return hasTitleCase;
        }

        function handler(node) {
          if (node.arguments.length) {
            const firstArg = node.arguments[0];
            let stringValue = null;

            // Extract string value based on node type
            if (
              firstArg.type === 'Literal' &&
              typeof firstArg.value === 'string'
            ) {
              stringValue = firstArg.value;
            } else if (
              firstArg.type === 'TemplateLiteral' &&
              firstArg.quasis.length === 1
            ) {
              // Handle template literals without expressions
              stringValue = firstArg.quasis[0].value.raw;
            }

            if (stringValue && checkTitleCase(stringValue)) {
              context.report({
                node: firstArg,
                message: `Avoid title case in i18n strings: "${stringValue}". Use sentence case instead.`,
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
