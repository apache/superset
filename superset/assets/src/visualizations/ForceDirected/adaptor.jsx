import createAdaptor from '../../utils/createAdaptor';
import Component from './ReactForceDirected';
import transformProps from './transformProps';

export default createAdaptor(Component, transformProps);
