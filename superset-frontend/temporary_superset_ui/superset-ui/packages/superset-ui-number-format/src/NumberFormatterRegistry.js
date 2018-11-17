import { RegistryWithDefaultKey } from '@superset-ui/core';
import D3Formatter from './formatters/D3Formatter';
import { SI_3_DIGIT } from './NumberFormats';

const DEFAULT_FORMAT = SI_3_DIGIT;

export default class NumberFormatterRegistry extends RegistryWithDefaultKey {
  constructor() {
    super({
      initialDefaultKey: DEFAULT_FORMAT,
      name: 'NumberFormatter',
    });
  }

  get(formatterId) {
    const targetFormat = formatterId || this.defaultKey;

    if (this.has(targetFormat)) {
      return super.get(targetFormat);
    }

    // Create new formatter if does not exist
    const formatter = new D3Formatter(targetFormat);
    this.registerValue(targetFormat, formatter);

    return formatter;
  }

  format(formatterId, value) {
    return this.get(formatterId)(value);
  }
}
