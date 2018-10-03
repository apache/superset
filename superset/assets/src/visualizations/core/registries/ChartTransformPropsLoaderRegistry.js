import LoaderRegistry from '../../../modules/LoaderRegistry';
import makeSingleton from '../../../utils/makeSingleton';

class ChartTransformPropsLoaderRegistry extends LoaderRegistry {
  constructor() {
    super('ChartTransformProps');
  }
}

export const getInstance = makeSingleton(ChartTransformPropsLoaderRegistry);
