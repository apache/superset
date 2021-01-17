/**
 * Manage inputs and env variables.
 */
import * as core from '@actions/core';
import {
  Inputs,
  EnvVariableNames,
  InputName,
  DefaultInputs,
} from '../constants';

export function getInput(name: keyof Inputs): string {
  const value = core.getInput(name);
  if (name === InputName.Parallel) {
    return value.toUpperCase() === 'TRUE' ? value : '';
  }
  return value || DefaultInputs[name] || '';
}

/**
 * Update env variables associated with some inputs.
 * See: https://github.com/actions/toolkit/blob/5b940ebda7e7b86545fe9741903c930bc1191eb0/packages/core/src/core.ts#L69-L77 .
 *
 * @param {Inputs} inputs - The new inputs to apply to the env variables.
 */
export function setInputs(inputs: Inputs): void {
  for (const [name, value] of Object.entries(inputs)) {
    const envName = EnvVariableNames.has(name)
      ? name
      : `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
    process.env[envName] = value;
  }
}

/**
 * Apply new inputs and execute a runner function, restore them when done.
 *
 * @param {Inputs} inputs - The new inputs to apply to the env variables before
 *                          excuting the runner.
 * @param {runner} runner - The runner function that returns a promise.
 * @returns {Promise<any>} - The result from the runner function.
 */
export async function applyInputs(
  inputs: Inputs,
  runner: () => Promise<void>,
): Promise<any> {
  const originalInputs: Inputs = Object.fromEntries(
    Object.keys(inputs).map(name => [
      name,
      EnvVariableNames.has(name) ? process.env[name] : core.getInput(name),
    ]),
  );
  exports.setInputs(inputs);
  const result = await runner();
  exports.setInputs(originalInputs);
  return result;
}

export function maybeArrayToString(input: string[] | string) {
  return Array.isArray(input) ? input.join('\n') : input;
}
