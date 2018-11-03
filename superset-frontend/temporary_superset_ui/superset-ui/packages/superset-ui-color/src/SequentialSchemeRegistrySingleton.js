import { makeSingleton } from '@superset-ui/core';
import ColorSchemeRegistry from './ColorSchemeRegistry';

class SequentialSchemeRegistry extends ColorSchemeRegistry {}

const getInstance = makeSingleton(SequentialSchemeRegistry);

export default getInstance;
