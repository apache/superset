import { expect } from 'chai';
import { morph as mockEnv } from 'mock-env';

import mocks from '../build/mocks';
import impls from '../build';

function requireOnce(path) {
  const mod = require(path); // eslint-disable-line import/no-dynamic-require, global-require
  delete require.cache[require.resolve(path)];
  return mod;
}

describe('"main" entry point', () => {
  it('requires implementations in non-production', () => {
    ['', 'development', 'test'].forEach((NODE_ENV) => {
      const main = mockEnv(() => requireOnce('..'), { NODE_ENV });
      expect(main).to.equal(impls);
    });
  });

  it('requires mocks in production', () => {
    const main = mockEnv(() => requireOnce('..'), { NODE_ENV: 'production' });
    expect(main).to.equal(mocks);
  });
});
