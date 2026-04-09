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
 * Escapes RegExp metacharacters in a string so it can be safely used in a
 * dynamically created regular expression.
 *
 * @param value - The raw string to escape
 * @returns The escaped string safe for use in `new RegExp(...)`
 */
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replaces a label inside a compound key only if it appears as a complete
 * word/token and contains at least one alphabetic character.
 *
 * @param key - The source string (typically a compound field name)
 * @param label - The label to search for as a standalone token
 * @param replacement - The human-readable value to replace the label with
 * @returns The transformed key if a valid match exists, otherwise the original key
 */
const replaceLabelIfExists = (
  key: string,
  label: string,
  replacement: string,
) => {
  /**
   * Logic:
   *
   * This function is intentionally stricter than a simple substring replace:
   * - The label must NOT be part of a larger word (e.g. "account" will NOT match
   *   "testing_account").
   * - Underscores (`_`) are treated as part of the word.
   * - Numeric-only matches are ignored (e.g. "12" will NOT match "123").
   *
   * If the label is found, only the matched portion is replaced; otherwise,
   * the original key is returned unchanged.
   *
   * Examples:
   * - replaceLabelIfExists("testing_account 123", "testing_account", "Account")
   *   → "Account 123"
   * - replaceLabelIfExists("testing_account 123", "account", "Account")
   *   → "testing_account 123"
   * - replaceLabelIfExists("123", "12", "X")
   *   → "123"
   */

  if (key === label) {
    return replacement;
  }

  const escapedLabel = escapeRegex(label);
  const regex = new RegExp(`(?<!\\w)${escapedLabel}(?!\\w)`, 'g');
  return regex.test(key) ? key.replace(regex, replacement) : key;
};

/**
 * Enriches the verbose map by creating human-readable versions of compound field names.
 *
 * @param label_map — a mapping of compound keys to arrays of component labels (e.g., { "revenue_total_usd": ["revenue", "total", "usd"] })
 * @param verboseMap — the existing mapping of field names to their display labels
 * @returns an updated verbose map that includes human-readable versions of the compound keys
 */
const addLabelMapToVerboseMap = (
  label_map: Record<string, string[]>,
  verboseMap: Record<string, string> = {},
): Record<string, string> => {
  /**
   * Logic:
   *
   * This function takes a mapping of compound field names to their component labels
   * and replaces those labels with their corresponding human-readable values from
   * `verboseMap`, producing display-friendly versions of the compound keys.
   *
   * Replacement behavior:
   * - Each compound key is processed word-by-word (split on spaces).
   * - Only labels that exist in `verboseMap` are considered.
   * - Each word is replaced at most once, using `replaceLabelIfExists`, which:
   *   - Matches only full tokens (no partial matches).
   *   - Treats underscores (`_`) as part of a token.
   *   - Is case-sensitive.
   * - Labels not found in `verboseMap` are left unchanged.
   *
   * The original `verboseMap` is preserved and extended with the newly generated
   * human-readable entries.
   *
   * Example:
   * ```ts
   * label_map = {
   *   "testing_count, 1 week ago": ["testing_count", "1 week ago"]
   * }
   *
   * verboseMap = {
   *   testing_count: "Testing Count"
   * }
   *
   * Result:
   * {
   *   testing_count: "Testing Count",
   *   "testing_count, 1 week ago": "Testing Count, 1 week ago"
   * }
   * ```
   */
  const newVerboseMap: Record<string, string> = {};

  Object.entries(label_map).forEach(([key, labels]) => {
    if (labels) {
      const newLabelMap: Record<string, string> = labels
        .filter(l => verboseMap[l])
        .reduce(
          (acc, label) => ({
            ...acc,
            [label]: verboseMap[label],
          }),
          {},
        );

      const newKey = key
        .split(' ')
        .map(word => {
          for (const label of Object.keys(newLabelMap)) {
            const newWord = replaceLabelIfExists(
              word,
              label,
              newLabelMap[label],
            );

            if (newWord !== word) {
              return newWord;
            }
          }

          return word;
        })
        .join(' ');

      newVerboseMap[key] = newKey;
    }
  });

  return { ...verboseMap, ...newVerboseMap };
};

export default addLabelMapToVerboseMap;
