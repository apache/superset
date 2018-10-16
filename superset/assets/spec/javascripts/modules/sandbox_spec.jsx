import sandboxedEval from '../../../src/modules/sandbox';

describe('sandboxedEval', () => {
  it('works like a basic eval', () => {
    expect(sandboxedEval('100')).toBe(100);
    expect(sandboxedEval('v => v * 2')(5)).toBe(10);
  });
  it('d3 is in context and works', () => {
    expect(sandboxedEval("l => _.find(l, s => s === 'bar')")(['foo', 'bar'])).toBe('bar');
  });
  it('passes context as expected', () => {
    expect(sandboxedEval('foo', { foo: 'bar' })).toBe('bar');
  });
});
