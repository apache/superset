import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';

import { ORG_LIST, PROTECTED_LABEL_PATTERNS, COMMITTER_TEAM } from './metadata.js';

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
}

export default Github;
