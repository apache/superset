import LoaderRegistry from '../../platform/LoaderRegistry';
import makeSingleton from '../../utils/makeSingleton';

class ChartLoaderRegistry extends LoaderRegistry {
  constructor() {
    super('Chart');
  }
}

const {
  getInstance,
  has,
  register,
  registerLoader,
  load,
} = makeSingleton(ChartLoaderRegistry);

console.log('load', load, has, getInstance);

// alias
const loadChart = load;

export {
  getInstance,
  has,
  register,
  registerLoader,
  load,
  loadChart,
};
