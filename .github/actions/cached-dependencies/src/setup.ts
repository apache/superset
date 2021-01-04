/**
 * Load inputs and execute.
 */
import * as core from '@actions/core';
import { exec } from '@actions/exec';
import path from 'path';
import fs from 'fs';
import { DefaultInputs, InputName } from './constants';
import { getInput } from './utils/inputs';

const SHARED_BASHLIB = path.resolve(__dirname, '../src/scripts/bashlib.sh');

/**
 * Run bash commands with predefined lib functions.
 *
 * @param {string} cmd - The bash commands to execute.
 */
export async function runCommand(
  cmd: string,
  extraBashlib: string,
): Promise<void> {
  const bashlibCommands = [`source ${SHARED_BASHLIB}`];
  if (extraBashlib) {
    bashlibCommands.push(`source ${extraBashlib}`);
  }
  try {
    await exec('bash', ['-c', [...bashlibCommands, cmd].join('\n     ')]);
  } catch (error) {
    core.setFailed(error.message);
    process.exit(1);
  }
}

export async function run(): Promise<void> {
  let bashlib = getInput(InputName.Bashlib);
  const rawCommands = getInput(InputName.Run);
  const runInParallel = getInput(InputName.Parallel);

  if (!fs.existsSync(bashlib)) {
    if (bashlib !== DefaultInputs[InputName.Bashlib]) {
      core.error(`Custom bashlib "${bashlib}" does not exist.`);
    }
    // don't add bashlib to runCommand
    bashlib = '';
  }

  if (runInParallel) {
    // Attempt to split by two or more new lines first, if there is still only
    // one command, attempt to split by one new line. This is because users
    // asked for parallelization, so we make our best efforts to get multiple
    // commands.
    let commands = rawCommands.split(/\n{2,}/);
    if (commands.length === 1) {
      commands = rawCommands.split('\n');
    }
    core.debug(`>> Run ${commands.length} commands in parallel...`);
    await Promise.all(
      commands
        .map(x => x.trim())
        .filter(x => !!x)
        .map(cmd => exports.runCommand(cmd, bashlib)),
    );
  } else if (rawCommands) {
    await exports.runCommand(rawCommands, bashlib);
  }
}
