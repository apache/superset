import Registry from '../../../modules/Registry';
import makeSingleton from '../../../utils/makeSingleton';

class ChartComponentRegistry extends Registry {
  constructor() {
    super('ChartComponent');
  }
}

const getInstance = makeSingleton(ChartComponentRegistry);

export default getInstance;
