import Registry from '../../../modules/Registry';
import makeSingleton from '../../../utils/makeSingleton';

class ChartBuildQueryRegistry extends Registry {
  constructor() {
    super('ChartBuildQuery');
  }
}

const getInstance = makeSingleton(ChartBuildQueryRegistry);

export default getInstance;
