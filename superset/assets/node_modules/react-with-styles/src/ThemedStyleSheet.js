import deepmerge from 'deepmerge';
import globalCache from 'global-cache';

let styleInterface;
const themes = {};
const makeFromThemes = {};
let internalId = 0;

function registerTheme(name, overrides) {
  const theme = deepmerge(themes.default.theme, overrides);

  themes[name] = {
    theme,
    styles: {},
  };

  // If we register a theme after stylesheets have been created, we have to
  // backfill them when we register the new theme.
  Object.keys(makeFromThemes).forEach((id) => {
    themes[name].styles[id] = styleInterface.create(makeFromThemes[id](theme));
  });
}

function registerInterface(interfaceToRegister) {
  styleInterface = interfaceToRegister;
}

const generatorFor = id => (name = 'default') => {
  const { styles } = themes[name];
  // TODO(lmr):
  // we may at some point want to lazily register styles
  // for the non default theme. Think about strategies around this...
  // for now, this shouldn't be a big deal.
  return styles[id];
};

function create(makeFromTheme) {
  // Get an id to associate with this stylesheet
  const id = internalId;
  internalId += 1;

  // run StyleSheet.create over each variation for each theme
  Object.keys(themes).forEach((name) => {
    const { theme, styles } = themes[name];
    styles[id] = styleInterface.create(makeFromTheme(theme));
  });

  makeFromThemes[id] = makeFromTheme;

  return generatorFor(id);
}

function registerDefaultTheme(theme) {
  themes.default = {
    theme,
    styles: {},
  };
}

function get(name = 'default') {
  return themes[name].theme;
}

function resolve(...styles) {
  return styleInterface.resolve(styles);
}

function flush() {
  if (styleInterface.flush) {
    styleInterface.flush();
  }
}

// Using globalCache in order to export a singleton. This file may be imported
// in several places, which otherwise stomps over any registered themes and
// resets to just the defaults.
export default globalCache.setIfMissingThenGet(
  'react-with-styles ThemedStyleSheet',
  () => ({
    registerDefaultTheme,
    registerTheme,
    registerInterface,
    create,
    get,
    resolve,
    flush,
  }),
);
