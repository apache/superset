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
import { poToJed } from '../../scripts/po2json.js';

const po = (body: string) =>
  Buffer.from(
    [
      'msgid ""',
      'msgstr ""',
      '"Language: de\\n"',
      '"Plural-Forms: nplurals=2; plural=(n != 1);\\n"',
      '"Content-Type: text/plain; charset=utf-8\\n"',
      '',
      body,
    ].join('\n'),
  );

test('translates domain, language and plural rule into the Jed header entry', () => {
  const result = poToJed(po(''), 'superset');
  expect(result).toEqual({
    domain: 'superset',
    locale_data: {
      superset: {
        '': {
          domain: 'superset',
          lang: 'de',
          plural_forms: 'nplurals=2; plural=(n != 1);',
        },
      },
    },
  });
});

test('a translated entry becomes msgid -> [msgstr]', () => {
  const result = poToJed(
    po(['msgid "Hello"', 'msgstr "Hallo"'].join('\n')),
    'superset',
  );
  expect(result.locale_data.superset.Hello).toEqual(['Hallo']);
});

test('an untranslated entry keeps its empty msgstr rather than being dropped', () => {
  // Jed's own translate().fetch() already falls back to the original msgid
  // when the stored msgstr is empty (or the key is missing entirely) --
  // verified directly against the `jed` package this repo ships -- so
  // there's nothing to backfill here.
  const result = poToJed(
    po(['msgid "Untranslated"', 'msgstr ""'].join('\n')),
    'superset',
  );
  expect(result.locale_data.superset.Untranslated).toEqual(['']);
});

test('a plural entry becomes msgid -> [singular, plural, ...]', () => {
  const result = poToJed(
    po(
      [
        'msgid "%(num)d hour"',
        'msgid_plural "%(num)d hours"',
        'msgstr[0] "%(num)d Stunde"',
        'msgstr[1] "%(num)d Stunden"',
      ].join('\n'),
    ),
    'superset',
  );
  expect(result.locale_data.superset['%(num)d hour']).toEqual([
    '%(num)d Stunde',
    '%(num)d Stunden',
  ]);
});

test('the "" header entry does not become a locale_data translation key', () => {
  const result = poToJed(po(''), 'superset');
  expect(Object.keys(result.locale_data.superset)).toEqual(['']);
});

test('falls back to English/2-form plurals when a PO carries no Language/Plural-Forms header', () => {
  const bareHeader = Buffer.from(
    ['msgid ""', 'msgstr ""', '', 'msgid "Hi"', 'msgstr "Hi"'].join('\n'),
  );
  const result = poToJed(bareHeader, 'superset');
  expect(result.locale_data.superset['']).toEqual({
    domain: 'superset',
    lang: 'en',
    plural_forms: 'nplurals=2; plural=(n != 1)',
  });
});

test("a msgctxt entry is keyed as context\\u0004msgid, Jed.context_delimiter's own convention", () => {
  const result = poToJed(
    po(['msgctxt "menu"', 'msgid "Open"', 'msgstr "Ouvrir (menu)"'].join('\n')),
    'superset',
  );
  expect(result.locale_data.superset['menu\u0004Open']).toEqual([
    'Ouvrir (menu)',
  ]);
});

test('header lookup is case-insensitive (not every generator title-cases them)', () => {
  const lowerCaseHeader = Buffer.from(
    [
      'msgid ""',
      'msgstr ""',
      '"language: fr\\n"',
      '"plural-forms: nplurals=2; plural=(n > 1);\\n"',
    ].join('\n'),
  );
  const result = poToJed(lowerCaseHeader, 'superset');
  expect(result.locale_data.superset['']).toEqual({
    domain: 'superset',
    lang: 'fr',
    plural_forms: 'nplurals=2; plural=(n > 1);',
  });
});
