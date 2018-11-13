import { RegistryWithDefaultKey } from '@superset-ui/core';

export default class ColorSchemeRegistry extends RegistryWithDefaultKey {
  constructor() {
    super({
      name: 'ColorScheme',
      setFirstItemAsDefault: true,
    });
  }
}
