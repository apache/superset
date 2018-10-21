import Registry from '../../../modules/Registry';
import makeSingleton from '../../../utils/makeSingleton';

class ChartTransformPropsRegistry extends Registry {
  constructor() {
    super('ChartTransformProps');
  }
}

const getInstance = makeSingleton(ChartTransformPropsRegistry);

export default getInstance;
