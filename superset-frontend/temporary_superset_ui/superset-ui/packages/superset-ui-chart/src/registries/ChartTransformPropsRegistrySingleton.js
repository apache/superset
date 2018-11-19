import { Registry, makeSingleton } from '@superset-ui/core';

class ChartTransformPropsRegistry extends Registry {
  constructor() {
    super({ name: 'ChartTransformProps' });
  }
}

const getInstance = makeSingleton(ChartTransformPropsRegistry);

export default getInstance;
