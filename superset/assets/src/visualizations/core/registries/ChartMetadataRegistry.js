import Registry from '../../../modules/Registry';
import makeSingleton from '../../../utils/makeSingleton';

class ChartMetadataRegistry extends Registry {
  constructor() {
    super('ChartMetadata');
  }
}

export const getInstance = makeSingleton(ChartMetadataRegistry);
