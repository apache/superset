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

const assert = require('node:assert/strict');
const { test } = require('node:test');
const wiki = require('./wiki-labels.js');

const HOLDS = `
Editing notes, with a list CI must not read:
- \`not/a/rule/**\`

---

## hold:audit-config

What to check, in prose.
- a note with spaces is ignored

Paths:
- \`superset/config.py\`
- unquoted/**

Reviewers:
- @Alice
- bob
`;

test('reads labels, paths and reviewers below the first rule', () => {
  const { rules, reviewers, problems } = wiki.parse('holds', HOLDS);
  assert.deepEqual([...rules], [['hold:audit-config', ['superset/config.py', 'unquoted/**']]]);
  assert.deepEqual([...reviewers], [['hold:audit-config', ['alice', 'bob']]]);
  assert.deepEqual(problems, []);
});

test('an @handle on a path page is a reviewer even outside a Reviewers list', () => {
  const { rules, reviewers } = wiki.parse('holds', '## hold:audit-x\n- `a/**`\n- @carol\n');
  assert.deepEqual(rules.get('hold:audit-x'), ['a/**']);
  assert.deepEqual(reviewers.get('hold:audit-x'), ['carol']);
});

test('"Auditors:" still names reviewers, and bold list names work', () => {
  const { reviewers } = wiki.parse('holds', '## hold:audit-x\n- `a/**`\n**Auditors:**\n- dave\n');
  assert.deepEqual(reviewers.get('hold:audit-x'), ['dave']);
});

test('reports patterns that cannot work', () => {
  const { rules, problems } = wiki.parse(
    'holds',
    '## hold:audit-x\n- `two words`\n- /absolute/**\n- ./relative\n- ok/**\n',
  );
  assert.deepEqual(rules.get('hold:audit-x'), ['ok/**']);
  assert.deepEqual(problems.map(problem => problem.line), [2, 3, 4]);
});

test('ignores and reports a label the page may not assign', () => {
  const { rules, problems } = wiki.parse('holds', '## hold!\n- `a/**`\n## hold:audit-\n- `b/**`\n');
  assert.equal(rules.size, 0);
  assert.deepEqual(problems.map(problem => problem.line), [1, 3]);
});

test('reports empty and duplicate sections, and an empty page', () => {
  const { rules, problems } = wiki.parse(
    'holds',
    '## hold:audit-a\n## hold:audit-b\n- `b/**`\n## hold:audit-b\n- `c/**`\n',
  );
  assert.deepEqual([...rules], [['hold:audit-b', ['b/**', 'c/**']]]);
  assert.equal(problems.length, 2);
  assert.equal(wiki.parse('holds', 'just prose').problems.length, 1);
});

test('rosters: members and reviewers stay apart', () => {
  const page = '## utsc2026\nReviewers:\n- @Lead\nMembers:\n- Student-One\n- `student2`\n- not a handle\n';
  const { rules, reviewers, problems } = wiki.parse('rosters', page);
  assert.deepEqual(rules.get('utsc2026'), ['student-one', 'student2']);
  assert.deepEqual(reviewers.get('utsc2026'), ['lead']);
  assert.deepEqual(problems.map(problem => problem.line), [7]);
  assert.deepEqual(wiki.rosterLabels(rules, 'STUDENT-ONE'), ['utsc2026']);
  assert.deepEqual(wiki.rosterLabels(rules, 'lead'), []);
});

test('rosters: only allowlisted labels', () => {
  const { rules } = wiki.parse('rosters', '## hold\n- someone\n## utsc2026\n- someone\n');
  assert.deepEqual([...rules.keys()], ['utsc2026']);
});

test('reserved labels', () => {
  assert.equal(wiki.isReserved('holds', 'hold'), true);
  assert.equal(wiki.isReserved('holds', 'threshold'), true);
  assert.equal(wiki.isReserved('holds', '🎪 ⚡ showtime-trigger-start'), true);
  assert.equal(wiki.isReserved('holds', 'utsc2026'), true);
  assert.equal(wiki.isReserved('rosters', 'utsc2026'), false);
  assert.equal(wiki.isReserved('holds', 'doc'), false);
});

test('the path labels page names its own labels, minus the reserved ones', () => {
  const page = '## doc\n- `docs/**`\n## brand-new\n- `x/**`\n## hold!\n- `y/**`\n## utsc2026\n- `z/**`\n';
  const { rules, problems } = wiki.parse('paths', page);
  assert.deepEqual([...rules.keys()], ['doc', 'brand-new']);
  assert.deepEqual(problems.map(problem => problem.line), [5, 7]);
});

test('reviewersFor skips people and labels that do not apply', () => {
  const reviewers = new Map([
    ['a', ['x', 'y']],
    ['b', ['y', 'z']],
    ['c', ['w']],
  ]);
  assert.deepEqual(wiki.reviewersFor(reviewers, ['a', 'b', 'other'], ['X']), ['y', 'z']);
});

test('labelerConfig matches the shape actions/labeler reads', () => {
  assert.deepEqual(wiki.labelerConfig(new Map([['doc', ['docs/**']]])), {
    doc: [{ 'changed-files': [{ 'any-glob-to-any-file': ['docs/**'] }] }],
  });
});
