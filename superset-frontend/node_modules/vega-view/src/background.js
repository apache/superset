export default function(view) {
  // respond to background signal
  view.add(null, _ => {
    view._background = _.bg;
    view._resize = 1;
    return _.bg;
  }, { bg: view._signals.background });
}
