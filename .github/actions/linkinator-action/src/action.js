import core from '@actions/core';
import { LinkChecker, LinkState, getConfig } from 'linkinator';
import { promises as fs } from 'fs';

export async function getFullConfig () {
  const defaults = {
    path: ['*.md'],
    concurrency: 100,
    recurse: false,
    skip: [],
    timeout: 0,
    markdown: true,
    retry: false,
    verbosity: 'WARNING'
  };
  // The options returned from `getInput` appear to always be strings.
  const actionsConfig = {
    path: parseList('paths'),
    concurrency: parseNumber('concurrency'),
    recurse: parseBoolean('recurse'),
    skip: parseList('linksToSkip') || parseList('skip'),
    timeout: parseNumber('timeout'),
    markdown: parseBoolean('markdown'),
    serverRoot: parseString('serverRoot'),
    directoryListing: parseBoolean('directoryListing'),
    retry: parseBoolean('retry'),
    verbosity: parseString('verbosity'),
    config: parseString('config')
  };
  const urlRewriteSearch = parseString('urlRewriteSearch');
  const urlRewriteReplace = parseString('urlRewriteReplace');
  actionsConfig.urlRewriteExpressions = [];
  if (urlRewriteSearch && urlRewriteReplace) {
    actionsConfig.urlRewriteExpressions.push(
      {
        pattern: urlRewriteSearch,
        replacement: urlRewriteReplace
      }
    );
  }
  const fileConfig = await getConfig(actionsConfig);
  const config = Object.assign({}, defaults, fileConfig);
  config.linksToSkip = config.skip;
  return config;
}

export async function main () {
  try {
    const config = await getFullConfig();
    const verbosity = getVerbosity(config.verbosity);
    const logger = new Logger(verbosity);
    const { GITHUB_HEAD_REF, GITHUB_BASE_REF, GITHUB_REPOSITORY, GITHUB_EVENT_PATH } = process.env;
    // Read pull_request payload and use it to determine head user/repo:
    if (GITHUB_EVENT_PATH) {
      try {
        const payloadRaw = await fs.readFile(GITHUB_EVENT_PATH, 'utf8');
        const payload = JSON.parse(payloadRaw);
        if (payload?.pull_request?.head) {
          const repo = payload.pull_request.head.repo.full_name;
          core.info(`rewrite repo to ${repo}`);
          if (!config.urlRewriteExpressions) {
            config.urlRewriteExpressions = [];
          }
          config.urlRewriteExpressions.push({
            pattern: new RegExp(`github.com/${GITHUB_REPOSITORY}(/.*/)(${GITHUB_BASE_REF})/(.*)`),
            replacement: `github.com/${repo}$1${GITHUB_HEAD_REF}/$3`
          });
        }
      } catch (err) {
        core.warning(err);
      }
    }

    const checker = new LinkChecker()
      .on('link', link => {
        switch (link.state) {
          case LinkState.BROKEN:
            logger.error(`[${link.status.toString()}] ${link.url}`);
            break;
          case LinkState.OK:
            logger.warn(`[${link.status.toString()}] ${link.url}`);
            break;
          case LinkState.SKIPPED:
            logger.info(`[SKP] ${link.url}`);
            break;
        }
      })
      .on('retry', retryInfo => {
        logger.info('[RETRY]', retryInfo);
      });
    core.info(`Scanning ${config.path.join(', ')}`);
    const result = await checker.check(config);
    const nonSkippedLinks = result.links.filter(x => x.state !== 'SKIPPED');
    core.info(`Scanned total of ${nonSkippedLinks.length} links!`);
    if (!result.passed) {
      const brokenLinks = result.links.filter(x => x.state === 'BROKEN');
      let failureOutput = `Detected ${brokenLinks.length} broken links.`;

      // build a map of failed links by the parent document
      const parents = brokenLinks.reduce((acc, curr) => {
        const parent = curr.parent || '';
        if (!acc[parent]) {
          acc[parent] = [];
        }
        acc[parent].push(curr);
        return acc;
      }, {});

      for (const parent of Object.keys(parents)) {
        failureOutput += `\n ${parent}`;
        for (const link of parents[parent]) {
          failureOutput += `\n   [${link.status}] ${link.url}`;
          logger.debug(JSON.stringify(link.failureDetails, null, 2));
        }
      }
      core.setFailed(failureOutput);
    }
    core.setOutput('results', result);
  } catch (err) {
    core.setFailed(`Linkinator exception: \n${err.message}\n${err.stack}`);
  }
}

function parseString (input) {
  return core.getInput(input) || undefined;
}

function parseList (input) {
  const value = core.getInput(input) || undefined;
  if (value) {
    return value.split(/[\s,]+/).map(x => x.trim()).filter(x => !!x);
  }
  return undefined;
}

function parseNumber (input) {
  const value = core.getInput(input) || undefined;
  if (value) {
    return Number(value);
  }
  return undefined;
}

function parseBoolean (input) {
  const value = core.getInput(input) || undefined;
  if (value) {
    return Boolean(value);
  }
  return undefined;
}

function getVerbosity (verbosity) {
  verbosity = verbosity.toUpperCase();
  const options = Object.keys(LogLevel);
  if (!options.includes(verbosity)) {
    throw new Error(
      `Invalid flag: VERBOSITY must be one of [${options.join(',')}]`
    );
  }
  return LogLevel[verbosity];
}

// This was lifted from linkinator. We use `core.` instead of `console.`
// which made re-use more work than it was worth.
// https://github.com/JustinBeckwith/linkinator/blob/main/src/logger.ts

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  NONE: 4
};

class Logger {
  constructor (level) {
    this.level = level;
  }

  debug (message) {
    if (this.level <= LogLevel.DEBUG) {
      core.info(message);
    }
  }

  info (message) {
    if (this.level <= LogLevel.INFO) {
      core.info(message);
    }
  }

  warn (message) {
    if (this.level <= LogLevel.WARNING) {
      core.info(message);
    }
  }

  error (message) {
    if (this.level <= LogLevel.ERROR) {
      core.error(message);
    }
  }
}
