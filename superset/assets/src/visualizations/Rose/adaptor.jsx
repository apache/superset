import createAdaptor from '../../utils/createAdaptor';
import Component from './ReactRose';
import transformProps from './transformProps';

export default createAdaptor(Component, transformProps);
