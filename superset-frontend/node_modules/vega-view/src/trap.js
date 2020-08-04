export default function(view, fn) {
  return !fn ? null : function() {
    try {
      fn.apply(this, arguments);
    } catch (error) {
      view.error(error);
    }
  };
}
