import { configure, t } from '../src/index';

describe('index', () => {
  it('exports configure()', () => {
    expect(configure).toBeDefined();
    expect(configure).toBeInstanceOf(Function);
  });
  it('exports t()', () => {
    expect(t).toBeDefined();
    expect(t).toBeInstanceOf(Function);
  });
});
