import createAdaptor from '../../utils/createAdaptor';
import Component from './EventFlow';
import transformProps from './transformProps';

export default createAdaptor(Component, transformProps);
