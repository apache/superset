import createAdaptor from '../../utils/createAdaptor';
import Component from './ReactPartition';
import transformProps from './transformProps';

export default createAdaptor(Component, transformProps);
