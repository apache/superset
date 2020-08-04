export default function() {
  var size = 0;
  this.each(function() { ++size; });
  return size;
}
