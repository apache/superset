import { Registry, makeSingleton } from '@superset-ui/core';

class ChartComponentRegistry extends Registry {
  constructor() {
    super('ChartComponent');
  }
}

const getInstance = makeSingleton(ChartComponentRegistry);

export default getInstance;
