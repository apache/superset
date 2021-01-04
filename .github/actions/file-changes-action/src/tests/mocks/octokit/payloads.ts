import {EndpointOptions} from '@octokit/types'
/**
 * FILES
 */
const listFilesResponse: any[] = [
  {
    filename: '.github/CONTRIBUTING.md',
    status: 'added'
  },
  {
    filename: '.github/craneEventLambda.md',
    status: 'added'
  },
  {
    filename: '.github/readme.md',
    status: 'added'
  },
  {
    filename: 'functions/twitch-sadako/webhookSubscribeLambda/handler.py',
    status: 'added'
  },
  {
    filename: 'functions/twitch-sadako/getCraneStatsLambda/handler.py',
    status: 'removed'
  },
  {
    filename: '.github/ISSUE_TEMPLATE/bug_report.md',
    status: 'modified'
  },
  {
    filename:
      'functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda.json',
    status: 'renamed'
  }
]
const pushRequest: any = {
  owner: 'trilom',
  repo: 'file-changes-action',
  base: '01a956ad7dbd39773299d421b402535cef6ab1f3',
  head: '513ca39ff3756e5b510ad752edaba6a0aeb2efac'
}
const prRequest: any = {
  owner: 'trilom',
  repo: 'file-changes-action',
  pull_number: 79
}
const pushEndpointOptions: EndpointOptions = {
  method: 'GET',
  baseUrl: 'https://api.github.com',
  url: '/repos/:owner/:repo/compare/:base...:head',
  owner: 'trilom',
  repo: 'file-changes-action',
  base: '01a956ad7dbd39773299d421b402535cef6ab1f3',
  head: '513ca39ff3756e5b510ad752edaba6a0aeb2efac'
}
const prEndpointOptions: EndpointOptions = {
  method: 'GET',
  baseUrl: 'https://api.github.com',
  url: '/repos/:owner/:repo/pulls/:pull_number/files',
  owner: 'trilom',
  repo: 'file-changes-action',
  pull_number: 79
}
export const normalFileArray: string[] = [
  '.github/actions/deploy_infrastructure/deploy',
  '.github/actions/deploy_infrastructure/deploy_delete_commands.json',
  '.github/actions/deploy_infrastructure/deploy_deploy_commands.json',
  '.github/actions/deploy_infrastructure/deploy_validate_commands.json',
  '.github/actions/deploy_infrastructure/prefix_deploy_commands.json',
  '.github/actions/deploy_infrastructure/suffix_deploy_commands.json',
  '.python-version',
  'cloudformation/.python-version',
  'cloudformation/mappings/mappings.twitch.yml',
  'cloudformation/order/twitch.yml',
  'cloudformation/templates/twitch-sadako.yml',
  'cloudformation/templates/twitch-secrets.yml',
  'functions/twitch-sadako/Makefile',
  'functions/twitch-sadako/craneEventLambda/handler.py',
  'functions/twitch-sadako/craneEventLambda/requirements.txt',
  'functions/twitch-sadako/craneEventLambda/test/craneEventLambda.json',
  'functions/twitch-sadako/followEventLambda/handler.py',
  'functions/twitch-sadako/followEventLambda/requirements.txt',
  'functions/twitch-sadako/followEventLambda/test/followEventLambda_get.json',
  'functions/twitch-sadako/followEventLambda/test/followEventLambda_post.json',
  'functions/twitch-sadako/getCraneStatsLambda/handler.py',
  'functions/twitch-sadako/getCraneStatsLambda/requirements.txt',
  'functions/twitch-sadako/getCraneStatsLambda/test/getCraneStatsLambda.json',
  'functions/twitch-sadako/getTokenLambda/handler.py',
  'functions/twitch-sadako/getTokenLambda/requirements.txt',
  'functions/twitch-sadako/getTokenLambda/test/getTokenLambda.json',
  'functions/twitch-sadako/slackNotifyLambda/handler.py',
  'functions/twitch-sadako/slackNotifyLambda/requirements.txt',
  'functions/twitch-sadako/slackNotifyLambda/test/slackNotifyLambda.json',
  'functions/twitch-sadako/webhookSubscribeCronLambda/handler.py',
  'functions/twitch-sadako/webhookSubscribeCronLambda/requirements.txt',
  'functions/twitch-sadako/webhookSubscribeCronLambda/test/webhookSubscribeCronLambda.json',
  'functions/twitch-sadako/webhookSubscribeLambda/handler.py',
  'functions/twitch-sadako/webhookSubscribeLambda/requirements.txt',
  'functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda.json',
  'functions/twitch-sadako/webhookSubscribeLambda/test/webhookSubscribeLambda_post.json',
  '.github/ISSUE_TEMPLATE/bug_report.md',
  '.github/ISSUE_TEMPLATE/feature_request.md',
  '.github/workflows/nodejs.yml',
  '.gitignore',
  '.npmignore',
  '.vscode/launch.json',
  'README-template.md',
  'README.md',
  'jest.config.js',
  'package-lock.json',
  'package.json',
  'src/boolean-serializer.ts',
  'src/date-serializer.ts',
  'src/deserialize.ts',
  'src/index.ts',
  'src/model.ts',
  'src/serialize-set.ts',
  'src/serialize.ts',
  'src/utilities.ts',
  'src/validation.ts',
  'test/unit/_ramda.sp.ts',
  'test/unit/benchmark.spec.ts',
  'test/unit/boolean-serializer.spec.ts',
  'test/unit/data/generators.ts',
  'test/unit/date-serializer.spec.ts',
  'test/unit/deserialize.spec.ts',
  'test/unit/sandbox.spec.ts',
  'test/unit/sap/input.ts',
  'test/unit/sap/json-object-mapper.ts',
  'test/unit/sap/output.ts',
  'test/unit/sap/serializers.ts',
  'test/unit/serialize.spec.ts',
  'test/unit/setup.ts',
  'test/unit/test-typings.ts',
  'test/unit/test-typings2.ts',
  'tsconfig.build.json',
  'tsconfig.json'
]
export const weirdFileArray: string[] = [
  '.cfnlintrc',
  ".github/actions/deploy_infrastruc1234'ture/deploy.sh",
  '.github/actions/make_commands/&&&index.js',
  '.github/actions/make_comdf&*(@mands/test/files_added.json',
  '.github/actions/make_c``ommands/test/files_removed.json',
  '.github/actions/make  commands/test/files_modified.json',
  '.pre-commit-config.yaml',
  'cloudformation/Makefile',
  'cloudformation/mappings/mappings.awsaccount.yml'
]
/**
 * REQUESTS
 */
// Octokit.pulls.listFiles
export {prRequest as OctokitPullsListFilesRequest}
// Octokit.pulls.listFiles.endpoint.merge
export {prRequest as OctokitPullsListFilesEndpointMergeRequest}
// Octokit.repos.compareCommits
export {pushRequest as OctokitReposCompareCommitsRequest}
// Octokit.repos.compareCommits.endpoint.merge
export {pushRequest as OctokitReposCompareCommitsEndpointMergeRequest}
// Octokit.paginate
export {prEndpointOptions as OctokitPaginatePrRequest} // pr
export {pushEndpointOptions as OctokitPaginatePushRequest} // push

/**
 * RESPONSES
 */
// Octokit.pulls.listFiles
export {listFilesResponse as OctokitPullsListFilesResponse}
// Octokit.pulls.listFiles.endpoint.merge
export {prEndpointOptions as OctokitPullsListFilesEndpointMergeResponse}
// Octokit.repos.compareCommits
export {listFilesResponse as OctokitReposCompareCommitsResponse}
// Octokit.repos.compareCommits.endpoint.merge
export {pushEndpointOptions as OctokitReposCompareCommitsEndpointMergeResponse}
// Octokit.paginate
export {listFilesResponse as OctokitPaginatePrResponse} // pr
export {listFilesResponse as OctokitPaginatePushResponse} // push
