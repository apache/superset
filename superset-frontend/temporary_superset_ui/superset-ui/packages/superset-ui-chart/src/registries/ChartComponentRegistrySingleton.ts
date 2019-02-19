import { Registry, makeSingleton, OverwritePolicy } from '@superset-ui/core';

class ChartComponentRegistry extends Registry {
  constructor() {
    super({ name: 'ChartComponent', overwritePolicy: OverwritePolicy.WARN });
  }
}

const getInstance = makeSingleton(ChartComponentRegistry);

export default getInstance;
