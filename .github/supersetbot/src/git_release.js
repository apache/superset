import simpleGit from 'simple-git';

export default class GitRelease {
  constructor(tag, context, from = null) {
    this.tag = tag;
    this.context = context;
    this.prNumberRegex = /\(#(\d+)\)/;
    this.shaCommitMap = null;
    this.prIdCommitMap = null;
    this.prCommitMap = null;
    this.git = simpleGit();
    this.from = from;
  }

  extractPRNumber(commitMessage) {
    const match = (commitMessage || '').match(this.prNumberRegex);
    return match ? parseInt(match[1], 10) : null;
  }

  async load() {
    let from = this.from || await this.git.firstCommit();
    if (from.includes('\n')) {
      [from] = from.split('\n');
    }
    const range = `${this.from || 'first'}..${this.tag}`;
    const commits = await this.git.log({ from, to: this.tag });
    this.context.log(`${range} - fetched ${commits.all.length} commits`);

    this.shaCommitMap = new Map();
    commits.all.forEach((commit) => {
      const sha = commit.hash.substring(0, 7);
      this.shaCommitMap.set(
        sha,
        {
          prId: this.extractPRNumber(commit.message),
          message: commit.message,
          sha,
        },
      );
    });

    this.prIdCommitMap = new Map();
    // eslint-disable-next-line no-restricted-syntax
    for (const commit of this.shaCommitMap.values()) {
      if (commit.prId) {
        this.prIdCommitMap.set(commit.prId, commit);
      }
    }
  }
}
