// DODO was here
const loadModule = () => {
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    // return require('../../../superset_text') || {};
    return {};
  } catch (e) {
    return {};
  }
};

const supersetText = loadModule();

export default supersetText;
