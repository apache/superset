import { Registry, makeSingleton, OverwritePolicy } from '@superset-ui/core';

class ChartBuildQueryRegistry extends Registry {
  constructor() {
    super({ name: 'ChartBuildQuery', overwritePolicy: OverwritePolicy.WARN });
  }
}

const getInstance = makeSingleton(ChartBuildQueryRegistry);

export default getInstance;
