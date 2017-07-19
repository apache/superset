import $ from 'jquery';
import { ActionCreators } from 'redux-undo';
import { searchColumns, searchMetrics } from './actions/keyBindingsActions';

export default function configureShortcuts(store) {
  const keyMap = [
    // Undo cmd + z
    {
      keyCode: 90,
      metaKey: true,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      f: () => store.dispatch(ActionCreators.undo()),
    },
    // Redo cmd + shift + z
    {
      keyCode: 90,
      metaKey: true,
      shiftKey: true,
      altKey: false,
      ctrlKey: false,
      f: () => store.dispatch(ActionCreators.redo()),
    },
    // Open Column Search ctrl + c
    {
      keyCode: 67,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: true,
      f: () => store.dispatch(searchColumns()),
    },
    // Open Metric Search ctrl + m
    {
      keyCode: 77,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: true,
      f: () => store.dispatch(searchMetrics()),
    },
  ];

  function hashKey(x) {
    return `${x.keyCode}${x.metaKey}${x.shiftKey}${x.altKey}${x.ctrlKey}`;
  }

  const keyLookup = keyMap.reduce((lookup, k) => ({
    ...lookup,
    [hashKey(k)]: k.f,
  }), {});

  $(':root').keydown((x) => {
    const f = keyLookup[hashKey(x)];
    if (f) {
      return f();
    }
    return true;
  });
}
