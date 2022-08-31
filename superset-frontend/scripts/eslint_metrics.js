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
module.exports = results => {
  const byRuleId = results.reduce((map, current) => {
    const resultsMap = map;
    current.messages.forEach(({ ruleId, line, column, message }) => {
      if (!resultsMap[ruleId + message]) {
        resultsMap[ruleId + message] = {
          rule: ruleId,
          message,
          occurrences: [],
        };
      }

      // const occurrence = `${current.filePath}:${line}:${column}:${message}`;
      const occurrence = {
        file: current.filePath,
        line,
        column,
        message,
      };
      resultsMap[ruleId + message].occurrences.push(occurrence);
    });
    return resultsMap;
  }, {});

  const enforcedRules = {
    'react-prefer-function-component/react-prefer-function-component': {
      description: 'We prefer function components to class-based components',
    },
    'react/jsx-filename-extension': {
      description:
        'We prefer Typescript - all JSX files should be converted to TSX',
    },
    'react/forbid-component-props': {
      description:
        'We prefer Emotion for styling rather than `className` or `style` props',
    },
    'no-restricted-imports': {
      description:
        "This rule catches several things that shouldn't be used anymore. LESS, antD, enzyme, etc. See individual occurrence messages for details",
    },
  };

  const metricsByRule = Object.values(byRuleId)
    .filter(value => enforcedRules[value.rule] || false)
    .map(value => ({
      'eslint rule': value.rule,
      issue: enforcedRules[value.rule].description,
      message: value.message,
      count: value.occurrences.length,
      occurrences: value.occurrences,
    }));

  const result = {
    metrics: metricsByRule,
  };
  return JSON.stringify(result, null, 2);
};
