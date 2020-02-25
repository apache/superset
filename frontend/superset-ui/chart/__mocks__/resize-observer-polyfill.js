const allCallbacks = [];

export default function ResizeObserver(callback) {
  if (callback) {
    allCallbacks.push(callback);
  }

  return {
    disconnect: () => {
      allCallbacks.splice(allCallbacks.findIndex(callback), 1);
    },
    observe: () => {},
  };
}

const DEFAULT_OUTPUT = [{ contentRect: { height: 300, width: 300 } }];

export function triggerResizeObserver(output = DEFAULT_OUTPUT) {
  allCallbacks.forEach(fn => {
    fn(output);
  });
}
