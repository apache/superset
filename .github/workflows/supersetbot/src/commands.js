export function commandWrapper(commandFunc, verbose = false) {
  return async (...args) => {
    try {
      const resp = await commandFunc(...args); // Use await to ensure the command function is executed properly
      if (verbose) {
        console.log(resp);
      }
    } catch (error) {
      console.error(`Error during operation: ${error}`);
      if (verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  };
}

// -------------------------------------
// Individual commands
// -------------------------------------
export function label(issueNumber, label, { github, context }) {
  return github.rest.issues.addLabels({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    labels: [label],
  });
}

export function unlabel(issueNumber, label, { github, context }) {
  return github.rest.issues.removeLabel({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    name: label,
  });
}
