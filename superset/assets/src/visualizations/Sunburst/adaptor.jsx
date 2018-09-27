import createAdaptor from '../../utils/createAdaptor';
import Component from './ReactSunburst';
import transformProps from './transformProps';

export default createAdaptor(Component, transformProps);
