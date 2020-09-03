import makeSingleton from '../utils/makeSingleton';
import CategoricalScheme from './CategoricalScheme';
import ColorSchemeRegistry from './ColorSchemeRegistry';
import schemes from './colorSchemes/categorical/d3';

class CategoricalSchemeRegistry extends ColorSchemeRegistry<CategoricalScheme> {
  constructor() {
    super();

    this.registerValue('SUPERSET_DEFAULT', schemes[0]);
  }
}

const getInstance = makeSingleton(CategoricalSchemeRegistry);

export default getInstance;
