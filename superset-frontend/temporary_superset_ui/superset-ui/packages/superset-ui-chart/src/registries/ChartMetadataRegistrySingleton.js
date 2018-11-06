import { Registry, makeSingleton } from '@superset-ui/core';

class ChartMetadataRegistry extends Registry {
  constructor() {
    super('ChartMetadata');
  }
}

const getInstance = makeSingleton(ChartMetadataRegistry);

export default getInstance;
