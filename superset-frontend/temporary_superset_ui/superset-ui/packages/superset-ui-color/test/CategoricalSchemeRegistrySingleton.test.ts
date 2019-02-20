import { CategoricalScheme, getCategoricalSchemeRegistry } from '../src';

describe('CategoricalSchemeRegistry', () => {
  it('has default value out-of-the-box', () => {
    expect(getCategoricalSchemeRegistry().get()).toBeInstanceOf(CategoricalScheme);
  });
});
