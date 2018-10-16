import createAdaptor from '../../utils/createAdaptor';
import transformProps from './transformProps';

export default function createDeckGLAdaptor(Component) {
  return createAdaptor(Component, transformProps);
}
