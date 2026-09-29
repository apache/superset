/*
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

// Converts a .po translation file into the Jed 1.x JSON language pack our
// frontend runtime (packages/superset-core/src/translation/Translator.ts,
// via the `jed` package) loads directly. Replaces the old `po2json` CLI
// (long abandoned, and the sole reason `underscore`'s
// GHSA-cf4h-3jhx-xvhq/CVE-2021-23358 stayed in this repo's dependency tree
// via po2json -> nomnom -> underscore, see apache/superset/security/
// dependabot/9): this only needs gettext-parser, which is what every
// po2json fork already wraps, so wrapping it ourselves avoids depending on
// yet another narrow, thinly-maintained po2json-shaped package.
//
// Jed's own translate().fetch() already falls back to the original msgid
// when a key is missing or its stored msgstr is empty (verified directly
// against the `jed` package this repo ships), so an untranslated entry is
// included here exactly as gettext-parser parsed it -- no msgid backfill
// needed to get a correct fallback at render time.
//
// Pure library, no CLI/file-system side effects, so it can be unit tested
// directly (spec/scripts/po2json.test.ts) -- see po2json-cli.js for the
// script po2json.sh actually invokes.

import { po } from 'gettext-parser';

// gettext-parser preserves each PO file's own header key casing verbatim
// (conventionally "Language"/"Plural-Forms", Title-Case, not lowercased
// despite what its README says) -- look up case-insensitively so a file
// using different casing doesn't silently lose its language/plural rule.
function findHeader(headers, name) {
  const key = Object.keys(headers).find(
    k => k.toLowerCase() === name.toLowerCase(),
  );
  return key ? headers[key] : undefined;
}

/**
 * @param {Buffer} poBuffer
 * @param {string} domain
 * @returns {{
 *   domain: string,
 *   locale_data: Record<string, Record<string, string[] | {
 *     domain: string, lang: string, plural_forms: string,
 *   }>>,
 * }}
 */
export function poToJed(poBuffer, domain) {
  const parsed = po.parse(poBuffer);

  /** @type {Record<string, string[] | { domain: string, lang: string, plural_forms: string }>} */
  const localeData = {
    '': {
      domain,
      lang: findHeader(parsed.headers, 'Language') || 'en',
      plural_forms:
        findHeader(parsed.headers, 'Plural-Forms') ||
        'nplurals=2; plural=(n != 1)',
    },
  };
  // gettext-parser buckets entries by msgctxt, keyed by context string
  // ('' is the default, no-msgctxt bucket). Jed looks up a contextual entry
  // under `context + '\u0004' + msgid` (Jed.context_delimiter, ported
  // straight from gettext's own convention), so every non-default context
  // has to be folded in under that composite key or those entries would
  // silently be dropped from the generated catalog.
  Object.entries(parsed.translations).forEach(([msgctxt, entries]) => {
    Object.entries(entries).forEach(([msgid, entry]) => {
      // The header entry (msgid "") describes the file itself, not a real
      // translatable string -- gettext-parser surfaces it as a regular
      // context entry, but Jed's own "" key is metadata, not a translation.
      if (msgid === '') {
        return;
      }
      const key = msgctxt ? `${msgctxt}\u0004${msgid}` : msgid;
      localeData[key] = entry.msgstr;
    });
  });

  return { domain, locale_data: { [domain]: localeData } };
}
