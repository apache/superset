import assert from 'assert';
import core from '@actions/core';
import { describe, it, afterEach } from 'mocha';
import sinon from 'sinon';
import nock from 'nock';
import { main, getFullConfig } from '../src/action.js';

nock.disableNetConnect();
nock.enableNetConnect('localhost');

describe('linkinator action', () => {
  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  it('should return ok for a valid README', async () => {
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/test.md');
    inputStub.returns('');
    const setOutputStub = sinon.stub(core, 'setOutput');
    const setFailedStub = sinon.stub(core, 'setFailed');
    const infoStub = sinon.stub(core, 'info');
    const scope = nock('http://fake.local')
      .head('/').reply(200)
      .head('/fake').reply(200);
    await main();
    assert.ok(inputStub.called);
    assert.ok(setOutputStub.called);
    assert.ok(setFailedStub.notCalled);
    assert.ok(infoStub.called);
    scope.done();
  });

  it('should call setFailed on failures', async () => {
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/test.md');
    inputStub.returns('');
    sinon.stub(core, 'setOutput');
    const errorStub = sinon.stub(core, 'error');
    const infoStub = sinon.stub(core, 'info');
    const setFailedStub = sinon.stub(core, 'setFailed');
    const scope = nock('http://fake.local')
      .head('/').reply(404)
      .head('/fake').reply(404);
    await main();
    assert.ok(inputStub.called);
    assert.ok(setFailedStub.called);
    assert.ok(infoStub.called);
    assert.ok(errorStub.called);
    scope.done();
  });

  it('should surface exceptions from linkinator with call stack', async () => {
    const inputStub = sinon.stub(core, 'getInput').throws(new Error('😱'));
    const setFailedStub = sinon.stub(core, 'setFailed');
    await main();
    assert.ok(inputStub.called);
    assert.ok(setFailedStub.called);
    assert.ok(setFailedStub.firstCall.firstArg.includes('test.js:'));
  });

  it('should handle linksToSkip', async () => {
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/test.md');
    inputStub.withArgs('linksToSkip').returns('http://fake.local,http://fake.local/fake');
    inputStub.returns('');
    const infoStub = sinon.stub(core, 'info');
    const setOutputStub = sinon.stub(core, 'setOutput');
    sinon.stub(core, 'setFailed').callsFake(output => {
      throw new Error(output);
    });
    await main();
    assert.ok(inputStub.called);
    assert.ok(infoStub.called);
    assert.ok(setOutputStub.called);
  });

  it('should handle skips and spaces', async () => {
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/test.md');
    inputStub.withArgs('skip').returns('http://fake.local http://fake.local/fake');
    inputStub.returns('');
    const infoStub = sinon.stub(core, 'info');
    const setOutputStub = sinon.stub(core, 'setOutput');
    sinon.stub(core, 'setFailed').callsFake(output => {
      throw new Error(output);
    });
    await main();
    assert.ok(inputStub.called);
    assert.ok(infoStub.called);
    assert.ok(setOutputStub.called);
  });

  it('should handle multiple paths', async () => {
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/test.md, test/fixtures/test2.md');
    inputStub.returns('');
    const setOutputStub = sinon.stub(core, 'setOutput');
    const infoStub = sinon.stub(core, 'info');
    sinon.stub(core, 'setFailed').callsFake(output => {
      throw new Error(output);
    });
    const scope = nock('http://fake.local')
      .head('/').reply(200)
      .head('/fake').reply(200);
    await main();
    assert.ok(inputStub.called);
    assert.ok(infoStub.called);
    assert.ok(setOutputStub.called);
    scope.done();
  });

  it('should respect verbosity set to ERROR', async () => {
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/test.md');
    inputStub.withArgs('verbosity').returns('ERROR');
    inputStub.returns('');
    const setOutputStub = sinon.stub(core, 'setOutput');
    const setFailedStub = sinon.stub(core, 'setFailed');
    const infoStub = sinon.stub(core, 'info');
    const errorStub = sinon.stub(core, 'error');
    const scope = nock('http://fake.local')
      .head('/').reply(200)
      .head('/fake').reply(500);
    await main();
    assert.ok(inputStub.called);
    assert.strictEqual(setOutputStub.callCount, 1);
    assert.strictEqual(setFailedStub.callCount, 1);

    // ensure `Scanning ...` is always shown
    assert.strictEqual(infoStub.getCalls().filter(x => {
      return x.args[0].startsWith('Scanning ');
    }).length, 1);

    // Ensure total count is always shown
    assert.strictEqual(setFailedStub.getCalls().filter(x => {
      return x.args[0] === 'Detected 1 broken links.\n test/fixtures/test.md\n   [500] http://fake.local/fake';
    }).length, 1);

    // Ensure `core.error` is called for each failure
    assert.strictEqual(errorStub.callCount, 1);
    const expected = '[500] http://fake.local/fake';
    assert.strictEqual(errorStub.getCalls()[0].args[0], expected);

    scope.done();
  });

  it('should show skipped links when verbosity is INFO', async () => {
    // Unset GITHUB_EVENT_PATH, so that no replacement is attempted.
    sinon.stub(process, 'env').value({
      GITHUB_EVENT_PATH: undefined
    });
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/test.md');
    inputStub.withArgs('skip').returns('http://fake.local/fake');
    inputStub.withArgs('verbosity').returns('INFO');
    inputStub.returns('');
    const setOutputStub = sinon.stub(core, 'setOutput');
    const setFailedStub = sinon.stub(core, 'setFailed');
    const infoStub = sinon.stub(core, 'info');
    const errorStub = sinon.stub(core, 'error');
    const scope = nock('http://fake.local').head('/').reply(200);
    await main();
    assert.ok(inputStub.called);
    assert.strictEqual(setOutputStub.callCount, 1);
    assert.ok(setFailedStub.notCalled);
    assert.ok(errorStub.notCalled);
    assert.strictEqual(infoStub.getCalls().length, 5);
    const expected = '[SKP] http://fake.local/fake';
    assert.ok(infoStub.getCalls().find(x => x.args[0] === expected));
    scope.done();
  });

  it('should show failure details when verbosity is DEBUG', async () => {
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/test.md');
    inputStub.withArgs('verbosity').returns('DEBUG');
    inputStub.returns('');
    const setOutputStub = sinon.stub(core, 'setOutput');
    const setFailedStub = sinon.stub(core, 'setFailed');
    const infoStub = sinon.stub(core, 'info');
    const errorStub = sinon.stub(core, 'error');
    const scope = nock('http://fake.local')
      .head('/').reply(200)
      .head('/fake').reply(500);
    await main();
    assert.ok(inputStub.called);
    assert.ok(infoStub.called);
    assert.strictEqual(setOutputStub.callCount, 1);
    assert.strictEqual(setFailedStub.callCount, 1);
    assert.strictEqual(errorStub.callCount, 1);
    const expected = /No match for request/;
    assert.ok(infoStub.getCalls().find(x => expected.test(x.args[0])));
    scope.done();
  });

  it('should respect local config with overrides', async () => {
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/test.md');
    inputStub.withArgs('config').returns('test/fixtures/config.json');
    inputStub.withArgs('concurrency').returns('100');
    inputStub.withArgs('recurse').returns('true');
    inputStub.withArgs('verbosity').returns('ERROR');
    inputStub.returns('');
    const config = await getFullConfig();
    assert.strictEqual(config.retry, true);
    assert.strictEqual(config.verbosity, 'ERROR');
    assert.strictEqual(config.concurrency, 100);
    assert.strictEqual(config.markdown, true);
    assert.strictEqual(config.recurse, true);
    assert.ok(inputStub.called);
  });

  it('should throw for invalid verbosity', async () => {
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/test.md');
    inputStub.withArgs('verbosity').returns('NOT_VALID');
    inputStub.returns('');
    const setFailedStub = sinon.stub(core, 'setFailed');
    await main();
    assert.ok(/must be one of/.test(setFailedStub.getCalls()[0].args[0]));
  });

  it('should respect url rewrite rules', async () => {
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/test.md');
    inputStub.withArgs('urlRewriteSearch').returns('fake.local');
    inputStub.withArgs('urlRewriteReplace').returns('real.remote');
    inputStub.returns('');
    const setOutputStub = sinon.stub(core, 'setOutput');
    const infoStub = sinon.stub(core, 'info');
    sinon.stub(core, 'setFailed').callsFake(output => {
      throw new Error(output);
    });
    const scope = nock('http://real.remote')
      .head('/').reply(200)
      .head('/fake').reply(200);
    await main();
    assert.ok(inputStub.called);
    assert.ok(infoStub.called);
    assert.ok(setOutputStub.called);
    scope.done();
  });

  it('should automatically rewrite urls on the incoming branch', async () => {
    sinon.stub(process, 'env').value({
      GITHUB_HEAD_REF: 'incoming',
      GITHUB_BASE_REF: 'main',
      GITHUB_REPOSITORY: 'JustinBeckwith/linkinator-action',
      GITHUB_EVENT_PATH: './test/fixtures/payload.json'
    });
    const inputStub = sinon.stub(core, 'getInput');
    inputStub.withArgs('paths').returns('test/fixtures/github.md');
    inputStub.returns('');
    const setOutputStub = sinon.stub(core, 'setOutput');
    const setFailedStub = sinon.stub(core, 'setFailed');
    const infoStub = sinon.stub(core, 'info');
    const scope = nock('https://github.com')
      .get('/Codertocat/Hello-World/blob/incoming/LICENSE').reply(200);
    await main();
    assert.ok(inputStub.called);
    assert.ok(setOutputStub.called);
    assert.ok(setFailedStub.notCalled);
    assert.ok(infoStub.called);
    scope.done();
  });
});
