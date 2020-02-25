import { RegistryWithDefaultKey, OverwritePolicy } from '@superset-ui/core';

export default class ColorSchemeRegistry<T> extends RegistryWithDefaultKey<T> {
  constructor() {
    super({
      name: 'ColorScheme',
      overwritePolicy: OverwritePolicy.WARN,
      setFirstItemAsDefault: true,
    });
  }

  get(key?: string) {
    return super.get(key) as T | undefined;
  }
}
