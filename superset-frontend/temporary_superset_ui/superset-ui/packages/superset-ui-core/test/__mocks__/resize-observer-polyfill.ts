interface ResizeObserverEntry {
  contentRect: {
    height: number;
    width: number;
  };
}
type ObserveCallback = (entries: ResizeObserverEntry[]) => void;

const allCallbacks: ObserveCallback[] = [];

export default function ResizeObserver(callback: ObserveCallback) {
  return {
    disconnect() {
      allCallbacks.splice(allCallbacks.indexOf(callback), 1);
    },
    observe() {
      if (callback) {
        allCallbacks.push(callback);
      }
    },
  };
}

export const DEFAULT_OUTPUT: ResizeObserverEntry[] = [{ contentRect: { height: 300, width: 300 } }];

export function triggerResizeObserver(entries = DEFAULT_OUTPUT) {
  allCallbacks.forEach(fn => {
    fn(entries);
  });
}
