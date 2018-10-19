import ColorSchemeRegistry from './ColorSchemeRegistry';
import makeSingleton from '../../utils/makeSingleton';

class CategoricalSchemeRegistry extends ColorSchemeRegistry {}

const getInstance = makeSingleton(CategoricalSchemeRegistry);

export default getInstance;
