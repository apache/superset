/* eslint-env node */
const path = require('path');
const assert = require('yeoman-assert');
const helpers = require('yeoman-test');

describe('generator-superset:plugin-chart', () => {
  let dir;

  beforeAll(() => {
    dir = process.cwd();

    return helpers
      .run(path.join(__dirname, '../generators/plugin-chart'))
      .withPrompts({ packageName: 'cold-map', description: 'Cold Map' })
      .withOptions({ skipInstall: true });
  });

  /*
   * Change working directory back to original working directory
   * after the test has completed.
   * yeoman tests switch to tmp directory and write files there.
   * Usually this is fine for solo package.
   * However, for a monorepo like this one,
   * it made jest confuses with current directory
   * (being in tmp directory instead of superset-ui root)
   * and interferes with other tests in sibling packages
   * that are run after the yeoman tests.
   */
  afterAll(() => {
    process.chdir(dir);
  });

  it('creates files', () => {
    assert.file([
      'package.json',
      'README.md',
      'src/plugin/buildQuery.ts',
      'src/plugin/controlPanel.ts',
      'src/plugin/index.ts',
      'src/plugin/transformProps.ts',
      'src/ColdMap.tsx',
      'src/index.ts',
      'test/index.test.ts',
      'test/plugin/buildQuery.test.ts',
      'test/plugin/transformProps.test.ts',
      'types/external.d.ts',
      'src/images/thumbnail.png',
    ]);
  });
});
