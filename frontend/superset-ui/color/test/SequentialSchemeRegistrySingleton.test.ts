import { SequentialScheme, getSequentialSchemeRegistry } from '../src';

describe('SequentialSchemeRegistry', () => {
  it('has default value out-of-the-box', () => {
    expect(getSequentialSchemeRegistry().get()).toBeInstanceOf(SequentialScheme);
  });
});
