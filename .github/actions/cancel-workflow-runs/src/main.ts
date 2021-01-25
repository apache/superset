import * as github from '@actions/github'
import * as core from '@actions/core'
import * as rest from '@octokit/rest'

/**
 Those are the cancellable event types tht we know about
 */
const CANCELLABLE_EVENT_TYPES = [
  'push',
  'pull_request',
  'workflow_run',
  'schedule',
  'workflow_dispatch'
]

/**
 * Those are different modes for cancelling
 */
enum CancelMode {
  DUPLICATES = 'duplicates',
  ALL_DUPLICATES = 'allDuplicates',
  SELF = 'self',
  FAILED_JOBS = 'failedJobs',
  NAMED_JOBS = 'namedJobs',
  ALL_DUPLICATED_NAMED_JOBS = 'allDuplicatedNamedJobs'
}

/**
 * Stores information about the owner and repository used, as well as octokit object that is used for
 * authentication.
 */
interface RepositoryInfo {
  octokit: github.GitHub
  owner: string
  repo: string
}

/**
 * Stores information about the workflow info that triggered the current workflow.
 */
interface TriggeringRunInfo {
  workflowId: number
  runId: number
  headRepo: string
  headBranch: string
  headSha: string
  eventName: string
  mergeCommitSha: string | null
  pullRequest: rest.PullsListResponseItem | null
}

/**
 * Converts the source of a run object into a string that can be used as map key in maps where we keep
 * arrays of runs per source group
 * @param triggeringRunInfo the object identifying the triggering workflow
 * @param sourceWorkflowId - workflow id to act on
 * @returns the unique string id for the group
 */
function getCommonGroupIdFromTriggeringRunInfo(
  triggeringRunInfo: TriggeringRunInfo,
  sourceWorkflowId: string | number
): string {
  return (
    `:${sourceWorkflowId}:${triggeringRunInfo.headRepo}` +
    `:${triggeringRunInfo.headBranch}:${triggeringRunInfo.eventName}`
  )
}

/**
 * Converts the source of a run object into a string that can be used as map key in maps where we keep
 * arrays of runs per group
 * @param runItem Item the run item to retrieve the group from
 * @returns the unique string id for the group
 */
function getCommonGroupIdFromRunItem(
  runItem: rest.ActionsListWorkflowRunsResponseWorkflowRunsItem
): string {
  return `:${retrieveWorkflowIdFromUrl(runItem.workflow_url)}:${
    runItem.head_repository.full_name
  }:${runItem.head_branch}:${runItem.event}`
}

/**
 * Creates query parameters selecting all runs that share the same source group as we have. This can
 * be used to select duplicates of my own run.
 *
 * @param repositoryInfo - information about the repository used
 * @param status - status of the run that we are querying for
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @param sourceWorkflowId - workflow id to act on
 * @return query parameters merged with the listWorkflowRuns criteria
 */
function createListRunsQueryRunsSameSource(
  repositoryInfo: RepositoryInfo,
  sourceWorkflowId: string | number,
  status: string,
  triggeringRunInfo: TriggeringRunInfo
): rest.RequestOptions {
  const request = {
    owner: repositoryInfo.owner,
    repo: repositoryInfo.repo,
    // eslint-disable-next-line @typescript-eslint/camelcase
    workflow_id: sourceWorkflowId,
    status,
    branch: triggeringRunInfo.headBranch,
    event: triggeringRunInfo.eventName
  }
  return repositoryInfo.octokit.actions.listWorkflowRuns.endpoint.merge(request)
}
/**
 * Creates query parameters selecting only specific run Id.
 * @param repositoryInfo - information about the repository used
 * @param sourceWorkflowId - workflow id to act on
 * @param status - status of the run that we are querying for
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @return query parameters merged with the listWorkflowRuns criteria
 */
function createListRunsQuerySpecificRunId(
  repositoryInfo: RepositoryInfo,
  sourceWorkflowId: string | number,
  status: string,
  triggeringRunInfo: TriggeringRunInfo
): rest.RequestOptions {
  const request = {
    owner: repositoryInfo.owner,
    repo: repositoryInfo.repo,
    // eslint-disable-next-line @typescript-eslint/camelcase
    workflow_id: sourceWorkflowId,
    status,
    // eslint-disable-next-line @typescript-eslint/camelcase
    run_id: triggeringRunInfo.runId.toString()
  }
  return repositoryInfo.octokit.actions.listWorkflowRuns.endpoint.merge(request)
}

/**
 * Creates query parameters selecting all run Ids for specified workflow Id.
 * @param repositoryInfo - information about the repository used
 * @param status - status of the run that we are querying for
 * @param workflowId - Id of the workflow to retrieve
 * @return query parameters merged with the listWorkflowRuns criteria
 */
function createListRunsQueryAllRuns(
  repositoryInfo: RepositoryInfo,
  status: string,
  workflowId: number | string
): rest.RequestOptions {
  const request = {
    owner: repositoryInfo.owner,
    repo: repositoryInfo.repo,
    // eslint-disable-next-line @typescript-eslint/camelcase
    workflow_id: workflowId,
    status
  }
  return repositoryInfo.octokit.actions.listWorkflowRuns.endpoint.merge(request)
}

/**
 * Creates query parameters selecting all jobs for specified run Id.
 * @param repositoryInfo - information about the repository used
 * @param runId - Id of the run to retrieve jobs for
 * @return query parameters merged with the listJobsForWorkflowRun criteria
 */
function createJobsForWorkflowRunQuery(
  repositoryInfo: RepositoryInfo,
  runId: number
): rest.RequestOptions {
  const request = {
    owner: repositoryInfo.owner,
    repo: repositoryInfo.repo,
    // eslint-disable-next-line @typescript-eslint/camelcase
    run_id: runId
  }
  return repositoryInfo.octokit.actions.listJobsForWorkflowRun.endpoint.merge(
    request
  )
}

/**
 * Returns true if the string matches any of the regexps in array of regexps
 * @param stringToMatch string to match
 * @param regexps array of regexp to match the string against
 * @return array of [matched (boolean), [array of matched strings]]
 */
function matchInArray(
  stringToMatch: string,
  regexps: string[]
): [boolean, string[]] {
  let matched = false
  const allMatches: string[] = []
  for (const regexp of regexps) {
    const match = stringToMatch.match(regexp)
    if (match) {
      matched = true
      allMatches.push(match[0])
    }
  }
  return [matched, allMatches]
}

/**
 * Adds workflow run to the array in the map indexed by key.
 * @param key key to use
 * @param runItem run Item to add
 * @param mapOfWorkflowRunCandidates map of workflow runs to add the run item to
 */
function addWorkflowRunToMap(
  key: string,
  runItem: rest.ActionsListWorkflowRunsResponseWorkflowRunsItem,
  mapOfWorkflowRunCandidates: Map<
    string,
    rest.ActionsListWorkflowRunsResponseWorkflowRunsItem[]
  >
): void {
  core.info(`\nAdding the run: ${runItem.id} to candidates with ${key} key.\n`)
  let arrayOfRuns = mapOfWorkflowRunCandidates.get(key)
  if (arrayOfRuns === undefined) {
    arrayOfRuns = []
    mapOfWorkflowRunCandidates.set(key, arrayOfRuns)
  }
  arrayOfRuns.push(runItem)
}

/**
 * Returns true if the runId specified has jobs matching the regexp and optionally checks if those
 * jobs are failed.
 * * If checkIfFailed is False, it returns true if any of the job name for the run match any of the regexps
 * * Id checkIfFailed is True, it returns true if any of the matching jobs have status 'failed'
 * @param repositoryInfo - information about the repository used
 * @param runId - Id of the run to retrieve jobs for
 * @param jobNameRegexps - array of job name regexps
 * @param checkIfFailed - whether to check the 'failed' status of matched jobs
 * @return array of [matched (boolean), array of matches]
 */
async function jobsMatchingNames(
  repositoryInfo: RepositoryInfo,
  runId: number,
  jobNameRegexps: string[],
  checkIfFailed: boolean
): Promise<[boolean, string[]]> {
  const listJobs = createJobsForWorkflowRunQuery(repositoryInfo, runId)
  if (checkIfFailed) {
    core.info(
      `\nChecking if runId ${runId} has job names matching any of the ${jobNameRegexps} that failed\n`
    )
  } else {
    core.info(
      `\nChecking if runId ${runId} has job names matching any of the ${jobNameRegexps}\n`
    )
  }
  const allMatches: string[] = []
  let matched = false
  for await (const item of repositoryInfo.octokit.paginate.iterator(listJobs)) {
    for (const job of item.data.jobs) {
      core.info(`    The job name: ${job.name}, Conclusion: ${job.conclusion}`)
      const [jobMatched, jobMatches] = matchInArray(job.name, jobNameRegexps)
      if (jobMatched) {
        allMatches.push(...jobMatches)
        if (checkIfFailed) {
          // Only fail the build if one of the matching jobs fail
          if (job.conclusion === 'failure') {
            core.info(
              `    The Job ${job.name} matches one of the ${jobNameRegexps} regexps and it failed.` +
                ` It will be added to the candidates.`
            )
            matched = true
          } else {
            core.info(
              `    The Job ${job.name} matches one of the ${jobNameRegexps} regexps but it did not fail. ` +
                ` So far, so good.`
            )
          }
        } else {
          // Fail the build if any of the job names match
          core.info(
            `    The Job ${job.name} matches one of the ${jobNameRegexps} regexps. ` +
              `It will be added to the candidates.`
          )
          matched = true
        }
      }
    }
  }
  return [matched, allMatches]
}

/**
 * Retrieves workflowId from the workflow URL.
 * @param workflowUrl workflow URL to retrieve the ID from
 * @return numerical workflow id
 */
function retrieveWorkflowIdFromUrl(workflowUrl: string): number {
  const workflowIdString = workflowUrl.split('/').pop() || ''
  if (!(workflowIdString.length > 0)) {
    throw new Error('Could not resolve workflow')
  }
  return parseInt(workflowIdString)
}

/**
 * Returns workflowId of the runId specified
 * @param repositoryInfo - information about the repository used
 * @param runId - Id of the run to retrieve jobs for
 * @return workflow ID for the run id
 */
async function getWorkflowId(
  repositoryInfo: RepositoryInfo,
  runId: number
): Promise<number> {
  const reply = await repositoryInfo.octokit.actions.getWorkflowRun({
    owner: repositoryInfo.owner,
    repo: repositoryInfo.repo,
    // eslint-disable-next-line @typescript-eslint/camelcase
    run_id: runId
  })
  core.info(`The source run ${runId} is in ${reply.data.workflow_url} workflow`)
  return retrieveWorkflowIdFromUrl(reply.data.workflow_url)
}

/**
 * Returns workflow runs matching the callable adding query criteria
 * @param repositoryInfo - information about the repository used
 * @param statusValues - array of string status values for runs that we are interested at
 * @param cancelMode - which cancel mode the query is about
 * @param createListRunQuery - what is the callable criteria selection
 * @return map of workflow run items indexed by the workflow run number
 */
async function getWorkflowRuns(
  repositoryInfo: RepositoryInfo,
  statusValues: string[],
  cancelMode: CancelMode,
  createListRunQuery: CallableFunction
): Promise<Map<number, rest.ActionsListWorkflowRunsResponseWorkflowRunsItem>> {
  const workflowRuns = new Map<
    number,
    rest.ActionsListWorkflowRunsResponseWorkflowRunsItem
  >()
  for (const status of statusValues) {
    const listRuns = await createListRunQuery(status)
    for await (const item of repositoryInfo.octokit.paginate.iterator(
      listRuns
    )) {
      // There is some sort of bug where the pagination URLs point to a
      // different endpoint URL which trips up the resulting representation
      // In that case, fallback to the actual REST 'workflow_runs' property
      const elements =
        item.data.length === undefined ? item.data.workflow_runs : item.data
      for (const element of elements) {
        workflowRuns.set(element.run_number, element)
      }
    }
  }
  core.info(`\nFound runs: ${Array.from(workflowRuns).map(t => t[0])}\n`)
  return workflowRuns
}

/**
 * True if the request is candidate for cancelling in case of duplicate deletion
 * @param runItem item to check
 * @param cancelFutureDuplicates whether future duplicates are being cancelled
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @param sourceWorkflowId - workflow id to act on
 * @param mapOfWorkflowRunCandidates - map of the workflow runs to add candidates to
 * @return true if we determine that the run Id should be cancelled
 */
function checkCandidateForCancellingDuplicate(
  runItem: rest.ActionsListWorkflowRunsResponseWorkflowRunsItem,
  cancelFutureDuplicates: boolean,
  triggeringRunInfo: TriggeringRunInfo,
  sourceWorkflowId: string | number,
  mapOfWorkflowRunCandidates: Map<
    string,
    rest.ActionsListWorkflowRunsResponseWorkflowRunsItem[]
  >
): void {
  const runHeadRepo = runItem.head_repository.full_name
  if (
    triggeringRunInfo.headRepo !== undefined &&
    runHeadRepo !== triggeringRunInfo.headRepo
  ) {
    core.info(
      `\nThe run ${runItem.id} is from a different ` +
        `repo: ${runHeadRepo} (expected ${triggeringRunInfo.headRepo}). Not adding as candidate to cancel.\n`
    )
  }
  if (cancelFutureDuplicates) {
    core.info(
      `\nCancel Future Duplicates: Returning run id that might be duplicate or my own run: ${runItem.id}.\n`
    )
    addWorkflowRunToMap(
      getCommonGroupIdFromTriggeringRunInfo(
        triggeringRunInfo,
        sourceWorkflowId
      ),
      runItem,
      mapOfWorkflowRunCandidates
    )
  } else {
    if (runItem.id === triggeringRunInfo.runId) {
      core.info(`\nThis is my own run ${runItem.id}. Not returning myself!\n`)
    } else if (runItem.id > triggeringRunInfo.runId) {
      core.info(
        `\nThe run ${runItem.id} is started later than my own ` +
          `run ${triggeringRunInfo.runId}. Not returning it\n`
      )
    }
    core.info(`\nFound duplicate of my own run: ${runItem.id}.\n`)
  }
}

/**
 * Should the run be candidate for cancelling in SELF cancelling mode?
 * @param runItem run item
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @param mapOfWorkflowRunCandidates - map of the workflow runs to add candidates to
 */
function checkCandidateForCancellingSelf(
  runItem: rest.ActionsListWorkflowRunsResponseWorkflowRunsItem,
  triggeringRunInfo: TriggeringRunInfo,
  mapOfWorkflowRunCandidates: Map<
    string,
    rest.ActionsListWorkflowRunsResponseWorkflowRunsItem[]
  >
): void {
  if (runItem.id === triggeringRunInfo.runId) {
    addWorkflowRunToMap('selfRun', runItem, mapOfWorkflowRunCandidates)
  }
}

/**
 * Should the run be candidate for cancelling of all duplicates
 * @param runItem run item
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @param mapOfWorkflowRunCandidates - map of the workflow runs to add candidates to
 */
function checkCandidateForAllDuplicates(
  runItem: rest.ActionsListWorkflowRunsResponseWorkflowRunsItem,
  triggeringRunInfo: TriggeringRunInfo,
  mapOfWorkflowRunCandidates: Map<
    string,
    rest.ActionsListWorkflowRunsResponseWorkflowRunsItem[]
  >
): void {
  addWorkflowRunToMap(
    getCommonGroupIdFromRunItem(runItem),
    runItem,
    mapOfWorkflowRunCandidates
  )
}

/**
 * Should the run is candidate for cancelling in naming job cancelling mode?
 * @param repositoryInfo - information about the repository used
 * @param runItem run item
 * @param jobNamesRegexps array of regexps to match job names against
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @param mapOfWorkflowRunCandidates - map of the workflow runs to add candidates to
 * @return true if the run item contains jobs with names matching the pattern
 */
async function checkCandidateForCancellingNamedJobs(
  repositoryInfo: RepositoryInfo,
  runItem: rest.ActionsListWorkflowRunsResponseWorkflowRunsItem,
  jobNamesRegexps: string[],
  triggeringRunInfo: TriggeringRunInfo,
  mapOfWorkflowRunCandidates: Map<
    string,
    rest.ActionsListWorkflowRunsResponseWorkflowRunsItem[]
  >
): Promise<void> {
  // Cancel all jobs that have failed jobs (no matter when started)
  const [matched, allMatches] = await jobsMatchingNames(
    repositoryInfo,
    runItem.id,
    jobNamesRegexps,
    false
  )
  if (matched) {
    core.info(
      `\nSome jobs have matching names in ${runItem.id}: ${allMatches}. Adding it as candidate.\n`
    )
    addWorkflowRunToMap(
      'allMatchingNamedJobs',
      runItem,
      mapOfWorkflowRunCandidates
    )
  } else {
    core.info(`\nNone of the jobs match name in ${runItem.id}.\n`)
  }
}

/**
 * Should the run is candidate for cancelling in failed job cancelling mode?
 * @param repositoryInfo - information about the repository used
 * @param runItem run item
 * @param jobNamesRegexps array of regexps to match job names against
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @param mapOfWorkflowRunCandidates - map of the workflow runs to add candidates to
 * @return true if the run item contains failed jobs with names matching the pattern
 */
async function checkCandidateForCancellingFailedJobs(
  repositoryInfo: RepositoryInfo,
  runItem: rest.ActionsListWorkflowRunsResponseWorkflowRunsItem,
  jobNamesRegexps: string[],
  triggeringRunInfo: TriggeringRunInfo,
  mapOfWorkflowRunCandidates: Map<
    string,
    rest.ActionsListWorkflowRunsResponseWorkflowRunsItem[]
  >
): Promise<void> {
  // Cancel all jobs that have failed jobs (no matter when started)
  const [matched, allMatches] = await jobsMatchingNames(
    repositoryInfo,
    runItem.id,
    jobNamesRegexps,
    true
  )
  if (matched) {
    core.info(
      `\nSome matching named jobs failed in ${runItem.id}: ${allMatches}. Adding it to candidates.\n`
    )
    addWorkflowRunToMap('failedJobs', runItem, mapOfWorkflowRunCandidates)
  } else {
    core.info(
      `\nNone of the matching jobs failed in ${runItem.id}. Not adding as candidate to cancel.\n`
    )
  }
}

/**
 * Checks if the run is candidate for duplicate cancelling of named jobs. It adds it to the map
 * including the match as a key for duplicate detection.
 * @param repositoryInfo - information about the repository used
 * @param runItem - run item
 * @param jobNamesRegexps - array of regexps to match job names against
 * @param mapOfWorkflowRunCandidates - map of runs to update
 */
async function checkCandidateForDuplicateNamedJobs(
  repositoryInfo: RepositoryInfo,
  runItem: rest.ActionsListWorkflowRunsResponseWorkflowRunsItem,
  jobNamesRegexps: string[],
  mapOfWorkflowRunCandidates: Map<
    string,
    rest.ActionsListWorkflowRunsResponseWorkflowRunsItem[]
  >
): Promise<void> {
  const [matched, allMatches] = await jobsMatchingNames(
    repositoryInfo,
    runItem.id,
    jobNamesRegexps,
    false
  )
  if (matched) {
    for (const match of allMatches) {
      // This is the only case where we are not using source group to cancelling candidates but
      // the match of job names
      addWorkflowRunToMap(match, runItem, mapOfWorkflowRunCandidates)
    }
  }
}

/**
 * Determines whether the run is candidate to be cancelled depending on the mode used and add it to the map
 * of workflow names if it is.
 * @param repositoryInfo - information about the repository used
 * @param sourceWorkflowId - workflow id to act on
 * @param runItem - run item
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @param cancelMode - cancel mode
 * @param cancelFutureDuplicates - whether to cancel future duplicates
 * @param jobNamesRegexps - what are the regexps for job names
 * @param skipEventTypes - which events should be skipped
 * @param mapOfWorkflowRunCandidates - map of workflow runs to add candidates to
 */
async function checkCandidateForCancelling(
  repositoryInfo: RepositoryInfo,
  sourceWorkflowId: string | number,
  runItem: rest.ActionsListWorkflowRunsResponseWorkflowRunsItem,
  triggeringRunInfo: TriggeringRunInfo,
  cancelMode: CancelMode,
  cancelFutureDuplicates: boolean,
  jobNamesRegexps: string[],
  skipEventTypes: string[],
  mapOfWorkflowRunCandidates: Map<
    string,
    rest.ActionsListWorkflowRunsResponseWorkflowRunsItem[]
  >
): Promise<void> {
  if ('completed' === runItem.status.toString()) {
    core.info(
      `\nThe run ${runItem.id} is completed. Not adding as candidate to cancel.\n`
    )
    return
  }
  if (!CANCELLABLE_EVENT_TYPES.includes(runItem.event.toString())) {
    core.info(
      `\nThe run ${runItem.id} is (${runItem.event} event - not ` +
        `in ${CANCELLABLE_EVENT_TYPES}). Not adding as candidate to cancel.\n`
    )
    return
  }
  if (skipEventTypes.includes(runItem.event.toString())) {
    core.info(
      `\nThe run ${runItem.id} is (${runItem.event} event - ` +
        `it is in skipEventTypes ${skipEventTypes}). Not adding as candidate to cancel.\n`
    )
    return
  }
  if (cancelMode === CancelMode.FAILED_JOBS) {
    await checkCandidateForCancellingFailedJobs(
      repositoryInfo,
      runItem,
      jobNamesRegexps,
      triggeringRunInfo,
      mapOfWorkflowRunCandidates
    )
  } else if (cancelMode === CancelMode.NAMED_JOBS) {
    await checkCandidateForCancellingNamedJobs(
      repositoryInfo,
      runItem,
      jobNamesRegexps,
      triggeringRunInfo,
      mapOfWorkflowRunCandidates
    )
  } else if (cancelMode === CancelMode.SELF) {
    checkCandidateForCancellingSelf(
      runItem,
      triggeringRunInfo,
      mapOfWorkflowRunCandidates
    )
  } else if (cancelMode === CancelMode.DUPLICATES) {
    checkCandidateForCancellingDuplicate(
      runItem,
      cancelFutureDuplicates,
      triggeringRunInfo,
      sourceWorkflowId,
      mapOfWorkflowRunCandidates
    )
  } else if (cancelMode === CancelMode.ALL_DUPLICATES) {
    checkCandidateForAllDuplicates(
      runItem,
      triggeringRunInfo,
      mapOfWorkflowRunCandidates
    )
  } else if (cancelMode === CancelMode.ALL_DUPLICATED_NAMED_JOBS) {
    await checkCandidateForDuplicateNamedJobs(
      repositoryInfo,
      runItem,
      jobNamesRegexps,
      mapOfWorkflowRunCandidates
    )
    return
  } else {
    throw Error(`\nWrong cancel mode ${cancelMode}! Please correct it!.\n`)
  }
}

/**
 * Cancels the specified workflow run.
 * @param repositoryInfo - information about the repository used
 * @param runId - run Id to cancel
 */
async function cancelRun(
  repositoryInfo: RepositoryInfo,
  runId: number
): Promise<void> {
  let reply
  try {
    reply = await repositoryInfo.octokit.actions.cancelWorkflowRun({
      owner: repositoryInfo.owner,
      repo: repositoryInfo.repo,
      // eslint-disable-next-line @typescript-eslint/camelcase
      run_id: runId
    })
    core.info(`\nThe run ${runId} cancelled, status = ${reply.status}\n`)
  } catch (error) {
    core.warning(
      `\nCould not cancel run ${runId}: [${error.status}] ${error.message}\n`
    )
  }
}

/**
 * Returns map of workflow run items matching the criteria specified group by workflow run id
 * @param repositoryInfo - information about the repository used
 * @param sourceWorkflowId - workflow id to act on
 * @param statusValues - status values we want to check
 * @param cancelMode - cancel mode to use
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @return map of the run items matching grouped by workflow run id
 */
async function getWorkflowRunsMatchingCriteria(
  repositoryInfo: RepositoryInfo,
  sourceWorkflowId: string | number,
  statusValues: string[],
  cancelMode: CancelMode,
  triggeringRunInfo: TriggeringRunInfo
): Promise<Map<number, rest.ActionsListWorkflowRunsResponseWorkflowRunsItem>> {
  return await getWorkflowRuns(
    repositoryInfo,
    statusValues,
    cancelMode,
    function(status: string) {
      if (cancelMode === CancelMode.SELF) {
        core.info(
          `\nFinding runs for my own run: Owner: ${repositoryInfo.owner}, Repo: ${repositoryInfo.repo}, ` +
            `Workflow ID:${sourceWorkflowId},` +
            `Source Run id: ${triggeringRunInfo.runId}\n`
        )
        return createListRunsQuerySpecificRunId(
          repositoryInfo,
          sourceWorkflowId,
          status,
          triggeringRunInfo
        )
      } else if (
        cancelMode === CancelMode.FAILED_JOBS ||
        cancelMode === CancelMode.NAMED_JOBS ||
        cancelMode === CancelMode.ALL_DUPLICATES ||
        cancelMode === CancelMode.ALL_DUPLICATED_NAMED_JOBS
      ) {
        core.info(
          `\nFinding runs for all runs: Owner: ${repositoryInfo.owner}, Repo: ${repositoryInfo.repo}, ` +
            `Status: ${status} Workflow ID:${sourceWorkflowId}\n`
        )
        return createListRunsQueryAllRuns(
          repositoryInfo,
          status,
          sourceWorkflowId
        )
      } else if (cancelMode === CancelMode.DUPLICATES) {
        core.info(
          `\nFinding duplicate runs: Owner: ${repositoryInfo.owner}, Repo: ${repositoryInfo.repo}, ` +
            `Status: ${status} Workflow ID:${sourceWorkflowId}, ` +
            `Head Branch: ${triggeringRunInfo.headBranch},` +
            `Event name: ${triggeringRunInfo.eventName}\n`
        )
        return createListRunsQueryRunsSameSource(
          repositoryInfo,
          sourceWorkflowId,
          status,
          triggeringRunInfo
        )
      } else {
        throw Error(`\nWrong cancel mode ${cancelMode}! Please correct it.\n`)
      }
    }
  )
}

/**
 * Finds pull request matching its headRepo, headBranch and headSha
 * @param repositoryInfo - information about the repository used
 * @param headRepo - head repository from which Pull Request comes
 * @param headBranch - head branch from which Pull Request comes
 * @param headSha - sha for the head of the incoming Pull request
 */
async function findPullRequest(
  repositoryInfo: RepositoryInfo,
  headRepo: string,
  headBranch: string,
  headSha: string
): Promise<rest.PullsListResponseItem | null> {
  // Finds Pull request for this workflow run
  core.info(
    `\nFinding PR request id for: owner: ${repositoryInfo.owner}, Repo:${repositoryInfo.repo},` +
      ` Head:${headRepo}:${headBranch}.\n`
  )
  const pullRequests = await repositoryInfo.octokit.pulls.list({
    owner: repositoryInfo.owner,
    repo: repositoryInfo.repo,
    head: `${headRepo}:${headBranch}`
  })
  for (const pullRequest of pullRequests.data) {
    core.info(
      `\nComparing: ${pullRequest.number} sha: ${pullRequest.head.sha} with expected: ${headSha}.\n`
    )
    if (pullRequest.head.sha === headSha) {
      core.info(`\nFound PR: ${pullRequest.number}\n`)
      return pullRequest
    }
  }
  core.info(`\nCould not find the PR for this build :(\n`)
  return null
}

/**
 * Finds pull request id for the run item.
 * @param repositoryInfo - information about the repository used
 * @param runItem - run Item that the pull request should be found for
 * @return pull request number to notify (or undefined if not found)
 */
async function findPullRequestForRunItem(
  repositoryInfo: RepositoryInfo,
  runItem: rest.ActionsListWorkflowRunsResponseWorkflowRunsItem
): Promise<number | undefined> {
  const pullRequest = await findPullRequest(
    repositoryInfo,
    runItem.head_repository.owner.login,
    runItem.head_branch,
    runItem.head_sha
  )
  if (pullRequest) {
    return pullRequest.number
  }
  return undefined
}

/**
 * Maps found workflow runs into groups - filters out the workflows that are not eligible for cancelling
 * (depends on cancel Mode) and assigns each workflow to groups - where workflow runs from the
 * same group are put together in one array - in a map indexed by the source group id.
 *
 * @param repositoryInfo - information about the repository used
 * @param sourceWorkflowId - workflow id to act on
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @param cancelMode - cancel mode to use
 * @param cancelFutureDuplicates - whether to cancel future duplicates
 * @param jobNameRegexps - regexps for job names
 * @param skipEventTypes - array of event names to skip
 * @param selfPreservation - whether the run will cancel itself if requested
 * @param selfRunId - my own run id
 * @param workflowRuns - map of workflow runs found
 * @parm maps with string key and array of run items as value. The key might be
 *       * source group id (allDuplicates mode)
 *       * matching job name (allDuplicatedMatchingJobNames mode)
 */
async function filterAndMapWorkflowRunsToGroups(
  repositoryInfo: RepositoryInfo,
  sourceWorkflowId: string | number,
  triggeringRunInfo: TriggeringRunInfo,
  cancelMode: CancelMode,
  cancelFutureDuplicates: boolean,
  jobNameRegexps: string[],
  skipEventTypes: string[],
  selfRunId: number,
  selfPreservation: boolean,
  workflowRuns: Map<
    number,
    rest.ActionsListWorkflowRunsResponseWorkflowRunsItem
  >
): Promise<
  Map<string, rest.ActionsListWorkflowRunsResponseWorkflowRunsItem[]>
> {
  const mapOfWorkflowRunCandidates = new Map()
  for (const [key, runItem] of workflowRuns) {
    core.info(
      `\nChecking run number: ${key} RunId: ${runItem.id} Url: ${runItem.url} Status ${runItem.status}` +
        ` Created at ${runItem.created_at}\n`
    )
    if (runItem.id === selfRunId && selfPreservation) {
      core.info(
        `\nI have self-preservation built in. I refuse to cancel myself :)\n`
      )
      continue
    }
    await checkCandidateForCancelling(
      repositoryInfo,
      sourceWorkflowId,
      runItem,
      triggeringRunInfo,
      cancelMode,
      cancelFutureDuplicates,
      jobNameRegexps,
      skipEventTypes,
      mapOfWorkflowRunCandidates
    )
  }
  return mapOfWorkflowRunCandidates
}

/**
 * Add specified comment to Pull Request
 * @param repositoryInfo - information about the repository used
 * @param pullRequestNumber - number of pull request
 * @param comment - comment to add
 */
async function addCommentToPullRequest(
  repositoryInfo: RepositoryInfo,
  pullRequestNumber: number,
  comment: string
): Promise<void> {
  core.info(`\nNotifying PR: ${pullRequestNumber} with '${comment}'.\n`)
  await repositoryInfo.octokit.issues.createComment({
    owner: repositoryInfo.owner,
    repo: repositoryInfo.repo,
    // eslint-disable-next-line @typescript-eslint/camelcase
    issue_number: pullRequestNumber,
    body: comment
  })
}

/**
 * Notifies PR about cancelling
 * @param repositoryInfo - information about the repository used
 * @param selfRunId - my own run id
 * @param pullRequestNumber - number of pull request
 * @param reason reason for cancelling
 */
async function notifyPR(
  repositoryInfo: RepositoryInfo,
  selfRunId: number,
  pullRequestNumber: number,
  reason: string
): Promise<void> {
  const selfWorkflowRunUrl =
    `https://github.com/${repositoryInfo.owner}/${repositoryInfo.repo}` +
    `/actions/runs/${selfRunId}`
  await addCommentToPullRequest(
    repositoryInfo,
    pullRequestNumber,
    `[The Workflow run](${selfWorkflowRunUrl}) is cancelling this PR. ${reason}`
  )
}

/**
 * Cancels all runs in the specified group of runs.
 * @param repositoryInfo - information about the repository used
 * @param sortedRunItems - items sorted in descending order (descending order by created_at)
 * @param notifyPRCancel - whether to notify the PR when cancelling
 * @param selfRunId - what is the self run id
 * @param sourceGroupId - what is the source group id
 * @param reason - reason for cancelling
 */
async function cancelAllRunsInTheGroup(
  repositoryInfo: RepositoryInfo,
  sortedRunItems: rest.ActionsListWorkflowRunsResponseWorkflowRunsItem[],
  notifyPRCancel: boolean,
  selfRunId: number,
  sourceGroupId: string,
  reason: string
): Promise<number[]> {
  core.info(
    `\n###### Cancelling runs for ${sourceGroupId} starting from the most recent  ##########\n` +
      `\n     Number of runs to cancel: ${sortedRunItems.length}\n`
  )
  const cancelledRuns: number[] = []
  for (const runItem of sortedRunItems) {
    if (notifyPRCancel && runItem.event === 'pull_request') {
      const pullRequestNumber = await findPullRequestForRunItem(
        repositoryInfo,
        runItem
      )
      if (pullRequestNumber !== undefined) {
        core.info(
          `\nNotifying PR: ${pullRequestNumber} (runItem: ${runItem}) with: ${reason}\n`
        )
        await notifyPR(repositoryInfo, selfRunId, pullRequestNumber, reason)
      }
    }
    core.info(`\nCancelling run: ${runItem.id}.\n`)
    await cancelRun(repositoryInfo, runItem.id)
    cancelledRuns.push(runItem.id)
  }
  core.info(
    `\n######  Finished cancelling runs for ${sourceGroupId} ##########\n`
  )
  return cancelledRuns
}

/**
 * Cancels found runs per group. It takes all the found groups, sorts them
 * descending according to create date in each of the groups and cancels them in that order -
 * optionally skipping the first found run in each source group in case of duplicate cancelling.
 *
 * @param repositoryInfo - information about the repository used
 * @param mapOfWorkflowRunCandidatesCandidatesToCancel map of all workflow run candidates
 * @param cancelMode - cancel mode
 * @param cancelFutureDuplicates - whether to cancel future duplicates
 * @param notifyPRCancel - whether to notify PRs with comments
 * @param selfRunId - self run Id
 * @param reason - reason for cancelling
 */
async function cancelTheRunsPerGroup(
  repositoryInfo: RepositoryInfo,
  mapOfWorkflowRunCandidatesCandidatesToCancel: Map<
    string,
    rest.ActionsListWorkflowRunsResponseWorkflowRunsItem[]
  >,
  cancelMode: CancelMode,
  cancelFutureDuplicates: boolean,
  notifyPRCancel: boolean,
  selfRunId: number,
  reason: string
): Promise<number[]> {
  const cancelledRuns: number[] = []
  for (const [
    groupId,
    candidatesArray
  ] of mapOfWorkflowRunCandidatesCandidatesToCancel) {
    // Sort from most recent date - this way we always kill current one at the end (if we kill it at all)
    const sortedRunItems = candidatesArray.sort((runItem1, runItem2) =>
      runItem2.created_at.localeCompare(runItem1.created_at)
    )
    if (sortedRunItems.length > 0) {
      if (
        (cancelMode === CancelMode.DUPLICATES && cancelFutureDuplicates) ||
        cancelMode === CancelMode.ALL_DUPLICATES ||
        cancelMode === CancelMode.ALL_DUPLICATED_NAMED_JOBS
      ) {
        core.info(
          `\nSkipping the first run (${sortedRunItems[0].id}) of all the matching ` +
            `duplicates for '${groupId}'. This one we are going to leave in peace!\n`
        )
        sortedRunItems.shift()
      }
      if (sortedRunItems.length === 0) {
        core.info(`\nNo duplicates to cancel for ${groupId}!\n`)
        continue
      }
      cancelledRuns.push(
        ...(await cancelAllRunsInTheGroup(
          repositoryInfo,
          sortedRunItems,
          notifyPRCancel,
          selfRunId,
          groupId,
          reason
        ))
      )
    } else {
      core.info(
        `\n######  There are no runs to cancel for ${groupId} ##########\n`
      )
    }
  }
  return cancelledRuns
}

/**
 * Find and cancels runs based on the criteria chosen.
 * @param repositoryInfo - information about the repository used
 * @param selfRunId - number of own run id
 * @param sourceWorkflowId - workflow id to act on
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @param cancelMode - cancel mode used
 * @param cancelFutureDuplicates - whether to cancel future duplicates for duplicate cancelling
 * @param notifyPRCancel - whether to notify in PRs about cancelling
 * @param notifyPRMessageStart - whether to notify PRs when the action starts
 * @param jobNameRegexps - array of regular expressions to match hob names in case of named modes
 * @param skipEventTypes - array of event names that should be skipped
 * @param reason - reason for cancelling
 * @param selfPreservation - whether the run will cancel itself if requested
 * @return array of canceled workflow run ids
 */
async function findAndCancelRuns(
  repositoryInfo: RepositoryInfo,
  selfRunId: number,
  sourceWorkflowId: string | number,
  triggeringRunInfo: TriggeringRunInfo,
  cancelMode: CancelMode,
  cancelFutureDuplicates: boolean,
  notifyPRCancel: boolean,
  notifyPRMessageStart: string,
  jobNameRegexps: string[],
  skipEventTypes: string[],
  reason: string,
  selfPreservation: boolean
): Promise<number[]> {
  const statusValues = ['queued', 'in_progress']
  const workflowRuns = await getWorkflowRunsMatchingCriteria(
    repositoryInfo,
    sourceWorkflowId,
    statusValues,
    cancelMode,
    triggeringRunInfo
  )
  const mapOfWorkflowRunCandidatesCandidatesToCancel = await filterAndMapWorkflowRunsToGroups(
    repositoryInfo,
    sourceWorkflowId,
    triggeringRunInfo,
    cancelMode,
    cancelFutureDuplicates,
    jobNameRegexps,
    skipEventTypes,
    selfRunId,
    selfPreservation,
    workflowRuns
  )
  return await cancelTheRunsPerGroup(
    repositoryInfo,
    mapOfWorkflowRunCandidatesCandidatesToCancel,
    cancelMode,
    cancelFutureDuplicates,
    notifyPRCancel,
    selfRunId,
    reason
  )
}

/**
 * Returns environment variable that is required - throws error if it is not defined.
 * @param key key for the env variable
 * @return value of the env variable
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (value === undefined) {
    const message = `${key} was not defined.`
    throw new Error(message)
  }
  return value
}

/**
 * Gets source run using  of the runId - if this is a workflow run, it returns the information about the source run
 * @param repositoryInfo - information about the repository used
 * @param runId - run id of the run to check
 * @return information about the triggering run
 */
async function getTriggeringRunInfo(
  repositoryInfo: RepositoryInfo,
  runId: number
): Promise<TriggeringRunInfo> {
  const reply = await repositoryInfo.octokit.actions.getWorkflowRun({
    owner: repositoryInfo.owner,
    repo: repositoryInfo.repo,
    // eslint-disable-next-line @typescript-eslint/camelcase
    run_id: runId
  })
  const sourceRun = reply.data
  core.info(
    `Source workflow: Head repo: ${sourceRun.head_repository.full_name}, ` +
      `Head branch: ${sourceRun.head_branch} ` +
      `Event: ${sourceRun.event}, Head sha: ${sourceRun.head_sha}, url: ${sourceRun.url}`
  )
  let pullRequest: rest.PullsListResponseItem | null = null
  if (sourceRun.event === 'pull_request') {
    pullRequest = await findPullRequest(
      repositoryInfo,
      sourceRun.head_repository.owner.login,
      sourceRun.head_branch,
      sourceRun.head_sha
    )
  }

  return {
    workflowId: retrieveWorkflowIdFromUrl(reply.data.workflow_url),
    runId,
    headRepo: reply.data.head_repository.full_name,
    headBranch: reply.data.head_branch,
    headSha: reply.data.head_sha,
    mergeCommitSha: pullRequest ? pullRequest.merge_commit_sha : null,
    pullRequest: pullRequest ? pullRequest : null,
    eventName: reply.data.event
  }
}

/**
 * Performs the actual cancelling.
 *
 * @param repositoryInfo - information about the repository used
 * @param selfRunId - number of own run id
 * @param sourceWorkflowId - id of the workflow to act on
 * @param triggeringRunInfo - information about the workflow that triggered the run
 * @param cancelMode - cancel mode used
 * @param notifyPRCancel - whether to notify in PRs about cancelling
 * @param notifyPRCancelMessage - message to send when cancelling the PR (overrides default message
 *        generated automatically)
 * @param notifyPRMessageStart - whether to notify PRs when the action starts
 * @param jobNameRegexps - array of regular expressions to match hob names in case of named modes
 * @param skipEventTypes - array of event names that should be skipped
 * @param cancelFutureDuplicates - whether to cancel future duplicates for duplicate cancelling
 * @param selfPreservation - whether the run will cancel itself if requested
 */
async function performCancelJob(
  repositoryInfo: RepositoryInfo,
  selfRunId: number,
  sourceWorkflowId: string | number,
  triggeringRunInfo: TriggeringRunInfo,
  cancelMode: CancelMode,
  notifyPRCancel: boolean,
  notifyPRCancelMessage: string,
  notifyPRMessageStart: string,
  jobNameRegexps: string[],
  skipEventTypes: string[],
  cancelFutureDuplicates: boolean,
  selfPreservation: boolean
): Promise<number[]> {
  core.info(
    '\n###################################################################################\n'
  )
  core.info(
    `All parameters: owner: ${repositoryInfo.owner}, repo: ${repositoryInfo.repo}, ` +
      `run id: ${triggeringRunInfo.runId}, Source workflow id: ${sourceWorkflowId}, ` +
      `head repo ${triggeringRunInfo.headRepo}, headBranch: ${triggeringRunInfo.headBranch}, ` +
      `sourceEventName: ${triggeringRunInfo.eventName}, ` +
      `cancelMode: ${cancelMode}, jobNames: ${jobNameRegexps}`
  )
  core.info(
    '\n###################################################################################\n'
  )
  let reason = ''
  if (cancelMode === CancelMode.SELF) {
    core.info(
      `# Cancelling source run: ${triggeringRunInfo.runId} ` +
        `for workflow ${triggeringRunInfo.workflowId}.`
    )
    reason = notifyPRCancelMessage
      ? notifyPRCancelMessage
      : `The job has been cancelled by another workflow.`
  } else if (cancelMode === CancelMode.FAILED_JOBS) {
    core.info(
      `# Cancel all runs for workflow ${triggeringRunInfo.workflowId} ` +
        `where job names matching ${jobNameRegexps} failed.`
    )
    reason = `It has some failed jobs matching ${jobNameRegexps}.`
  } else if (cancelMode === CancelMode.NAMED_JOBS) {
    core.info(
      `# Cancel all runs for workflow ${triggeringRunInfo.workflowId} ` +
        `have job names matching ${jobNameRegexps}.`
    )
    reason = `It has jobs matching ${jobNameRegexps}.`
  } else if (cancelMode === CancelMode.DUPLICATES) {
    core.info(
      `# Cancel duplicate runs for workflow ${triggeringRunInfo.workflowId} ` +
        `for same triggering branch as own run Id.`
    )
    reason = `It is an earlier duplicate of ${triggeringRunInfo.workflowId} run.`
  } else if (cancelMode === CancelMode.ALL_DUPLICATES) {
    core.info(
      `# Cancel all duplicates runs started for workflow ${triggeringRunInfo.workflowId}.`
    )
    reason = `It is an earlier duplicate of ${triggeringRunInfo.workflowId} run.`
  } else if (cancelMode === CancelMode.ALL_DUPLICATED_NAMED_JOBS) {
    core.info(
      `# Cancel all duplicate named jobs matching the patterns ${jobNameRegexps}.`
    )
    reason = `It is an earlier duplicate of ${triggeringRunInfo.workflowId} run.`
  } else {
    throw Error(`Wrong cancel mode ${cancelMode}! Please correct it.`)
  }
  core.info(
    '\n###################################################################################\n'
  )

  return await findAndCancelRuns(
    repositoryInfo,
    selfRunId,
    sourceWorkflowId,
    triggeringRunInfo,
    cancelMode,
    cancelFutureDuplicates,
    notifyPRCancel,
    notifyPRMessageStart,
    jobNameRegexps,
    skipEventTypes,
    reason,
    selfPreservation
  )
}

/**
 * Retrieves information about source workflow Id. Either from the current event or from the workflow
 * nme specified. If the file name is not specified, the workflow to act on is either set to self event
 * or in case of workflow_run event - to the workflow id that triggered the 'workflow_run' event.
 *
 * @param repositoryInfo - information about the repository used
 * @param workflowFileName - optional workflow file name
 * @param runId - run id of the workflow
 * @param selfRunId - self run id
 * @return workflow id that is associate with the workflow we are going to act on.
 */
async function retrieveWorkflowId(
  repositoryInfo: RepositoryInfo,
  workflowFileName: string | null,
  runId: number,
  selfRunId: number
): Promise<string | number> {
  let workflowId
  if (workflowFileName) {
    workflowId = workflowFileName
    core.info(
      `\nFinding runs for another workflow found by ${workflowFileName} name: ${workflowId}\n`
    )
  } else {
    workflowId = await getWorkflowId(repositoryInfo, runId)
    if (runId === selfRunId) {
      core.info(`\nFinding runs for my own workflow ${workflowId}\n`)
    } else {
      core.info(`\nFinding runs for source workflow ${workflowId}\n`)
    }
  }
  return workflowId
}
/**
 * Sets output but also prints the output value in the logs.
 *
 * @param name name of the output
 * @param value value of the output
 */
function verboseOutput(name: string, value: string): void {
  core.info(`Setting output: ${name}: ${value}`)
  core.setOutput(name, value)
}

/**
 * Performs sanity check of the parameters passed. Some of the parameter combinations do not work so they
 * are verified and in case od unexpected combination found, appropriate error is raised.
 *
 * @param eventName - name of the event to act on
 * @param runId - run id of the triggering event
 * @param selfRunId - our own run id
 * @param cancelMode - cancel mode used
 * @param cancelFutureDuplicates - whether future duplicate cancelling is enabled
 * @param jobNameRegexps - array of regular expression of job names
 */
function performSanityChecks(
  eventName: string,
  runId: number,
  selfRunId: number,
  cancelMode: CancelMode,
  cancelFutureDuplicates: boolean,
  jobNameRegexps: string[]
): void {
  if (
    eventName === 'workflow_run' &&
    runId === selfRunId &&
    cancelMode === CancelMode.DUPLICATES
  ) {
    throw Error(
      `You cannot run "workflow_run" in ${cancelMode} cancelMode without "sourceId" input.` +
        'It will likely not work as you intended - it will cancel runs which are not duplicates!' +
        'See the docs for details.'
    )
  }

  if (
    jobNameRegexps.length > 0 &&
    [
      CancelMode.DUPLICATES,
      CancelMode.SELF,
      CancelMode.ALL_DUPLICATES
    ].includes(cancelMode)
  ) {
    throw Error(
      `You cannot specify jobNamesRegexps on ${cancelMode} cancelMode.`
    )
  }

  if (
    jobNameRegexps.length === 0 &&
    [
      CancelMode.NAMED_JOBS,
      CancelMode.FAILED_JOBS,
      CancelMode.ALL_DUPLICATED_NAMED_JOBS
    ].includes(cancelMode)
  ) {
    throw Error(`You must specify jobNamesRegexps on ${cancelMode} cancelMode.`)
  }

  if (
    (cancelMode === CancelMode.ALL_DUPLICATES ||
      cancelMode === CancelMode.ALL_DUPLICATED_NAMED_JOBS) &&
    !cancelFutureDuplicates
  ) {
    throw Error(
      `The  ${cancelMode} cancelMode has to have cancelFutureDuplicates set to true.`
    )
  }
}

/**
 * Produces basic outputs for the action. This does not include cancelled workflow run id - those are
 * set after cancelling is done.
 *
 * @param triggeringRunInfo
 */
function produceBasicOutputs(triggeringRunInfo: TriggeringRunInfo): void {
  verboseOutput('sourceHeadRepo', triggeringRunInfo.headRepo)
  verboseOutput('sourceHeadBranch', triggeringRunInfo.headBranch)
  verboseOutput('sourceHeadSha', triggeringRunInfo.headSha)
  verboseOutput('sourceEvent', triggeringRunInfo.eventName)
  verboseOutput(
    'pullRequestNumber',
    triggeringRunInfo.pullRequest
      ? triggeringRunInfo.pullRequest.number.toString()
      : ''
  )
  verboseOutput(
    'mergeCommitSha',
    triggeringRunInfo.mergeCommitSha ? triggeringRunInfo.mergeCommitSha : ''
  )
  verboseOutput(
    'targetCommitSha',
    triggeringRunInfo.mergeCommitSha
      ? triggeringRunInfo.mergeCommitSha
      : triggeringRunInfo.headSha
  )
}

/**
 * Notifies the PR that the action has started.
 *
 * @param repositoryInfo information about the repository
 * @param triggeringRunInfo information about the triggering workflow
 * @param selfRunId self run id
 * @param notifyPRMessageStart whether to notify about the start of the action
 */
async function notifyActionStart(
  repositoryInfo: RepositoryInfo,
  triggeringRunInfo: TriggeringRunInfo,
  selfRunId: number,
  notifyPRMessageStart: string
): Promise<void> {
  if (notifyPRMessageStart && triggeringRunInfo.pullRequest) {
    const selfWorkflowRunUrl =
      `https://github.com/${repositoryInfo.owner}/${repositoryInfo.repo}` +
      `/actions/runs/${selfRunId}`
    await repositoryInfo.octokit.issues.createComment({
      owner: repositoryInfo.owner,
      repo: repositoryInfo.repo,
      // eslint-disable-next-line @typescript-eslint/camelcase
      issue_number: triggeringRunInfo.pullRequest.number,
      body: `${notifyPRMessageStart} [The workflow run](${selfWorkflowRunUrl})`
    })
  }
}

/**
 * Main run method that does everything :)
 */
async function run(): Promise<void> {
  const token = core.getInput('token', {required: true})
  const octokit = new github.GitHub(token)
  const selfRunId = parseInt(getRequiredEnv('GITHUB_RUN_ID'))
  const repository = getRequiredEnv('GITHUB_REPOSITORY')
  const eventName = getRequiredEnv('GITHUB_EVENT_NAME')
  const cancelMode =
    (core.getInput('cancelMode') as CancelMode) || CancelMode.DUPLICATES
  const notifyPRCancel =
    (core.getInput('notifyPRCancel') || 'false').toLowerCase() === 'true'
  const notifyPRCancelMessage = core.getInput('notifyPRCancelMessage')
  const notifyPRMessageStart = core.getInput('notifyPRMessageStart')
  const sourceRunId = parseInt(core.getInput('sourceRunId')) || selfRunId
  const jobNameRegexpsString = core.getInput('jobNameRegexps')
  const selfPreservation =
    (core.getInput('selfPreservation') || 'true').toLowerCase() === 'true'
  const cancelFutureDuplicates =
    (core.getInput('cancelFutureDuplicates') || 'true').toLowerCase() === 'true'
  const jobNameRegexps = jobNameRegexpsString
    ? JSON.parse(jobNameRegexpsString)
    : []

  const skipEventTypesString = core.getInput('skipEventTypes')
  const skipEventTypes = skipEventTypesString
    ? JSON.parse(skipEventTypesString)
    : []
  const workflowFileName = core.getInput('workflowFileName')

  const [owner, repo] = repository.split('/')

  const repositoryInfo: RepositoryInfo = {
    octokit,
    owner,
    repo
  }
  core.info(
    `\nGetting workflow id for source run id: ${sourceRunId}, owner: ${owner}, repo: ${repo},` +
      ` skipEventTypes: ${skipEventTypes}\n`
  )
  const sourceWorkflowId = await retrieveWorkflowId(
    repositoryInfo,
    workflowFileName,
    sourceRunId,
    selfRunId
  )

  performSanityChecks(
    eventName,
    sourceRunId,
    selfRunId,
    cancelMode,
    cancelFutureDuplicates,
    jobNameRegexps
  )

  core.info(
    `Repository: ${repository}, Owner: ${owner}, Repo: ${repo}, ` +
      `Event name: ${eventName}, CancelMode: ${cancelMode}, ` +
      `sourceWorkflowId: ${sourceWorkflowId}, sourceRunId: ${sourceRunId}, selfRunId: ${selfRunId}, ` +
      `jobNames: ${jobNameRegexps}`
  )

  const triggeringRunInfo = await getTriggeringRunInfo(
    repositoryInfo,
    sourceRunId
  )
  produceBasicOutputs(triggeringRunInfo)

  await notifyActionStart(
    repositoryInfo,
    triggeringRunInfo,
    selfRunId,
    notifyPRMessageStart
  )

  const cancelledRuns = await performCancelJob(
    repositoryInfo,
    selfRunId,
    sourceWorkflowId,
    triggeringRunInfo,
    cancelMode,
    notifyPRCancel,
    notifyPRCancelMessage,
    notifyPRMessageStart,
    jobNameRegexps,
    skipEventTypes,
    cancelFutureDuplicates,
    selfPreservation
  )

  verboseOutput('cancelledRuns', JSON.stringify(cancelledRuns))
}

run()
  .then(() =>
    core.info('\n############### Cancel complete ##################\n')
  )
  .catch(e => core.setFailed(e.message))
