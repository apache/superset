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
import { Command, Option } from 'commander';

import * as docker from './docker.js';
import * as utils from './utils.js';
import Github from './github.js';
import Git from './git.js';

export default function getCLI(context) {
  const program = new Command();

  // Some reusable options
  const issueOption = new Option('-i, --issue <issue>', 'The issue number', process.env.GITHUB_ISSUE_NUMBER);
  const excludeCherriesOption = new Option('-c, --exclude-cherries', 'Generate cherry labels point to each release where the PR has been cherried');

  // Setting up top-level CLI options
  program
    .option('-v, --verbose', 'Output extra debugging information')
    .option('-r, --repo <repo>', 'The GitHub repo to use (ie: "apache/superset")', process.env.GITHUB_REPOSITORY)
    .option('-d, --dry-run', 'Run the command in dry-run mode')
    .option('-a, --actor <actor>', 'The actor', process.env.GITHUB_ACTOR);

  program.command('label <label>')
    .description('Add a label to an issue or PR')
    .addOption(issueOption)
    .action(async function (label) {
      const opts = context.processOptions(this, ['issue', 'repo']);
      const github = new Github({ context, issue: opts.issue });
      await github.label(opts.issue, label, context, opts.actor, opts.verbose, opts.dryRun);
    });

  program.command('unlabel <label>')
    .description('Remove a label from an issue or PR')
    .addOption(issueOption)
    .action(async function (label) {
      const opts = context.processOptions(this, ['issue', 'repo']);
      const github = new Github({ context, issueNumber: opts.issue });
      await github.unlabel(opts.issue, label, context, opts.actor, opts.verbose, opts.dryRun);
    });

  program.command('release-label-pr <prId>')
    .description('Figure out first release for PR and label it')
    .addOption(excludeCherriesOption)
    .action(async function (prId) {
      const opts = context.processOptions(this, ['repo']);
      const git = new Git(context);
      await git.loadReleases();

      let wrapped = context.commandWrapper({
        func: git.getReleaseLabels,
        verbose: opts.verbose,
      });
      const labels = await wrapped(parseInt(prId, 10), opts.verbose, opts.excludeCherries);
      const github = new Github({ context, issueNumber: opts.issue });
      wrapped = context.commandWrapper({
        func: github.syncLabels,
        verbose: opts.verbose,
      });
      await wrapped({labels, prId, actor: opts.actor, verbose: opts.verbose, dryRun: opts.dryRun});
    });

  program.command('version')
    .description("Prints supersetbot's version number")
    .action(async () => {
      const version = await utils.currentPackageVersion();
      context.log(version);
    });

  if (context.source === 'CLI') {
    program.command('release-label-prs')
      .description('Given a set of PRs, auto-release label them')
      .option('-s, --search <search>', 'extra search string to append using the GitHub mini-language')
      .option('-p, --pages <pages>', 'the number of pages (100 per page) to fetch and process', 10)
      .action(async function () {
        const opts = context.processOptions(this, ['repo']);

        const github = new Github({ context, issueNumber: opts.issue });
        const prs = await github.searchMergedPRs({
          query: opts.search,
          onlyUnlabeled: true,
          verbose: opts.verbose,
          pages: opts.pages,
        });
        const prIdLabelMap = new Map(prs.map((pr) => [pr.number, pr.labels]));
        const git = new Git(context);
        await git.loadReleases();

        const prsPromises = prs.map(async (pr) => {
          const labels = await git.getReleaseLabels(pr.number, opts.verbose);
          return { prId: pr.number, labels };
        });
        const prsTargetLabel = await Promise.all(prsPromises);
        // eslint-disable-next-line no-restricted-syntax
        for (const { prId, labels } of prsTargetLabel) {
          // Running sequentially to avoid rate limiting
          // eslint-disable-next-line no-await-in-loop
          await github.syncLabels({
            labels,
            existingLabels: prIdLabelMap.get(prId).map(l => l.name),
            prId,
            ...opts,
          });
        }
      });

    program.command('release-label <release>')
      .description('Figure out first release for PR and label it')
      .addOption(excludeCherriesOption)
      .action(async function (release) {
        const opts = context.processOptions(this, ['repo']);
        const git = new Git(context);
        await git.loadReleases();
        const prs = await git.getPRsToSync(release, opts.verbose, opts.excludeCherries);

        const github = new Github({ context });
        // eslint-disable-next-line no-restricted-syntax
        for (const { prId, labels } of prs) {
          // Running sequentially to avoid rate limiting
          // eslint-disable-next-line no-await-in-loop
          await github.syncLabels({
            prId,
            labels,
            ...opts,
          });
        }
      });

    program.command('orglabel')
      .description('Add an org label based on the author')
      .addOption(issueOption)
      .action(async function () {
        const opts = context.processOptions(this, ['issue', 'repo']);
        const github = new Github({ context, issueNumber: opts.issue });
        await github.assignOrgLabel(opts.issue, opts.verbose, opts.dryRun);
      });


    program.command('docker')
      .description('Generates/run docker build commands use in CI')
      .option('-t, --preset', 'Build preset', /^(lean|dev|dockerize|websocket|py310|ci)$/i, 'lean')
      .option('-c, --context <context>', 'Build context', /^(push|pull_request|release)$/i, 'local')
      .option('-r, --context-ref <ref>', 'Reference to the PR, release, or branch')
      .option('-p, --platform <platform...>', 'Platforms (multiple values allowed)')
      .option('-f, --force-latest', 'Force the "latest" tag on the release')
      .option('-v, --verbose', 'Print more info')
      .action(function (preset) {
        const opts = context.processOptions(this);
        opts.platform = opts.platform || ['linux/arm64'];
        const cmd = docker.getDockerCommand({ preset, ...opts });
        context.log(cmd);
        if (!opts.dryRun) {
          utils.runShellCommand(cmd, false);
        }
      });
  }

  return program;
}
