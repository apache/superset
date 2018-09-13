import LoaderRegistry from '../../platform/LoaderRegistry';
import makeSingleton from '../../utils/makeSingleton';

class BuildQueryRegistry extends LoaderRegistry {
  constructor() {
    super('BuildQuery');
  }
}

const {
  getInstance,
  has,
  register,
  registerLoader,
  load,
} = makeSingleton(BuildQueryRegistry);

// alias
const loadBuildQuery = load;

export {
  getInstance,
  has,
  register,
  registerLoader,
  load,
  loadBuildQuery,
};
