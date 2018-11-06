import { Registry, makeSingleton } from '@superset-ui/core';

class ChartBuildQueryRegistry extends Registry {
  constructor() {
    super('ChartBuildQuery');
  }
}

const getInstance = makeSingleton(ChartBuildQueryRegistry);

export default getInstance;
