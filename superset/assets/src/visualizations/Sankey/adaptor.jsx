import createAdaptor from '../../utils/createAdaptor';
import Component from './ReactSankey';
import transformProps from './transformProps';

export default createAdaptor(Component, transformProps);
