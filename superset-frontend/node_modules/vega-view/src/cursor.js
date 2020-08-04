import {isString} from 'vega-util';

const Default = 'default';

export default function(view) {
  // get cursor signal, add to dataflow if needed
  const cursor = view._signals.cursor || (view._signals.cursor = view.add({
    user: Default,
    item: null
  }));

  // evaluate cursor on each mousemove event
  view.on(view.events('view', 'mousemove'), cursor,
    function(_, event) {
      const value = cursor.value,
            user = value ? (isString(value) ? value : value.user) : Default,
            item = event.item && event.item.cursor || null;

      return (value && user === value.user && item == value.item)
        ? value
        : {user: user, item: item};
    }
  );

  // when cursor signal updates, set visible cursor
  view.add(null, function(_) {
    let user = _.cursor,
        item = this.value;

    if (!isString(user)) {
      item = user.item;
      user = user.user;
    }

    setCursor(view, user && user !== Default ? user : (item || user));

    return item;
  }, {cursor: cursor});
}

export function setCursor(view, cursor) {
  const el = view.globalCursor()
    ? (typeof document !== 'undefined' && document.body)
    : view.container();

  if (el) {
    return cursor == null
      ? el.style.removeProperty('cursor')
      : (el.style.cursor = cursor);
  }
}
