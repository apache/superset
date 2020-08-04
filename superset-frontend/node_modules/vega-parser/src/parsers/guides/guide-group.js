import {GroupMark} from '../marks/marktypes';

export default function(mark) {
  mark.type = GroupMark;
  mark.interactive = mark.interactive || false;
  return mark;
}
