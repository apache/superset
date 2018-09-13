import Registry from '../../platform/Registry';
import makeSingleton from '../../utils/makeSingleton';

class ChartMetadataRegistry extends Registry {
  constructor() {
    super('ChartMetadata');
  }
}

const {
  getInstance,
  has,
  register,
  get,
} = makeSingleton(ChartMetadataRegistry);

// alias
const getMetadata = get;

export {
  getInstance,
  has,
  register,
  get,
  getMetadata,
};
