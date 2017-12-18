import { it, describe } from 'mocha';
import { expect } from 'chai';

import sandboxedEval from '../../../javascripts/modules/sandbox';

describe('unitToRadius', () => {
  it('works like a basic eval', () => {
    expect(sandboxedEval('100')).to.equal(100);
    expect(sandboxedEval('v => v * 2')(5)).to.equal(10);
  });
  it('d3 is in context and works', () => {
    expect(sandboxedEval("v => d3.format('.3s')(v)")(10000000)).to.equal('10.0M');
  });
  it('passes context as expected', () => {
    expect(sandboxedEval('foo', { foo: 'bar' })).to.equal('bar');
  });
});
