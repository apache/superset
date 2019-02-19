import { Registry, makeSingleton, OverwritePolicy } from '@superset-ui/core';

class ChartTransformPropsRegistry extends Registry {
  constructor() {
    super({ name: 'ChartTransformProps', overwritePolicy: OverwritePolicy.WARN });
  }
}

const getInstance = makeSingleton(ChartTransformPropsRegistry);

export default getInstance;
