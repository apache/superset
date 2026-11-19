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

// Reads the wiki pages that drive labels and review requests. The pages are
// indexed at https://github.com/apache/superset/wiki/Labeling-Automation
//
// wiki-labeler.yml calls the functions at the bottom of this file to apply
// labels and request reviews, and wiki-labels-lint.yml calls `lintPages`
// after every wiki edit, so all of them read a page the same way.
//
// The page format, kept simple on purpose:
//   ---                 everything above the first `---` line is editing notes
//   ## some-label       a label
//   - entry             one of its entries (a handle, or a path pattern)
//   Reviewers:          the list under this line names reviewers instead
//   - @handle
// Any other line is prose and is not read.

const fs = require('fs');
const path = require('path');

// Wiki edits are not reviewed, so each page is limited in what it can
// assign. `labels` are exact names, `prefixes` are name prefixes, and
// `anyLabel` lets the page name its own labels, minus the reserved ones
// (see `isReserved`).
const PAGES = {
  rosters: {
    page: 'Label-Rosters',
    entries: 'handles',
    labels: ['utsc2026'],
    allows: '`utsc2026`',
  },
  holds: {
    page: 'Audit-Hold-Paths',
    entries: 'globs',
    prefixes: ['hold:audit-'],
    allows: 'labels starting with `hold:audit-`',
  },
  paths: {
    page: 'Path-Labels',
    entries: 'globs',
    anyLabel: true,
    allows:
      'any label of 1 to 50 characters that does not contain "hold", is not a showtime label, and is not assigned by another page',
  },
};

const REVIEWER_LIST_NAMES = ['reviewers', 'reviewer', 'auditors', 'auditor'];
const HANDLE_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789-';
const BOT_SUFFIX = '[bot]';

// GitHub caps how many reviewers a PR can have, and nobody wants a wiki
// edit to page the whole project.
const MAX_REVIEW_REQUESTS = 15;

// GitHub's limit on the length of a label name.
const MAX_LABEL_LENGTH = 50;

/**
 * Labels a page can never assign unless it is listed for that page above:
 * - anything containing "hold", because no-hold-label.yml blocks a merge
 *   on any label containing that word;
 * - the showtime labels, which start preview environments;
 * - a label another page owns.
 * The path labeler also removes its labels from PRs that do not match, so
 * this keeps a wiki edit from stripping those labels as well.
 */
function isReserved(kind, label) {
  const ownedElsewhere = Object.entries(PAGES).some(
    ([other, { labels = [] }]) =>
      other !== kind && labels.some(owned => owned.toLowerCase() === label.toLowerCase()),
  );
  return label.toLowerCase().includes('hold') || label.startsWith('🎪') || ownedElsewhere;
}

function mayAssign(kind, label) {
  const { labels = [], prefixes = [], anyLabel = false } = PAGES[kind];
  if (labels.includes(label)) return true;
  if (prefixes.some(prefix => label.startsWith(prefix) && label.length > prefix.length)) return true;
  // GitHub rejects empty label names and names over 50 characters.
  const validName = label.length > 0 && label.length <= MAX_LABEL_LENGTH;
  return anyLabel && validName && !isReserved(kind, label);
}

/** "`text`" -> "text"; anything else comes back trimmed. */
function unquote(text) {
  const trimmed = text.trim();
  const quoted = trimmed.length > 1 && trimmed.startsWith('`') && trimmed.endsWith('`');
  return quoted ? trimmed.slice(1, -1).trim() : trimmed;
}

/** "@Some-User" -> "some-user"; null if it is not a GitHub handle. */
function toHandle(text) {
  const login = (text.startsWith('@') ? text.slice(1) : text).toLowerCase();
  const name = login.endsWith(BOT_SUFFIX) ? login.slice(0, -BOT_SUFFIX.length) : login;
  const valid = name.length > 0 && [...name].every(char => HANDLE_CHARACTERS.includes(char));
  return valid ? login : null;
}

function hasWhitespace(text) {
  return text.includes(' ') || text.includes('\t');
}

/** What one line of a page is: a label heading, a list item, a list name, or prose. */
function readLine(line) {
  const text = line.trim();
  if (line.startsWith('## ')) {
    return { type: 'label', value: unquote(line.slice(3)) };
  }
  if (text.startsWith('- ') || text.startsWith('* ')) {
    const raw = text.slice(2).trim();
    return { type: 'item', value: unquote(raw), quoted: unquote(raw) !== raw };
  }
  // "Reviewers:", or "**Reviewers:**" for editors who like it bold.
  const plain = text.split('*').join('').trim();
  if (plain.endsWith(':')) {
    const name = plain.slice(0, -1).trim().toLowerCase();
    return { type: 'list', reviewers: REVIEWER_LIST_NAMES.includes(name) };
  }
  return { type: 'prose' };
}

/**
 * Parse one page.
 *
 * Returns `rules`, a Map of label -> entries holding only what CI acts on
 * (labels the page may assign, well-formed entries); `reviewers`, a Map of
 * label -> handles for the labels in `rules` that name reviewers; and
 * `problems`, a list of `{ line, message }` for everything an editor most
 * likely got wrong. Applying labels uses `rules` and carries on past the
 * problems; the lint job fails on them.
 */
function parse(kind, text) {
  const { page, entries, allows } = PAGES[kind];
  const lines = text.split('\n').map(line => line.trimEnd());
  const problems = [];
  const sections = [];

  const firstRule = lines.findIndex(line => line.trim() === '---');
  let section = null;
  let listingReviewers = false;

  lines.forEach((line, index) => {
    if (index <= firstRule) return;
    const number = index + 1;
    const { type, value, quoted, reviewers } = readLine(line);

    if (type === 'label') {
      section = { label: value, line: number, values: [], reviewers: [] };
      sections.push(section);
      listingReviewers = false;
    } else if (type === 'list') {
      listingReviewers = reviewers;
    } else if (type === 'item' && section) {
      // On a path page an `@handle` is a reviewer wherever it is listed.
      const isReviewer = listingReviewers || (entries === 'globs' && value.startsWith('@'));
      if (isReviewer || entries === 'handles') {
        const handle = toHandle(value);
        if (!handle) {
          problems.push({
            line: number,
            message: `"${value}" is not a GitHub handle. Put one handle on each list item.`,
          });
        } else if (isReviewer) {
          section.reviewers.push(handle);
        } else {
          section.values.push(handle);
        }
      } else if (hasWhitespace(value)) {
        // A list item with spaces is a note, unless backticks say it was
        // meant as a pattern.
        if (quoted) {
          problems.push({
            line: number,
            message: `"${value}" is not a path pattern. Use one pattern per list item, with no spaces.`,
          });
        }
      } else if (value.startsWith('/') || value.startsWith('./') || value.includes('\\')) {
        problems.push({
          line: number,
          message: `"${value}" will never match. Patterns are relative to the repository root, with no leading "/" or "./", and use "/" between folders.`,
        });
      } else if (value) {
        section.values.push(value);
      }
    }
  });

  const rules = new Map();
  const reviewers = new Map();
  for (const { label, line, values, reviewers: people } of sections) {
    if (!mayAssign(kind, label)) {
      problems.push({
        line,
        message: `The ${page} page cannot assign the label "${label}", so CI ignores this section. Allowed here: ${allows}. Changing that takes a PR to .github/scripts/wiki-labels.js.`,
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
    if (people.length) {
      reviewers.set(label, [...new Set([...(reviewers.get(label) ?? []), ...people])]);
    }
  }

  if (!sections.length) {
    problems.push({
      line: 1,
      message: `No "## label" sections found on the ${page} page.`,
    });
  }

  return { rules, reviewers, problems };
}

/** Labels whose roster lists this login. */
function rosterLabels(rules, login) {
  const handle = login.toLowerCase();
  return [...rules.keys()].filter(label => rules.get(label).includes(handle));
}

/**
 * Who to ask for a review: the reviewers of every given label, minus anyone
 * in `skip` (the author, people already asked, people who already reviewed).
 */
function reviewersFor(reviewers, labels, skip = []) {
  const skipped = new Set(skip.map(login => login.toLowerCase()));
  const wanted = new Set();
  for (const label of labels) {
    for (const login of reviewers.get(label) ?? []) {
      if (!skipped.has(login)) wanted.add(login);
    }
  }
  return [...wanted];
}

/** Path rules in the shape actions/labeler reads as its configuration. */
function labelerConfig(rules) {
  const config = {};
  for (const [label, globs] of rules) {
    config[label] = [{ 'changed-files': [{ 'any-glob-to-any-file': globs }] }];
  }
  return config;
}

function pageUrl({ owner, repo }, kind) {
  return `https://raw.githubusercontent.com/wiki/${owner}/${repo}/${PAGES[kind].page}.md`;
}

/** Fetch and parse a page, warning about its problems. Throws if it cannot be read. */
async function readPage(kind, { context, core }) {
  const url = pageUrl(context.repo, kind);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not read ${url} (HTTP ${response.status})`);
  }
  const parsed = parse(kind, await response.text());
  for (const { line, message } of parsed.problems) {
    core.warning(`${PAGES[kind].page} line ${line}: ${message}`);
  }
  return parsed;
}

/** Like `readPage`, for pages whose labels are a courtesy: warns instead of throwing. */
async function readOptionalPage(kind, { context, core }) {
  try {
    return await readPage(kind, { context, core });
  } catch (error) {
    core.warning(`${error.message}; skipping the ${PAGES[kind].page} page.`);
    return { rules: new Map(), reviewers: new Map(), problems: [] };
  }
}

// ---------------------------------------------------------------------------
// Workflow steps. Each takes the `github`, `context` and `core` objects that
// actions/github-script provides.
// ---------------------------------------------------------------------------

/** wiki-labeler.yml: label a new PR or issue whose author is on a roster. */
async function labelRosterAuthor({ github, context, core }) {
  const target = context.payload.pull_request ?? context.payload.issue;
  const { rules } = await readOptionalPage('rosters', { context, core });
  const labels = rosterLabels(rules, target.user.login);
  if (labels.length) {
    await github.rest.issues.addLabels({ ...context.repo, issue_number: target.number, labels });
  }
}

/**
 * wiki-labeler.yml: turn the path pages into a configuration file for
 * actions/labeler. Sets the outputs `config` (the file) and `reviewers`
 * (label -> handles, as JSON).
 *
 * A page whose labels gate merges (`required`) must be readable and yield
 * rules, or this throws: the labeler removes a label whose paths no longer
 * match, so running it on an empty rule set would lift every hold. The
 * labeler leaves alone any label missing from its configuration, so
 * skipping an optional page removes nothing.
 */
async function writePathConfig({ context, core }, { required = ['holds'], optional = [] } = {}) {
  const rules = new Map();
  const reviewers = new Map();
  for (const kind of [...optional, ...required]) {
    const isRequired = required.includes(kind);
    const page = await (isRequired ? readPage : readOptionalPage)(kind, { context, core });
    if (isRequired && !page.rules.size) {
      throw new Error(`No rules found on ${pageUrl(context.repo, kind)}`);
    }
    page.rules.forEach((globs, label) => rules.set(label, globs));
    page.reviewers.forEach((people, label) => reviewers.set(label, people));
  }

  // JSON is valid YAML, so the labeler reads this file as-is.
  const file = path.join(process.env.RUNNER_TEMP, 'wiki-path-labels.yml');
  fs.writeFileSync(file, JSON.stringify(labelerConfig(rules), null, 2));
  core.setOutput('config', file);
  core.setOutput('reviewers', JSON.stringify(Object.fromEntries(reviewers)));
}

/**
 * wiki-labeler.yml: request reviews from the reviewers the pages name for
 * the PR's path labels and for the rosters its author is on. Never throws:
 * the labels are what gate a merge, and no-hold-label.yml needs the job to
 * succeed.
 */
async function requestReviews({ github, context, core }, pathReviewers) {
  const pull_number = context.payload.pull_request.number;
  try {
    const { data: pr } = await github.rest.pulls.get({ ...context.repo, pull_number });
    if (pr.draft || pr.state !== 'open') return;

    const reviewers = new Map(Object.entries(JSON.parse(pathReviewers || '{}')));
    const labels = pr.labels.map(label => label.name);
    const rosters = await readOptionalPage('rosters', { context, core });
    for (const label of rosterLabels(rosters.rules, pr.user.login)) {
      labels.push(label);
      reviewers.set(label, rosters.reviewers.get(label) ?? []);
    }

    const reviews = await github.paginate(github.rest.pulls.listReviews, {
      ...context.repo,
      pull_number,
      per_page: 100,
    });
    const asked = pr.requested_reviewers.map(user => user.login);
    const wanted = reviewersFor(reviewers, labels, [
      pr.user.login,
      ...asked,
      ...reviews.map(review => review.user?.login).filter(Boolean),
    ]);
    const room = Math.max(0, MAX_REVIEW_REQUESTS - asked.length);
    if (wanted.length > room) {
      core.warning(`Asking ${room} of the ${wanted.length} reviewers named on the wiki (limit ${MAX_REVIEW_REQUESTS} per PR).`);
    }

    // One request for everyone keeps the PR timeline short. GitHub rejects
    // the whole request if one login cannot be asked (not a collaborator,
    // say), so on a failure ask one person at a time.
    const ask = people =>
      github.rest.pulls.requestReviewers({ ...context.repo, pull_number, reviewers: people });
    const people = wanted.slice(0, room);
    if (!people.length) return;
    try {
      await ask(people);
    } catch {
      for (const login of people) {
        try {
          await ask([login]);
        } catch (error) {
          core.warning(`Could not request a review from @${login}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    core.warning(`Could not request reviews: ${error.message}`);
  }
}

/** wiki-labels-lint.yml: check every page in a checkout of the wiki at `dir`. */
async function lintPages({ github, context, core }, dir) {
  const { owner, repo } = context.repo;
  let existing = null;
  try {
    const labels = await github.paginate(github.rest.issues.listLabelsForRepo, {
      owner,
      repo,
      per_page: 100,
    });
    existing = new Set(labels.map(label => label.name));
  } catch (error) {
    core.warning(`Could not list the repository's labels (${error.message}).`);
  }

  const summary = [];
  let failures = 0;
  for (const [kind, { page }] of Object.entries(PAGES)) {
    const link = `https://github.com/${owner}/${repo}/wiki/${page}`;
    const file = path.join(dir, `${page}.md`);
    if (!fs.existsSync(file)) {
      failures += 1;
      core.error(`${page}: the page is missing from the wiki.`);
      summary.push(`### ${page}`, '', `The page is missing: ${link}`, '');
      continue;
    }

    const { rules, problems } = parse(kind, fs.readFileSync(file, 'utf8'));
    failures += problems.length;
    for (const { line, message } of problems) {
      core.error(`${page} line ${line}: ${message}`);
    }
    const fresh = existing ? [...rules.keys()].filter(label => !existing.has(label)) : [];
    for (const label of fresh) {
      core.notice(`${page}: the label "${label}" does not exist yet. GitHub creates it, plain grey, the first time it is applied.`);
    }

    summary.push(
      `### [${page}](${link})`,
      '',
      `${rules.size} label(s) read.`,
      '',
      ...problems.map(({ line, message }) => `- Line ${line}: ${message}`),
      ...fresh.map(label => `- Note: \`${label}\` does not exist yet and is created on first use.`),
      '',
    );
  }

  await core.summary.addRaw(summary.join('\n')).write();
  if (failures) {
    core.setFailed(`${failures} problem(s) on the wiki pages that drive labels. Fix the page; its edit history shows what changed.`);
  }
}

module.exports = {
  PAGES,
  isReserved,
  labelRosterAuthor,
  labelerConfig,
  lintPages,
  mayAssign,
  parse,
  requestReviews,
  reviewersFor,
  rosterLabels,
  writePathConfig,
};
