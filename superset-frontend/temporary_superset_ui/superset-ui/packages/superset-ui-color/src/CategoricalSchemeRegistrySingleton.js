import { makeSingleton } from '@superset-ui/core';
import ColorSchemeRegistry from './ColorSchemeRegistry';

class CategoricalSchemeRegistry extends ColorSchemeRegistry {}

const getInstance = makeSingleton(CategoricalSchemeRegistry);

export default getInstance;
