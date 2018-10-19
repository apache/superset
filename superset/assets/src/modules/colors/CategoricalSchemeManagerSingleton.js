import ColorSchemeManager from './ColorSchemeManager';
import makeSingleton from '../../utils/makeSingleton';

class CategoricalSchemeManager extends ColorSchemeManager {}

const getInstance = makeSingleton(CategoricalSchemeManager);

export default getInstance;
