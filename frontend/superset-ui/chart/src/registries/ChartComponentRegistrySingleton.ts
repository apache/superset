import { Registry, makeSingleton, OverwritePolicy } from '@superset-ui/core';
import { ChartType } from '../models/ChartPlugin';

class ChartComponentRegistry extends Registry<ChartType> {
  constructor() {
    super({ name: 'ChartComponent', overwritePolicy: OverwritePolicy.WARN });
  }
}

const getInstance = makeSingleton(ChartComponentRegistry);

export default getInstance;
