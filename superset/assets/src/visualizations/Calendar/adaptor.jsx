import createAdaptor from '../../utils/createAdaptor';
import Component from './ReactCalendar';
import transformProps from './transformProps';

export default createAdaptor(Component, transformProps);
