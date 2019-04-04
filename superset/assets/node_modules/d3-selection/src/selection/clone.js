function selection_cloneShallow() {
  return this.parentNode.insertBefore(this.cloneNode(false), this.nextSibling);
}

function selection_cloneDeep() {
  return this.parentNode.insertBefore(this.cloneNode(true), this.nextSibling);
}

export default function(deep) {
  return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}
