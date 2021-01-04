import path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as core from '@actions/core';
import * as cache from '../src/cache';
import * as inputsUtils from '../src/utils/inputs';
import * as actionUtils from '@actions/cache/src/utils/actionUtils';
import defaultCaches from '../src/cache/caches';
import { setInputs, getInput, maybeArrayToString } from '../src/utils/inputs';
import { Inputs, InputName, GitHubEvent, EnvVariable } from '../src/constants';
import caches, { npmExpectedHash } from './fixtures/caches';

describe('patch core states', () => {
  it('should log error if states file invalid', () => {
    const logWarningMock = jest.spyOn(actionUtils, 'logWarning');
    fs.writeFileSync(`${os.tmpdir()}/cached--states.json`, 'INVALID_JSON', {
      encoding: 'utf-8',
    });
    core.getState('haha');
    expect(logWarningMock).toHaveBeenCalledTimes(2);
  });
  it('should persist state', () => {
    core.saveState('test', '100');
    expect(core.getState('test')).toStrictEqual('100');
  });
});

describe('cache runner', () => {
  it('should use default cache config', async () => {
    await cache.loadCustomCacheConfigs();
    // but `npm` actually come from `src/cache/caches.ts`
    const inputs = await cache.getCacheInputs('npm');
    expect(inputs?.[InputName.Path]).toStrictEqual(
      maybeArrayToString(defaultCaches.npm.path),
    );
    expect(inputs?.[InputName.RestoreKeys]).toStrictEqual('npm-');
  });

  it('should override cache config', async () => {
    setInputs({
      [InputName.Caches]: path.resolve(__dirname, 'fixtures/caches'),
    });
    await cache.loadCustomCacheConfigs();

    const inputs = await cache.getCacheInputs('npm');
    expect(inputs?.[InputName.Path]).toStrictEqual(
      maybeArrayToString(caches.npm.path),
    );
    expect(inputs?.[InputName.Key]).toStrictEqual(`npm-${npmExpectedHash}`);
    expect(inputs?.[InputName.RestoreKeys]).toStrictEqual(
      maybeArrayToString(caches.npm.restoreKeys),
    );
  });

  it('should apply inputs and restore cache', async () => {
    setInputs({
      [InputName.Caches]: path.resolve(__dirname, 'fixtures/caches'),
      [EnvVariable.GitHubEventName]: GitHubEvent.PullRequest,
    });

    const setInputsMock = jest.spyOn(inputsUtils, 'setInputs');
    const inputs = await cache.getCacheInputs('npm');
    const result = await cache.run('restore', 'npm');

    expect(result).toBeUndefined();

    // before run
    expect(setInputsMock).toHaveBeenNthCalledWith(1, inputs);

    // after run
    expect(setInputsMock).toHaveBeenNthCalledWith(2, {
      [InputName.Key]: '',
      [InputName.Path]: '',
      [InputName.RestoreKeys]: '',
    });

    // inputs actually restored to original value
    expect(getInput(InputName.Key)).toStrictEqual('');

    // pretend still in execution context
    setInputs(inputs as Inputs);

    // `core.getState` should return the primary key
    expect(core.getState('CACHE_KEY')).toStrictEqual(inputs?.[InputName.Key]);

    setInputsMock.mockRestore();
  });

  it('should run saveCache', async () => {
    // call to save should also work
    const logWarningMock = jest.spyOn(actionUtils, 'logWarning');

    setInputs({
      [InputName.Parallel]: 'true',
    });
    await cache.run('save', 'npm');
    expect(logWarningMock).toHaveBeenCalledWith(
      'Cache Service Url not found, unable to restore cache.',
    );
  });

  it('should exit on invalid args', async () => {
    // other calls do generate errors
    const processExitMock = jest
      .spyOn(process, 'exit')
      // @ts-ignore
      .mockImplementation(() => {});

    // incomplete arguments
    await cache.run();
    await cache.run('save');

    // bad arguments
    await cache.run('save', 'unknown-cache');
    await cache.run('unknown-action', 'unknown-cache');

    setInputs({
      [InputName.Caches]: 'non-existent',
    });
    await cache.run('save', 'npm');

    expect(processExitMock).toHaveBeenCalledTimes(5);
  });
});
