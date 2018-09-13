import LoaderRegistry from '../../platform/LoaderRegistry';
import makeSingleton from '../../utils/makeSingleton';

class BuildQueryLoaderRegistry extends LoaderRegistry {
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
} = makeSingleton(BuildQueryLoaderRegistry);

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
