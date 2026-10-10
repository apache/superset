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

This page describes what to translate and how a language decides on its terms.
For the mechanics, such as extracting strings, updating catalogs, compiling and
the AI backfill, see [Contributing Translations](./howtos.md#contributing-translations).

Contributors translate Superset one language at a time. Each language meets the
same problems on its own. The rules on this page help each language avoid them.
When a language records a decision, the next contributor does not need to argue
it again.

## When to keep the English term

Translate into natural language by default. Keep the English term only in these
three cases:

1. **Proper nouns and product names.** For example, Superset itself, and the
   names of databases, engines and other products.
2. **Strings that a program reads.** For example, SQL keywords, enum and option
   values, API field names, icon names and example values. A translation of
   these strings breaks Superset. The registry
   `superset/translations/do-not-translate.txt` lists them. Inside any
   translated string, keep format placeholders such as `%(name)s` and `{name}`
   exactly as they are.
3. **Terms from the user's other tools.** For example, `Host`, `Slug`,
   `Backend` or the name of a data warehouse. The user also sees these words in
   their database and infrastructure tools. If Superset translates them, the
   user cannot connect the two names.

The third case needs judgement. Ask this question: does the user see the same
word in the tool they came from? If yes, the English term usually helps them
more than a translation.

## One term for each concept

Before you choose a translation for a term, check which other concepts use the
same word in the catalog.

For example, in some languages the natural translation of "dashboard" is a
word-for-word translation of *control panel*. Explore also has a control panel.
Then one word means two different things. Spanish, Romanian and Serbian use the
same words for both concepts.

To check, search the catalog for the word before you use it. A review of single
strings does not find this problem, because each string looks correct alone.

## Decisions for the whole language

Some decisions apply to the whole catalog of a language:

- **Register.** The UI uses formal or informal language with the user. For
  example, Spanish uses *tú* or *usted*.
- **Gendered forms.** The language decides how to write nouns for people, and
  whether it uses an inclusive form.
- **Other style choices.** For example, Russian keeps *ё* or writes *е*. Each
  language also decides whether a one-sentence message has a final full stop.

Make each decision once for the language, and record it. If a language has no
recorded decision yet, follow the form that most of its catalog already uses.

## How a language decides

- **Count first.** When a term has different translations in a catalog, count
  how many times each one appears. Usually the most common form is the right
  choice, and then the discussion is short.
- **Native speakers decide.** Native speakers of the language make the decision,
  by lazy consensus.
- **Write the reasoning.** Write which other options you rejected and why. Then
  the next contributor can read the reasoning and does not need to start the
  discussion again.
- **Use a separate pull request.** Change an agreed term in its own pull
  request. Then reviewers see it as a terminology decision.

## Recording a decision

Record a terminology decision in the description of the pull request that makes
it. Write the term, the translation that it replaces, the count, and the options
that you rejected. Contributors can then find the decision in the merged pull
request.

## Context for a single string

The rules above apply to a whole catalog. Sometimes one string is unclear
without its code. In that case, add an `i18n:` comment to the string. See
[Adding context for translators](./howtos.md#adding-context-for-translators).
That section also lists the comment positions that pybabel ignores.
