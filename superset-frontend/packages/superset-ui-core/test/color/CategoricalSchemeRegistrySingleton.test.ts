import { CategoricalScheme, getCategoricalSchemeRegistry } from '@superset-ui/core/src/color';

describe('CategoricalSchemeRegistry', () => {
  it('has default value out-of-the-box', () => {
    expect(getCategoricalSchemeRegistry().get()).toBeInstanceOf(CategoricalScheme);
  });
});
