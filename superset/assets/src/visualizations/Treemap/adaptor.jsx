import createAdaptor from '../../utils/createAdaptor';
import Component from './ReactTreemap';
import transformProps from './transformProps';

export default createAdaptor(Component, transformProps);
