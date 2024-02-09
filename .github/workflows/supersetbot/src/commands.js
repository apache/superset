export function commandWrapper(commandFunc, verbose = false) {
  return async (...args) => {
    console.log(`in commandWrapper ${verbose}`);
    try {
      const resp = await commandFunc(...args); // Use await to ensure the command function is executed properly
      if (verbose) {
        console.log(resp);
      }
    } catch (error) {
      if (verbose) {
        console.error('Error during operation:', error);
      } else {
        console.error('An error occurred. Use --verbose for more details.');
      }
      // Exit with a non-zero status code to indicate failure
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
