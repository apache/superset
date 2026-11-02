---
title: Translation Guide
sidebar_position: 10
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Translation Guide

This page describes what to translate and how to decide on terms for your
language. For the mechanics, such as extracting strings, updating catalogs,
compiling and the AI backfill, see
[Contributing Translations](./howtos.md#contributing-translations).
Record each decision in its pull request (see
[Recording a decision](#recording-a-decision)).

## When to keep the English term

By default, translate every term. Keep the English term only in these cases:

1. Proper nouns and product names: Superset itself, and the names of databases
   and other products.
2. Strings that a program reads: SQL keywords, option values, API field names,
   icon names and example values. Translating them can break Superset. The
   registry `superset/translations/do-not-translate.txt` lists them, and your
   catalog marks them with the comment `#. do-not-translate`.
3. Terms that the user also sees in their own tools, for example `Slug`,
   `Backend` or the name of a data warehouse. If the user's tools show the
   English word, keep it. Then the user can connect the two names. If their
   tools show a translated word, use that word. For example, the French
   catalog translates `Host` as *Hôte*.

In every translated string, keep the placeholders `%s`, `%(name)s` and `{name}`
exactly as they are. A wrong placeholder can cause an error in the UI.

## Terms that mean two things

Before you choose a translation for a term, search your catalog for the word.
Check that no other concept already uses it.

For example, the Spanish catalog translates "Dashboard" as *Panel de control*.
It uses the same words for the control panel in Explore, in "Select values in
highlighted field(s) in the control panel". Romanian (*Panou de control*) and
Serbian (*Контролна табла*) have the same problem. A review of single strings
does not find it, because each string looks correct alone.

## Rules for the whole catalog

Some choices apply to every string of a language. Make each choice once, and
record it:

- Formal or informal address. For example, the Spanish catalog uses *tú*, as in
  *Haz clic*.
- Nouns for people. Decide how to write them. If there is no decision yet,
  prefer a neutral wording where the language allows it.
- Spelling and punctuation. For example, Russian translators choose *ё* or *е*,
  and the translators of each language choose whether a one-sentence message
  ends with a full stop.
- Plural forms. A plural entry needs every form that your language uses. The
  `Plural-Forms` line in the catalog header gives the number of forms. For
  example, Spanish has two (`nplurals=2`) and Romanian has three.

## Deciding on a term

When a term has different translations in a catalog, count how many times each
one appears. Usually the most common form is the right choice. It is not the
right choice when it breaks a rule on this page. In Spanish, *Panel de control*
is the most common translation of "Dashboard", and it is the collision above.

Native speakers of the language decide in the pull request. Write which other
options you rejected, and why. Change an agreed term in its own pull request,
so that reviewers see it as a terminology decision.

## Recording a decision

Record a terminology decision in the description of the pull request that makes
it. Write the term, the translation that it replaces, the count, and the options
that you rejected. Give the pull request a title such as `fix(i18n-es): ...`,
so that a search of merged pull requests finds it.

## Context for a single string

Sometimes one string is unclear without its code. In that case, a developer can
add an `i18n:` comment to the string. See
[Adding context for translators](./howtos.md#adding-context-for-translators).
If you are a translator and a string is unclear, open an issue that names the
string. You can also add the comment yourself in a pull request.
