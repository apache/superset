import simpleGit from 'simple-git';
import semver from 'semver';

import GitRelease from './git_release.js';

export default class Git {
  #releaseTags;

  constructor(context, mainBranch = 'master') {
    this.context = context;
    this.mainBranch = mainBranch;
    this.releases = new Map();
    this.git = simpleGit();
    this.mainBranchGitRelease = this.mainBranchGitRelease.bind(this);
    this.getReleaseLabels = this.getReleaseLabels.bind(this);
  }

  async mainBranchGitRelease() {
    let rel = this.releases.get(this.mainBranch);
    if (!rel) {
      rel = await this.loadRelease(this.mainBranch);
    }
    return rel;
  }

  async releaseTags() {
    if (!this.#releaseTags) {
      const tags = await this.git.tags();
      // Filter tags to include only those that match semver and are official releases
      const semverTags = tags.all.filter((tag) => semver.valid(tag) && !tag.includes('-') && !tag.includes('v'));
      semverTags.sort((a, b) => semver.compare(a, b));
      this.#releaseTags = semverTags;
    }
    return this.#releaseTags;
  }

  async loadMainBranch() {
    await this.loadRelease(this.mainBranch);
  }

  async loadReleases(tags = null) {
    const tagsToFetch = tags || await this.releaseTags();
    if (!tags) {
      await this.loadMainBranch();
    }
    const promises = [];
    tagsToFetch.forEach((tag) => {
      promises.push(this.loadRelease(tag));
    });
    await Promise.all(promises);
  }

  async loadRelease(tag) {
    const release = new GitRelease(tag, this.context);
    await release.load();
    this.releases.set(tag, release);
    return release;
  }

  static shortenSHA(sha) {
    return sha.substring(0, 7);
  }

  async getReleaseLabels(prNumber, verbose, excludeCherries = false) {
    const labels = [];
    const main = await this.mainBranchGitRelease();
    const commit = main.prIdCommitMap.get(prNumber);
    if (commit) {
      const { sha } = commit;
      const shortSHA = Git.shortenSHA(sha);
      if (verbose) {
        console.log(`PR ${prNumber} is ${shortSHA} on branch ${this.mainBranch}`);
      }

      let firstGitReleased = null;
      const tags = await this.releaseTags();
      tags.forEach((tag) => {
        const release = this.releases.get(tag);
        if (release.shaCommitMap.get(sha) && !firstGitReleased && release.tag !== this.mainBranch) {
          firstGitReleased = release.tag;
          labels.push(`🚢 ${release.tag}`);
        }
        const commitInGitRelease = release.prIdCommitMap.get(prNumber);
        if (!excludeCherries && commitInGitRelease && commitInGitRelease.sha !== sha) {
          labels.push(`🍒 ${release.tag}`);
        }
      });
      if (labels.length >= 1) {
        // using this emoji to show it's been labeled by the bot
        labels.push('🏷️ bot');
      }
    }
    return labels;
  }

  async previousRelease(release) {
    const tags = await this.releaseTags();
    return tags[tags.indexOf(release) - 1];
  }

  async getPRsToSync(release, verbose = false, excludeCherries = false) {
    const prevRelease = await this.previousRelease(release);
    const releaseRange = new GitRelease(release, this.context, prevRelease);
    await releaseRange.load();
    const prIds = releaseRange.prIdCommitMap.keys();

    const prs = [];
    const promises = [];
    [...prIds].forEach(prId => {
      promises.push(
        this.getReleaseLabels(prId, verbose, excludeCherries)
          .then((labels) => {
            prs.push({ prId, labels });
          }),
      );
    });
    await Promise.all(promises);
    return prs;
  }
}
