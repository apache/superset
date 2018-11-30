import { RegistryWithDefaultKey } from '@superset-ui/core';
import createD3NumberFormatter from './factories/createD3NumberFormatter';
import NumberFormats from './NumberFormats';

export default class NumberFormatterRegistry extends RegistryWithDefaultKey {
  constructor() {
    super({
      initialDefaultKey: NumberFormats.SI,
      name: 'NumberFormatter',
    });
  }

  get(formatterId) {
    const targetFormat = formatterId || this.defaultKey;

    if (this.has(targetFormat)) {
      return super.get(targetFormat);
    }

    // Create new formatter if does not exist
    const formatter = createD3NumberFormatter({
      formatString: targetFormat,
    });
    this.registerValue(targetFormat, formatter);

    return formatter;
  }

  format(formatterId, value) {
    return this.get(formatterId)(value);
  }
}
