import { SequentialScheme, getSequentialSchemeRegistry } from '@superset-ui/core/src/color';

describe('SequentialSchemeRegistry', () => {
  it('has default value out-of-the-box', () => {
    expect(getSequentialSchemeRegistry().get()).toBeInstanceOf(SequentialScheme);
  });
});
