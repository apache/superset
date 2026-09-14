# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
Query craft that holds across every warehouse.

No engine is named here, and no dialect syntax appears. A prompt that hardcodes
one engine's functions, catalog layout or metadata tables produces confidently
invalid SQL on the next deployment, and the assistant has no way to tell that it
has done so. Dialect rules are deployment knowledge: they belong to a
:class:`~superset.ai.knowledge.KnowledgeProvider`, served for the engine actually
in play.

What survives the move between deployments is the partition-semantics trap, date
discipline, and the habit of reconciling a total before reporting it.

Partition semantics leads because it is the one that produces a *plausible*
wrong answer rather than an error: aggregating across snapshot partitions
inflates every total by roughly the number of partitions scanned, and nothing in
the result looks wrong.
"""

from __future__ import annotations

from superset.ai.prompts.assemble import CORE_SOURCE, PromptSection, SectionKind

_BODY = """
# SQL craft

## Partition semantics -- classify before you aggregate
Two very different layouts hide behind the same partition column:

- **Append / event-style**: each partition holds only the rows that arrived for
  it. Aggregating across a partition range is correct.
- **Snapshot / change-capture-style**: each partition holds a full or rolling
  copy of the dataset as of that partition. Aggregating across several partitions
  counts the same entity once per partition, so totals, sums and distinct counts
  come out inflated by roughly the number of partitions scanned. The result looks
  entirely reasonable, which is why this must be settled before the query runs.

Classify from documentation where it exists, otherwise with a cheap probe: row
counts for the last two or three partitions. Counts of a similar order of
magnitude mean snapshot; smaller counts that vary day to day mean append.

For a point-in-time question on a snapshot table, filter to a **single**
partition -- the newest one that actually exists, discovered rather than assumed.
For history across days, deduplicate on a stable key. State which semantics you
assumed in your answer.

Where the engine can list partition values as metadata, reading them that way is
far cheaper than scanning the table to find them. Discover what this engine
offers from a tool rather than assuming a syntax: the facility exists nearly
everywhere and is spelled differently in each place.

## Dates
- Always constrain the partition column, and constrain it first, so the engine
  prunes before it filters.
- Never assume the current date's partition exists. Discover the newest one:
  partitions land late, and the newest partition of an event table is incomplete
  for as long as the day is still running.
- A partition existing is not evidence that the data is current or complete.
  Do not claim freshness from partition existence alone; if freshness matters,
  check it against a published watermark or compare recent volumes against the
  same hours on earlier days.
- Compute relative dates from the authoritative date anchor, never from a
  remembered date. Match the column's actual type -- a partition column is often
  a string, and comparing it to a date silently scans everything.
- Say which timezone a reported window is in whenever a day boundary could
  change the answer.

## Keep the query legible
- Prefer several small queries to one deep stack of CTEs. Around five levels of
  nesting you can no longer tell which step is wrong, and independent queries run
  concurrently where one large query does not.
- Do not compute many time windows in a single scan over a large table. One small
  query per window, issued together, prunes independently and finishes sooner.
- Keep an explicit row limit on anything exploratory.

## Sanity-check before reporting
- Reconcile the headline figure against something already known -- a total, a
  prior period, an independent source. A number that survives one reconciliation
  is worth far more than one that was merely returned.
- Check row counts and distinct key counts. A total that is a clean multiple of
  what you expected is usually a join fanning out or snapshot partitions being
  summed.
- Check null rates on the columns doing the work. Nulls silently dropped by a
  join or a filter change the denominator, and the result stays plausible.
- A figure that is impossible is a data or query problem until proven otherwise.
  Investigate it rather than reporting it.
"""

SECTION = PromptSection(
    key="core.sql_conventions",
    body=_BODY,
    kind=SectionKind.KNOWLEDGE,
    source=CORE_SOURCE,
    order=50,
)
