// DODO was here
import {
  CategoricalScheme,
  ColorScheme,
  ColorSchemeConfig,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  SequentialScheme,
  SequentialSchemeConfig,
  CategoricalAirbnb,
  CategoricalD3,
  CategoricalEcharts,
  CategoricalGoogle,
  CategoricalLyft,
  CategoricalPreset,
  CategoricalSuperset,
  CategoricalDodoCustom,
  SequentialCommon,
  SequentialD3,
  ColorSchemeRegistry,
} from '@superset-ui/core';

function registerColorSchemes<T extends ColorScheme>(
  registry: ColorSchemeRegistry<T>,
  colorSchemes: T[],
  standardDefaultKey: string,
) {
  colorSchemes.forEach(scheme => {
    registry.registerValue(scheme.id, scheme);
  });

  const defaultKey =
    colorSchemes.find(scheme => scheme.isDefault)?.id || standardDefaultKey;
  registry.setDefaultKey(defaultKey);
}

export default function setupColors(
  extraCategoricalColorSchemeConfigs: ColorSchemeConfig[] = [],
  extraSequentialColorSchemeConfigs: SequentialSchemeConfig[] = [],
) {
  const extraCategoricalColorSchemes = extraCategoricalColorSchemeConfigs.map(
    config => new CategoricalScheme(config),
  );
  const extraSequentialColorSchemes = extraSequentialColorSchemeConfigs.map(
    config => new SequentialScheme(config),
  );
  registerColorSchemes(
    // @ts-ignore
    getCategoricalSchemeRegistry(),
    [
      ...CategoricalAirbnb,
      ...CategoricalD3,
      ...CategoricalEcharts,
      ...CategoricalGoogle,
      ...CategoricalLyft,
      ...CategoricalPreset,
      ...CategoricalSuperset,
      ...CategoricalDodoCustom,
      ...extraCategoricalColorSchemes,
    ],
    'supersetColors',
  );
  registerColorSchemes(
    // @ts-ignore
    getSequentialSchemeRegistry(),
    [...SequentialCommon, ...SequentialD3, ...extraSequentialColorSchemes],
    'superset_seq_1',
  );
}
