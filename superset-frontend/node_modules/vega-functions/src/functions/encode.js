export default function(item, name, retval) {
  if (item) {
    const df = this.context.dataflow,
          target = item.mark.source;
    df.pulse(target, df.changeset().encode(item, name));
  }
  return retval !== undefined ? retval : item;
}
