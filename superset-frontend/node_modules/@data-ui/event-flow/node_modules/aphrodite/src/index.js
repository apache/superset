import {defaultSelectorHandlers} from './generate';
import makeExports from './exports';

const useImportant = true; // Add !important to all style definitions
export default makeExports(
    useImportant,
    defaultSelectorHandlers
);
