import ColorSchemeManager from './ColorSchemeManager';
import makeSingleton from '../../utils/makeSingleton';

class SequentialSchemeManager extends ColorSchemeManager {}

const getInstance = makeSingleton(SequentialSchemeManager);

export default getInstance;
