import LoaderRegistry from '../../../modules/LoaderRegistry';
import makeSingleton from '../../../utils/makeSingleton';

class ChartComponentLoaderRegistry extends LoaderRegistry {
  constructor() {
    super('ChartComponent');
  }
}

export const getInstance = makeSingleton(ChartComponentLoaderRegistry);
