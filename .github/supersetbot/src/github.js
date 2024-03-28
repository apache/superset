import fs from 'fs';
import os from 'os';
import path from 'path';

import toml from 'toml';
import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';

import { ORG_LIST, PROTECTED_LABEL_PATTERNS, COMMITTER_TEAM } from './metadata.js';
import { runShellCommand, shuffleArray } from './utils.js';

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
      .filter((label) => prefixes.some((s) => typeof (label) === 'string' && label.startsWith(s)));

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

  async createAllBumpPRs({
    verbose = false, dryRun = false, useCurrentRepo = false, limit = null, shuffle = true,
    group = null,
  }) {
    const cwd = process.cwd();
    const tomlFilePath = path.join(cwd, 'pyproject.toml');

    try {
      const data = await fs.promises.readFile(tomlFilePath, 'utf8');
      // Parse the TOML data
      const parsedData = toml.parse(data);

      let prsCreated = 0;
      let deps = parsedData.project.dependencies;
      if (group) {
        console.log(`Processing group: ${group}`);
        const optDeps = parsedData.project['optional-dependencies'];
        if (group === 'all') {
          deps = Object.keys(optDeps).flatMap((k) => optDeps[k]);
        } else {
          deps = optDeps[group];
        }
      }
      if (shuffle) {
        deps = shuffleArray(deps);
      }
      console.log('Processing libraries:', deps);

      // Assuming dependencies is an array; if it's an object, you'll need to adjust this.
      /* eslint-disable no-restricted-syntax, no-await-in-loop */
      for (const libRange of deps) {
        const pythonPackage = libRange.match(/^[^>=<;[\s]+/)[0];
        console.log(`Processing library: ${pythonPackage}`);
        const url = await this.createBumpLibPullRequest({
          pythonPackage, verbose, dryRun, useCurrentRepo,
        });
        if (url) {
          prsCreated += 1;
        }
        if (limit && prsCreated >= limit) {
          break;
        }
      }
    } catch (err) {
      console.error('ERROR:', err);
    }
  }

  async searchExistingPRs(branchName) {
    const owner = this.context.repo.split('/')[0];
    const resp = await this.octokit.rest.pulls.list({
      ...this.unPackRepo(),
      state: 'open',
      head: `${owner}:${branchName}`,
    });
    return resp.data;
  }

  processPythonReqsDiffOutput(rawOutput) {
    const lines = rawOutput.split('\n');
    const result = {};

    lines.forEach((line) => {
      // Filter out lines that do not contain a change in library version
      if (!line.includes('==')) {
        return;
      }

      const isDeletion = line.startsWith('-');
      const isAddition = line.startsWith('+');
      if (isDeletion || isAddition) {
        // Extract lib name and version
        const [pythonPackage, version] = line.slice(1).split('==');
        const lib = pythonPackage.toLowerCase();

        // Ensure the lib entry exists in the result object
        if (!result[lib]) {
          result[lib] = { before: null, after: null };
        }

        // Update the lib version based on the line type
        if (isDeletion) {
          result[lib].before = version;
        } else if (isAddition) {
          result[lib].after = version;
        }
      }
    });

    return result;
  }

  async fixReqsFile(filePath) {
    // Somehow pip-compile-multi generates replaces the '-e file:.' with a hard-coded local path
    // hoping they fix it in the future. In the meantime we can fix it here.
    try {
      // Read the file
      const content = await fs.promises.readFile(filePath, { encoding: 'utf-8' });

      let needsUpdate = false;
      // Process each line
      const updatedLines = content.split('\n').map((line) => {
        if (line.startsWith('-e file:') && !line.startsWith('-e file:.')) {
          needsUpdate = true;
          return '-e file:.';
        }
        return line;
      });

      // Join the lines back and write to the file
      if (needsUpdate) {
        await fs.promises.writeFile(filePath, updatedLines.join('\n'), { encoding: 'utf-8' });
      }
    } catch (error) {
      console.error('Error updating the file:', error);
    }
  }

  async createBumpLibPullRequest({
    pythonPackage, verbose = false, dryRun = false, useCurrentRepo = false,
  }) {
    const cwd = './';
    const lib = pythonPackage.toLowerCase();
    const shellOptions = {
      cwd, verbose, raiseOnError: true, exitOnError: false,
    };

    if (!useCurrentRepo) {
      shellOptions.cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'update-'));
      if (verbose) {
        console.log('CWD:', shellOptions.cwd);
      }

      // Clone the repo
      await runShellCommand({ command: `git clone --depth 1 git@github.com:${this.context.repo}.git ${shellOptions.cwd}`, ...shellOptions });
    } else {
      await runShellCommand({ command: 'git checkout master', ...shellOptions });
      await runShellCommand({ command: 'git reset --hard', ...shellOptions });
      await runShellCommand({ command: 'git clean -f', ...shellOptions });
    }

    // Run pip-compile-multi
    await runShellCommand({ command: `pip-compile-multi --use-cache -P ${lib}`, ...shellOptions });
    await this.fixReqsFile(path.join(shellOptions.cwd, 'requirements/base.txt'));
    await this.fixReqsFile(path.join(shellOptions.cwd, 'requirements/development.txt'));

    // Diffing
    let rawDiff = await runShellCommand({ command: 'git diff --color=never --unified=0', ...shellOptions });
    rawDiff = rawDiff.stdout;

    const libsBeforeAfter = this.processPythonReqsDiffOutput(rawDiff);
    const before = libsBeforeAfter[lib]?.before;
    const after = libsBeforeAfter[lib]?.after;

    if (verbose && rawDiff) {
      console.log('Diff:', rawDiff);
      console.log('Libs before/after:', libsBeforeAfter);
    }

    if (before === after) {
      console.log('No changes detected... skipping.');
    } else {
      console.log(`Changes detected for "${lib}": ${before} -> ${after}`);

      // Create branch
      const branchName = `supersetbot-bump-${lib}`;
      await runShellCommand({ command: `git checkout -b ${branchName}`, ...shellOptions });

      // Commit changes
      await runShellCommand({ command: 'git add .', ...shellOptions });
      const commitMessage = `chore(🦾): bump python ${lib} ${before} -> ${after}`;
      await runShellCommand({ command: `git commit -m "${commitMessage}"`, ...shellOptions });

      if (dryRun) {
        console.log(`Skipping PR creation for "${lib}" due to dry-run mode.`);
      } else {
        // Push changes
        await runShellCommand({ command: `git push -f origin ${branchName}`, ...shellOptions });
        const existingPRs = await this.searchExistingPRs(branchName);
        if (existingPRs.length === 0) {
          try {
            // Create a PR
            const resp = await this.octokit.pulls.create({
              ...this.unPackRepo(),
              title: commitMessage,
              head: branchName,
              base: 'master',
              body: `Updates the python "${lib}" library version from ${before} to ${after}. \n\nGenerated by @supersetbot 🦾`,
            });
            console.log(`Pull request created: ${resp.data.html_url}`);
            return resp.data.html_url;

						// Labeling the PR
						await this.octokit.issues.addLabels({
							...this.unPackRepo(),
							issue_number: prNumber,
							labels: ['supersetbot'],
						});

            // This is stupid, but it's one of the only way to trigger the CI checks
            console.log('Close/reopen the PR to trigger the CI checks.');
            const prNumber = createResp.data.number;
            await this.octokit.pulls.update({
              ...this.unPackRepo(),
              pull_number: prNumber,
              state: 'closed',
            });
            await this.octokit.pulls.update({
              ...this.unPackRepo(),
              pull_number: prNumber,
              state: 'open',
            });

          } catch (error) {
            console.error(error);
            throw error; // Rethrow the error if you want the caller to handle it
          }
        } else {
          console.log('PR already exists:', existingPRs[0].html_url);
        }
      }
    }
    // Cleaning up
    if (!useCurrentRepo) {
      fs.rmSync(shellOptions.cwd, { recursive: true, force: true });
    }
    return null;
  }
}

export default Github;
