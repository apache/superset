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

This page covers **what** to translate and how terminology decisions get made.
For the mechanics — extracting strings, updating catalogs, compiling, and the AI
backfill — see [Contributing Translations](./howtos.md#contributing-translations).

Superset is translated by contributors working one language at a time, and the
same handful of traps recur in every language independently. These principles
exist so that each language does not have to rediscover them, and so a decision
argued once does not get re-argued by the next contributor.

## Translate for fluency by default

Translate into natural, idiomatic language. Keep the English term only when it
falls into one of three categories:

1. **Proper nouns and product names.** Superset itself, and the names of
   databases, engines and third-party products.
2. **Code-level tokens.** SQL keywords, format placeholders, enum and option
   values, API field names, icon names, and example values. These are
   machine-consumed: translating them breaks behavior. They are registered in
   `superset/translations/do-not-translate.txt`.
3. **External-ecosystem vocabulary.** Terms the user also meets outside
   Superset, in their own database and infrastructure tooling — `Host`, `Slug`,
   `Backend`, a warehouse name. Translating these severs the connection between
   what Superset calls a thing and what the user's other tools call it.

Category 3 is a judgement call, and it is the one to argue about. Ask whether a
user would see the same word in the tool they came from. If they would, keeping
it in English usually helps them more than a fluent rendering does.

## One term per concept, and one concept per term

Before settling on a rendering, check it against the other concepts that could
plausibly claim the same word.

The recurring example: in many languages the most natural translation of
"dashboard" is a calque of *control panel*. That rendering then collides with
Explore's actual control panel, and one term ends up carrying two unrelated
concepts. Spanish, Romanian and Serbian each render both concepts with the same
words.

The check is cheap — search the catalog for the candidate term before adopting
it — and it catches the defect that per-string review cannot, because no single
entry looks wrong on its own.

## Declare register and gendered forms once, per language

Two decisions apply to an entire catalog rather than to any one string:

- **Register.** Whether the UI addresses the user formally or informally
  (for example *tú* or *usted* in Spanish).
- **Gendered forms.** How the language handles gendered nouns referring to
  people, and whether it adopts an inclusive form.

Other language-wide style choices belong in the same record. Examples are
whether Russian keeps *ё* or writes *е*, and whether a one-sentence message
keeps its final full stop.

Decide these once per language and record them. Until a language has recorded a
decision, follow the convention that already dominates its catalog rather than
introducing a second one.

## Decide by native-speaker consensus, on counted evidence

- **Count before arguing.** When a term is rendered inconsistently, count the
  existing uses. A convention that already covers most of a catalog is usually
  the one to standardise on, and counting settles most disputes without appeal
  to taste.
- **Native speakers decide.** A terminology change for a language is settled by
  native speakers of that language, by lazy consensus.
- **Record the reasoning, not just the conclusion.** State which alternatives
  were rejected and why. The next contributor should be able to read the
  reasoning instead of reopening the debate.
- **Change a settled term in its own pull request**, so the change is reviewable
  as a terminology decision rather than buried in unrelated work.

## Recording a decision

Terminology decisions are recorded in the pull request that makes them. Write
the reasoning in the PR description — the term, what it replaces, the count that
motivated it, and the alternatives rejected — so it can be found later by
searching the repository history.

## Giving translators context for a single string

The principles above are catalog-wide. When one specific string is ambiguous out
of context, attach the context to the string itself with an `i18n:` comment; see
[Adding context for translators](./howtos.md#adding-context-for-translators).
Where the comment sits decides whether it reaches the catalog, and that section
lists the placements that drop it.
