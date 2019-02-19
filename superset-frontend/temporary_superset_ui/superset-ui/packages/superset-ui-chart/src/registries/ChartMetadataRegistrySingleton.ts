import { Registry, makeSingleton, OverwritePolicy } from '@superset-ui/core';

class ChartMetadataRegistry extends Registry {
  constructor() {
    super({ name: 'ChartMetadata', overwritePolicy: OverwritePolicy.WARN });
  }
}

const getInstance = makeSingleton(ChartMetadataRegistry);

export default getInstance;
