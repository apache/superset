import createAdaptor from '../../utils/createAdaptor';
import Component from './ReactChord';
import transformProps from './transformProps';

export default createAdaptor(Component, transformProps);
