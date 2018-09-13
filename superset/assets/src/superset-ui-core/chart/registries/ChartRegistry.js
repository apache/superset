import LoaderRegistry from '../../platform/LoaderRegistry';
import makeSingleton from '../../utils/makeSingleton';

class ChartRegistry extends LoaderRegistry {
  constructor() {
    super('Chart');
  }
}

const getInstance = makeSingleton(ChartRegistry);

function loadChart(key) {
  return getInstance().load(key);
}

export {
  getInstance,
  loadChart,
};
