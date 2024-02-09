#!/usr/bin/env node
// Assuming dispatcher.js and cli.js are set up as previously described

import { program } from 'commander';
import * as commands from './commands.js';
import * as contextUtils from './context.js';

const envContext = contextUtils.getEnvContext();

// Setting up top-level CLI options
program
  .option('-v, --verbose', 'Output extra debugging information')
  .action((cmd) => {
    verboseFlag = cmd.verbose;
  });

const wrap = (f) => {
  console.log('WRAP');
  const { verbose } = program.opts();
  return commands.commandWrapper(f, verbose);
};

// Building the CLI dynamically based on context
if (envContext.source === 'GHA') {
  const issueNumber = contextUtils.getIssueNumber(envContext.context);
  const command = contextUtils.getComand(envContext.context);
  program
    .command('label <label>')
    .action((label) => {
      wrap(commands.label)(issueNumber, label, envContext);
    });
  program
    .command('unlabel <label>')
    .action((label) => {
      wrap(commands.unlabel)(issueNumber, label, envContext);
    });
  program.parse(command);
} else if (envContext.source === 'CLI') {
  program
    .command('label <issueNumber> <label>')
    .action((issueNumber, label) => {
      wrap(commands.label)(issueNumber, label, envContext);
    });

  program
    .command('unlabel <issueNumber> <label>')
    .action((issueNumber, label) => {
      wrap(commands.label)(issueNumber, label, envContext);
    });
  program.parse(process.argv);
}

// Function to parse a raw string with Commander
function parseRawStringWithCommander(rawString) {
  // Split the raw string into arguments and prepend with dummy values for Node and script paths
  const args = rawString.split(/\s+/);
  const simulatedArgv = ['node', 'script.js', ...args];

  // Use Commander to parse the simulated argv array
  program.parse(simulatedArgv, { from: 'user' });
}
