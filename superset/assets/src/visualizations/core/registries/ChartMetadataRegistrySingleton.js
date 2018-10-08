import Registry from '../../../modules/Registry';
import makeSingleton from '../../../utils/makeSingleton';

class ChartMetadataRegistry extends Registry {
  constructor() {
    super('ChartMetadata');
  }
}

const getInstance = makeSingleton(ChartMetadataRegistry);

export default getInstance;
