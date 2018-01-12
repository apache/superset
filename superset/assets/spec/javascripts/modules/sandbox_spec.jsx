import { it, describe } from 'mocha';
import { expect } from 'chai';

import sandboxedEval from '../../../javascripts/modules/sandbox';

describe('sandboxedEval', () => {
  it('works like a basic eval', () => {
    expect(sandboxedEval('100')).to.equal(100);
    expect(sandboxedEval('v => v * 2')(5)).to.equal(10);
  });
  it('d3 is in context and works', () => {
    expect(sandboxedEval("l => _.find(l, s => s === 'bar')")(['foo', 'bar'])).to.equal('bar');
  });
  it('passes context as expected', () => {
    expect(sandboxedEval('foo', { foo: 'bar' })).to.equal('bar');
  });
});
