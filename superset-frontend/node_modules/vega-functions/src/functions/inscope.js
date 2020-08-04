export default function(item) {
  let group = this.context.group,
      value = false;

  if (group) while (item) {
    if (item === group) { value = true; break; }
    item = item.mark.group;
  }
  return value;
}
