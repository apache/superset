import ColorSchemeRegistry from './ColorSchemeRegistry';
import makeSingleton from '../../utils/makeSingleton';

class SequentialSchemeRegistry extends ColorSchemeRegistry {}

const getInstance = makeSingleton(SequentialSchemeRegistry);

export default getInstance;
