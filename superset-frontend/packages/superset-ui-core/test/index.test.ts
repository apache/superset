import {
  ExtensibleFunction,
  Plugin,
  Preset,
  Registry,
  RegistryWithDefaultKey,
  convertKeysToCamelCase,
  isDefined,
  isRequired,
  makeSingleton,
} from '@superset-ui/core/src';

describe('index', () => {
  it('exports modules', () => {
    [
      ExtensibleFunction,
      Plugin,
      Preset,
      Registry,
      RegistryWithDefaultKey,
      convertKeysToCamelCase,
      isDefined,
      isRequired,
      makeSingleton,
    ].forEach(x => expect(x).toBeDefined());
  });
});
