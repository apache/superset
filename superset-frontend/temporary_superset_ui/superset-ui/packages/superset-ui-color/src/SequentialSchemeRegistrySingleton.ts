import { makeSingleton } from '@superset-ui/core';
import ColorSchemeRegistry from './ColorSchemeRegistry';
import SequentialScheme from './SequentialScheme';

class SequentialSchemeRegistry extends ColorSchemeRegistry<SequentialScheme> {}

const getInstance = makeSingleton(SequentialSchemeRegistry);

export default getInstance;
