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

// Reads the wiki pages that drive labels. The pages are indexed at
// https://github.com/apache/superset/wiki/Labeling-Automation
//
// wiki-labeler.yml uses this to apply labels, and wiki-labels-lint.yml uses
// it to check a page after every wiki edit, so both read a page the same way.
//
// On every page a `## heading` is a label and the list items under it are
// that label's entries. Anything above the first horizontal rule (the
// editing notes) and anything that is not a heading or a list item is prose.

// Wiki edits are not reviewed, and some labels drive other workflows (`hold`
// blocks merges, the showtime labels start environments). So each page can
// only assign the labels allowed here: growing a list on the wiki needs no
// PR, while letting a page assign a new kind of label does.
const PAGES = {
  rosters: {
    page: 'Label-Rosters',
    entries: 'handles',
    allowed: ['utsc2026'],
    allows: '`utsc2026`',
  },
  holds: {
    page: 'Audit-Hold-Paths',
    entries: 'globs',
    allowed: [/^hold:audit-[a-z0-9-]+$/],
    allows: 'labels starting with `hold:audit-`',
  },
};

const HANDLE = /^@?([A-Za-z0-9-]+(?:\[bot\])?)$/;

function isAllowed(kind, label) {
  return PAGES[kind].allowed.some(rule =>
    rule instanceof RegExp ? rule.test(label) : rule === label,
  );
}

/**
 * Parse one page.
 *
 * Returns `rules`, a Map of label -> entries holding only what CI acts on
 * (allowed labels, well-formed entries), and `problems`, a list of
 * `{ line, message }` for everything an editor most likely got wrong.
 * Applying labels uses `rules` and carries on past the problems; the lint
 * job fails on them.
 */
function parse(kind, text) {
  const { page, entries, allows } = PAGES[kind];
  const lines = text.split(/\r?\n/);
  const problems = [];
  const sections = [];

  // The editing notes sit above a horizontal rule and use headings and
  // lists of their own; skip them when the rule is there.
  const rule = lines.findIndex(line => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line));
  let section = null;
  let fenced = false;

  lines.forEach((line, index) => {
    const number = index + 1;
    if (index <= rule) return;
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;

    const heading = line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const label = heading[1].replace(/^`(.*)`$/, '$1').trim();
      section = { label, line: number, values: [] };
      sections.push(section);
      return;
    }
    if (/^#\s/.test(line)) {
      section = null;
      return;
    }

    const item = line.match(/^\s*[-*+]\s+(.*?)\s*$/);
    if (!item || !section) return;
    const quoted = /^`.*`$/.test(item[1]);
    const value = item[1].replace(/^`(.*)`$/, '$1').trim();

    if (entries === 'handles') {
      const handle = value.match(HANDLE);
      if (handle) {
        section.values.push(handle[1].toLowerCase());
      } else {
        problems.push({
          line: number,
          message: `"${value}" is not a GitHub handle. Put one handle on each list item.`,
        });
      }
      return;
    }

    // Path pages: an item starting with `@` names a person, and an item
    // with spaces that is not in backticks is a note. Neither is read.
    if (value.startsWith('@')) return;
    if (!quoted && /\s/.test(value)) return;
    if (!value || /\s/.test(value)) {
      problems.push({
        line: number,
        message: `"${value}" is not a path pattern. Use one pattern per list item, with no spaces.`,
      });
    } else if (/^\.?\//.test(value) || value.includes('\\')) {
      problems.push({
        line: number,
        message: `"${value}" will never match. Patterns are relative to the repository root, with no leading "/" or "./", and use "/" between folders.`,
      });
    } else {
      section.values.push(value);
    }
  });

  const rules = new Map();
  for (const { label, line, values } of sections) {
    if (!isAllowed(kind, label)) {
      problems.push({
        line,
        message: `The ${page} page cannot assign the label "${label}", so CI ignores this section. Allowed here: ${allows}. Allowing another label takes a PR to .github/scripts/wiki-labels.js.`,
      });
      continue;
    }
    if (rules.has(label)) {
      problems.push({
        line,
        message: `"${label}" has more than one section. CI merges them; keep one.`,
      });
    }
    if (!values.length) {
      problems.push({
        line,
        message: `"${label}" has no ${entries === 'handles' ? 'handles' : 'path patterns'} under it, so it is never applied.`,
      });
      continue;
    }
    rules.set(label, [...new Set([...(rules.get(label) ?? []), ...values])]);
  }

  if (!sections.length) {
    problems.push({
      line: 1,
      message: `No "## label" sections found on the ${page} page.`,
    });
  }

  return { rules, problems };
}

function pageUrl(owner, repo, kind) {
  return `https://raw.githubusercontent.com/wiki/${owner}/${repo}/${PAGES[kind].page}.md`;
}

/** Fetch a page's markdown. Throws if it cannot be read. */
async function fetchPage(owner, repo, kind) {
  const url = pageUrl(owner, repo, kind);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not read ${url} (HTTP ${response.status})`);
  }
  return response.text();
}

/** Labels whose roster lists this login. */
function rosterLabels(rules, login) {
  const handle = login.toLowerCase();
  return [...rules.keys()].filter(label => rules.get(label).includes(handle));
}

/** Path rules in the shape actions/labeler reads as its configuration. */
function labelerConfig(rules) {
  const config = {};
  for (const [label, globs] of rules) {
    config[label] = [{ 'changed-files': [{ 'any-glob-to-any-file': globs }] }];
  }
  return config;
}

module.exports = {
  PAGES,
  fetchPage,
  labelerConfig,
  pageUrl,
  parse,
  rosterLabels,
};
