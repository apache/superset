import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import path from 'path';

import toml from 'toml';
import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';

import { ORG_LIST, PROTECTED_LABEL_PATTERNS, COMMITTER_TEAM } from './metadata.js';
import { runShellCommand } from './utils.js';

class Github {
  #userInTeamCache;

  constructor({ context, issueNumber = null, token = null }) {
    this.context = context;
    this.issueNumber = issueNumber;
    const githubToken = token || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      const msg = 'GITHUB_TOKEN is not set';
      this.context.logError(msg);
    }
    const throttledOctokit = Octokit.plugin(throttling);
    // eslint-disable-next-line new-cap
    this.octokit = new throttledOctokit({
      auth: githubToken,
      throttle: {
        id: 'supersetbot',
        onRateLimit: (retryAfter, options, octokit, retryCount) => {
          const howManyRetries = 10;
          octokit.log.warn(`Retry ${retryCount} out of ${howManyRetries} - retrying in ${retryAfter} seconds!`);
          if (retryCount < howManyRetries) {
            return true;
          }
          return false;
        },
        onSecondaryRateLimit: (retryAfter, options, octokit) => {
          octokit.log.warn(`SecondaryRateLimit detected for request ${options.method} ${options.url}`);
        },
      },
    });
    this.syncLabels = this.syncLabels.bind(this);
    this.#userInTeamCache = new Map();
  }

  unPackRepo() {
    const [owner, repo] = this.context.repo.split('/');
    return { repo, owner };
  }

  async label(issueNumber, label, actor = null, verbose = false, dryRun = false) {
    let hasPerm = true;
    if (actor && Github.isLabelProtected(label)) {
      hasPerm = await this.checkIfUserInTeam(actor, COMMITTER_TEAM, verbose);
    }
    if (hasPerm) {
      const addLabelWrapped = this.context.commandWrapper({
        func: this.octokit.rest.issues.addLabels,
        successMsg: `label "${label}" added to issue ${issueNumber}`,
        verbose,
        dryRun,
      });
      await addLabelWrapped({
        ...this.unPackRepo(),
        issue_number: issueNumber,
        labels: [label],
      });
    }
  }

  async createComment(body) {
    if (this.issueNumber) {
      await this.octokit.rest.issues.createComment({
        ...this.unPackRepo(),
        body,
        issue_number: this.issueNumber,
      });
    }
  }

  async unlabel(issueNumber, label, actor = null, verbose = false, dryRun = false) {
    let hasPerm = true;
    if (actor && Github.isLabelProtected(label)) {
      hasPerm = await this.checkIfUserInTeam(actor, COMMITTER_TEAM, verbose);
    }
    if (hasPerm) {
      const removeLabelWrapped = this.context.commandWrapper({
        func: this.octokit.rest.issues.removeLabel,
        successMsg: `label "${label}" removed from issue ${issueNumber}`,
        verbose,
        dryRun,
      });
      await removeLabelWrapped({
        ...this.unPackRepo(),
        issue_number: issueNumber,
        name: label,
      });
    }
  }

  async assignOrgLabel(issueNumber, verbose = false, dryRun = false) {
    const issue = await this.octokit.rest.issues.get({
      ...this.unPackRepo(),
      issue_number: issueNumber,
    });
    const username = issue.data.user.login;
    const orgs = await this.octokit.orgs.listForUser({ username });
    const orgNames = orgs.data.map((v) => v.login);

    // get list of matching github orgs
    const matchingOrgs = orgNames.filter((org) => ORG_LIST.includes(org));
    if (matchingOrgs.length) {
      const wrapped = this.context.commandWrapper({
        func: this.octokit.rest.issues.addLabels,
        successMsg: `added label(s) ${matchingOrgs} to issue ${issueNumber}`,
        errorMsg: "couldn't add labels to issue",
        verbose,
        dryRun,
      });
      wrapped({
        ...this.unPackRepo(),
        issue_number: issueNumber,
        labels: matchingOrgs,
      });
    }
  }

  async searchMergedPRs({
    query = '',
    onlyUnlabeled = true,
    verbose = false,
    startPage = 0,
    pages = 5,
  }) {
    // look for PRs
    let q = `repo:${this.context.repo} is:merged ${query}`;
    if (onlyUnlabeled) {
      q = `${q} -label:"🏷️ bot"`;
    }
    if (verbose) {
      this.context.log(`Query: ${q}`);
    }
    let prs = [];
    for (let i = 0; i < pages; i += 1) {
      if (verbose) {
        this.context.log(`Fetching PRs to process page ${i + 1} out of ${pages}`);
      }
      // eslint-disable-next-line no-await-in-loop
      const data = await this.octokit.search.issuesAndPullRequests({
        q,
        per_page: 100,
        page: startPage + i,
      });
      prs = [...prs, ...data.data.items];
    }
    if (verbose) {
      this.context.log(`Fetched ${prs.length}`);
    }
    return prs;
  }

  async syncLabels({
    labels,
    prId,
    actor = null,
    verbose = false,
    dryRun = false,
    existingLabels = null,
  }) {
    if (verbose) {
      this.context.log(`[PR: ${prId}] - sync labels ${labels}`);
    }
    let hasPerm = true;
    if (actor) {
      hasPerm = await this.checkIfUserInTeam(actor, COMMITTER_TEAM, verbose);
    }
    if (!hasPerm) {
      return;
    }
    let targetLabels = existingLabels;
    if (targetLabels === null) {
      // No labels have been passed as an array, so checking against GitHub
      const resp = await this.octokit.issues.listLabelsOnIssue({
        ...this.unPackRepo(),
        issue_number: prId,
      });
      targetLabels = resp.data.map((l) => l.name);
    }

    if (verbose) {
      this.context.log(`[PR: ${prId}] - target release labels: ${labels}`);
      this.context.log(`[PR: ${prId}] - existing labels on issue: ${existingLabels}`);
    }

    // Extract existing labels with the given prefixes
    const prefixes = ['🚢', '🍒', '🎯', '🏷️'];
    const existingPrefixLabels = targetLabels
      .filter((label) => prefixes.some((s) => typeof(label) === 'string' && label.startsWith(s)));

    // Labels to add
    const labelsToAdd = labels.filter((label) => !existingPrefixLabels.includes(label));
    if (verbose) {
      this.context.log(`[PR: ${prId}] - labels to add: ${labelsToAdd}`);
    }
    // Labels to remove
    const labelsToRemove = existingPrefixLabels.filter((label) => !labels.includes(label));
    if (verbose) {
      this.context.log(`[PR: ${prId}] - labels to remove: ${labelsToRemove}`);
    }

    // Add labels
    if (labelsToAdd.length > 0 && !dryRun) {
      await this.octokit.issues.addLabels({
        ...this.unPackRepo(),
        issue_number: prId,
        labels: labelsToAdd,
      });
    }

    // Remove labels
    if (labelsToRemove.length > 0 && !dryRun) {
      await Promise.all(labelsToRemove.map((label) => this.octokit.issues.removeLabel({
        ...this.unPackRepo(),
        issue_number: prId,
        name: label,
      })));
    }
    this.context.logSuccess(`synched labels for PR ${prId} with labels ${labels}`);
  }

  async checkIfUserInTeam(username, team, verbose = false) {
    let isInTeam = this.#userInTeamCache.get([username, team]);
    if (isInTeam !== undefined) {
      return isInTeam;
    }

    const [org, teamSlug] = team.split('/');
    const wrapped = this.context.commandWrapper({
      func: this.octokit.teams.getMembershipForUserInOrg,
      errorMsg: `User "${username}" is not authorized to alter protected labels.`,
      verbose,
    });
    const resp = await wrapped({
      org,
      team_slug: teamSlug,
      username,
    });
    isInTeam = resp?.data?.state === 'active';
    this.#userInTeamCache.set([username, team], isInTeam);
    return isInTeam;
  }

  static isLabelProtected(label) {
    return PROTECTED_LABEL_PATTERNS.some((pattern) => new RegExp(pattern).test(label));
  }

  async createAllBumpPRs(verbose = false, dryRun = false) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const tomlFilePath = path.join(__dirname, '../../..', 'pyproject.toml');

    try {
      const data = await fs.promises.readFile(tomlFilePath, 'utf8');
      // Parse the TOML data
      const parsedData = toml.parse(data);

      // Assuming dependencies is an array; if it's an object, you'll need to adjust this.
      console.log("YOYOYO", parsedData.project.dependencies);
      for (const libRange of parsedData.project.dependencies) {
        const lib = libRange.match(/^[^>=<;\[\s]+/)[0];
        console.log(`Processing library: ${lib}`);
        await this.createBumpLibPullRequest(lib, verbose, dryRun);
      }
    } catch (err) {
      console.error('Error reading or parsing the TOML file:', err);
    }
  }

  async createBumpLibPullRequest(lib, verbose = false, dryRun = false) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'update-'));
    console.log("CWD:", cwd);

    // Clone the repo
    await runShellCommand({ command: `git clone --depth 1 https://github.com/:${this.context.repo} .`, cwd, verbose });

    // Run pip-compile-multi
    await runShellCommand({ command: `pip-compile-multi -P ${lib}`, cwd });

    // Diffing
    const diffResults = await runShellCommand({ command: 'git diff --color=never --unified=0', cwd, raiseOnError: false, verbose, exitOnError: false });

    const changed = diffResults.stdout.trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('+' + lib))
      .map((line) => line.substring(1));

    if (changed.length === 0) {
      console.log('No changes detected... skipping.');
    } else {

      console.log("LIB:", changed[0]);

      // Create branch
      const branchName = `supersetbot-bump-${changed[0]}`;
      await runShellCommand({ command: `git checkout -b ${branchName}`, cwd, verbose });

      // Commit changes
      await runShellCommand({ command: `git add .`, cwd });
      const commitMessage = `chore(🤖): bump python "${changed[0]}"`;
      await runShellCommand({ command: `git commit -m "${commitMessage}"`, cwd, verbose });

      if (!dryRun) {

        // Push changes
        await runShellCommand({ command: `git push origin ${branchName}`, cwd, verbose });

        // Create a PR
        this.octokit.pulls.create({
            ...this.unPackRepo(),
            title: commitMessage,
            head: branchName,
            base: 'master',
            body: `Updates the python "${lib}" library version. \n\nGenerated by @supersetbot 🤖`,
        })
        .then(({ data }) => {
            console.log(`Pull request created: ${data.html_url}`);
        })
        .catch(console.error);

      }
    }
    // Cleaning up
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

export default Github;
