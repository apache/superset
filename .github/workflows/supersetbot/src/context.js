import { Octokit } from '@octokit/rest';

export function getIssueNumber(context) {
  return context.eventName === 'workflow_dispatch'
    ? context.payload.inputs.issue_number
    : context.issue.number;
}

export function getCommand(context) {
  return context.eventName === 'workflow_dispatch'
    ? context.payload.inputs.comment_body
    : context.payload.comment.body;
}

export function getEnvContext() {
  if (process.env.GITHUB_ACTIONS) {
    // GitHub Actions environment
    return {
      source: 'GHA',
      context: global.context,
      github: global.github,
    };
  }
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is not set. Please set the GITHUB_TOKEN environment variable.');
  }
  const github = new Octokit({ auth: `token ${process.env.GITHUB_TOKEN}` });
  return {
    source: 'CLI',
    github,
    context: {
      repo: {
        repo: 'superset',
        owner: 'apache',
      },
    },
  };
}
