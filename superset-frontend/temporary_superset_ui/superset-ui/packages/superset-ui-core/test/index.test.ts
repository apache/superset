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
} from '../src/index';

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
