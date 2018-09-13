import Registry from '../../platform/Registry';
import makeSingleton from '../../utils/makeSingleton';

class ChartRegistry extends Registry {

}

const getInstance = makeSingleton(ChartRegistry);

export {
  getInstance,
};
