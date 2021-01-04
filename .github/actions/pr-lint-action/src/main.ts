import { OctokitResponse, PullsListReviewsResponseData } from "@octokit/types";
import * as core from "@actions/core";
import * as github from "@actions/github";

const repoTokenInput = core.getInput("repo-token", { required: true });
const githubClient = github.getOctokit(repoTokenInput);

const titleRegexInput: string = core.getInput("title-regex", {
  required: true,
});
const onFailedRegexCreateReviewInput: boolean =
  core.getInput("on-failed-regex-create-review") == "true";
const onFailedRegexCommentInput: string = core.getInput(
  "on-failed-regex-comment"
);
const onFailedRegexFailActionInput: boolean =
  core.getInput("on-failed-regex-fail-action") == "true";
const onFailedRegexRequestChanges: boolean =
  core.getInput("on-failed-regex-request-changes") == "true";

async function run(): Promise<void> {
  const githubContext = github.context;
  const pullRequest = githubContext.issue;

  const titleRegex = new RegExp(titleRegexInput);
  const title: string =
    (githubContext.payload.pull_request?.title as string) ?? "";
  const comment = onFailedRegexCommentInput.replace(
    "%regex%",
    titleRegex.source
  );

  core.debug(`Title Regex: ${titleRegex.source}`);
  core.debug(`Title: ${title}`);

  const titleMatchesRegex: boolean = titleRegex.test(title);
  if (!titleMatchesRegex) {
    if (onFailedRegexCreateReviewInput) {
      createReview(comment, pullRequest);
    }
    if (onFailedRegexFailActionInput) {
      core.setFailed(comment);
    }
  } else {
    if (onFailedRegexCreateReviewInput) {
      await dismissReview(pullRequest);
    }
  }
}

function createReview(
  comment: string,
  pullRequest: { owner: string; repo: string; number: number }
) {
  void githubClient.pulls.createReview({
    owner: pullRequest.owner,
    repo: pullRequest.repo,
    pull_number: pullRequest.number,
    body: comment,
    event: onFailedRegexRequestChanges ? "REQUEST_CHANGES" : "COMMENT",
  });
}

async function dismissReview(pullRequest: {
  owner: string;
  repo: string;
  number: number;
}) {
  const reviews: OctokitResponse<PullsListReviewsResponseData> = await githubClient.pulls.listReviews(
    {
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      pull_number: pullRequest.number,
    }
  );

  reviews.data.forEach(
    (review: { id: number; user: { login: string }; state: string }) => {
      if (
        isGitHubActionUser(review.user.login) &&
        alreadyRequiredChanges(review.state)
      ) {
        void githubClient.pulls.dismissReview({
          owner: pullRequest.owner,
          repo: pullRequest.repo,
          pull_number: pullRequest.number,
          review_id: review.id,
          message: "All good!",
        });
      }
    }
  );
}

function isGitHubActionUser(login: string) {
  return login == "github-actions[bot]";
}

function alreadyRequiredChanges(state: string) {
  return state == "CHANGES_REQUESTED";
}

run().catch((error) => {
  core.setFailed(error);
});
