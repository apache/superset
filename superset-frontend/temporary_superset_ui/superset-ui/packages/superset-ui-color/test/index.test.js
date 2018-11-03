import {
  CategoricalColorNamespace,
  CategoricalColorScale,
  CategoricalScheme,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  SequentialScheme,
} from '../src/index';

describe('index', () => {
  it('exports modules', () => {
    [
      CategoricalColorNamespace,
      CategoricalColorScale,
      CategoricalScheme,
      getCategoricalSchemeRegistry,
      getSequentialSchemeRegistry,
      SequentialScheme,
    ].forEach(x => expect(x).toBeDefined());
  });
});
