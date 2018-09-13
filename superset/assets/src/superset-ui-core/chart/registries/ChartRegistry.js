import LoaderRegistry from '../../platform/LoaderRegistry';
import makeSingleton from '../../utils/makeSingleton';

class ChartRegistry extends LoaderRegistry {
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
} = makeSingleton(ChartRegistry);

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
