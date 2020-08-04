import hammerjs from 'hammerjs';
import {enhancePointerEventInput, enhanceMouseInput} from './hammer-overrides';

enhancePointerEventInput(hammerjs.PointerEventInput);
enhanceMouseInput(hammerjs.MouseInput);

export const Manager = hammerjs.Manager;

export default hammerjs;
