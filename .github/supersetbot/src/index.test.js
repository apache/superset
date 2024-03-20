// import * as stringArgv from 'string-argv';
import { jest } from '@jest/globals';

import Context from './context.js';
import Github from './github.js';
import * as index from './index.js';

describe('runCommandFromGithubAction', () => {
  const labelSpy = jest.spyOn(Github.prototype, 'label').mockImplementation(jest.fn());
  // mocking some of the Context object
  const onDoneSpy = jest.spyOn(Context.prototype, 'onDone');
  const doneCommentSpy = jest.spyOn(Context.prototype, 'doneComment');
  const parseArgsSpy = jest.spyOn(Context.prototype, 'parseArgs');
  jest.spyOn(Github.prototype, 'createComment').mockImplementation(jest.fn());

  let originalEnv;

  afterEach(() => {
    process.env = originalEnv;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env;
    process.env.GITHUB_ISSUE_NUMBER = '666';
    process.env.GITHUB_REPOSITORY = 'apache/superset';
  });

  it('should strip the command', async () => {
    await index.runCommandFromGithubAction('  @supersetbot label test-label  ');
    expect(parseArgsSpy).toHaveBeenCalledWith('supersetbot label test-label');

    await index.runCommandFromGithubAction('  \n  @supersetbot label test-label  \n \n   \n');
    expect(parseArgsSpy).toHaveBeenCalledWith('supersetbot label test-label');

    await index.runCommandFromGithubAction('  \n \t@supersetbot label test-label \t  \n \n\t   \n');
    expect(parseArgsSpy).toHaveBeenCalledWith('supersetbot label test-label');
  });

  it('should parse the raw command correctly and call commands.label and context.onDone', async () => {
    await index.runCommandFromGithubAction('@supersetbot label test-label');

    expect(labelSpy).toHaveBeenCalled();
    expect(onDoneSpy).toHaveBeenCalled();
  });

  it('should generate a good comment message', async () => {
    await index.runCommandFromGithubAction('@supersetbot label test-label');
    const comment = doneCommentSpy.mock.results[0].value;
    expect(comment).toContain('> `supersetbot label test-label`');
  });
});
