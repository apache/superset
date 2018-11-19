import { Registry, makeSingleton } from '@superset-ui/core';

class ChartBuildQueryRegistry extends Registry {
  constructor() {
    super({ name: 'ChartBuildQuery' });
  }
}

const getInstance = makeSingleton(ChartBuildQueryRegistry);

export default getInstance;
