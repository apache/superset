import makeSingleton from '../utils/makeSingleton';
import ColorSchemeRegistry from './ColorSchemeRegistry';
import SequentialScheme from './SequentialScheme';
import schemes from './colorSchemes/sequential/d3';

class SequentialSchemeRegistry extends ColorSchemeRegistry<SequentialScheme> {
  constructor() {
    super();

    this.registerValue('SUPERSET_DEFAULT', schemes[0]);
  }
}

const getInstance = makeSingleton(SequentialSchemeRegistry);

export default getInstance;
