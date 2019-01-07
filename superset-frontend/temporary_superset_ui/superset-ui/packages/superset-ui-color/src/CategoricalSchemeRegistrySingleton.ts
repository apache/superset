import { makeSingleton } from '@superset-ui/core';
import CategoricalScheme from './CategoricalScheme';
import ColorSchemeRegistry from './ColorSchemeRegistry';

class CategoricalSchemeRegistry extends ColorSchemeRegistry<CategoricalScheme> {}

const getInstance = makeSingleton(CategoricalSchemeRegistry);

export default getInstance;
