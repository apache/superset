const core = require('@actions/core');
const github = require('@actions/github');

function getActionFromComment(comment) {
  return comment.split(/\s+/)[1];
}

function getArgFromComment(comment, argNumber) {
  const parts = comment.match(/"[^"]+"|\S+/g).map(arg => arg.replace(/"/g, ''));
  return parts[argNumber] || '';
}

async function run() {
  try {
    const token = process.env.GITHUB_TOKEN;
    const commentBody = process.env.COMMENT_BODY.trim();
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const issue_number = github.context.issue.number;

    // Check if comment contains command
    if (!commentBody.includes("@supersetbot")) {
      console.log("No action needed.");
      return;
    }

    // Extracting command and parameters
    const command = getActionFromComment(commentBody);

    if (command === "label") {
      const label = getArgFromComment(1);
      // Add label
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number,
        labels: [label],
      });
    } else if (command === "unlabel") {
      // Remove label
      const label = getArgFromComment(1);
      await octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number,
        name: label,
      }).catch(error => {
      // Handle the case where the label does not exist to avoid failing the action
      if (error.status !== 404) {
        throw error;
      }
      });
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
