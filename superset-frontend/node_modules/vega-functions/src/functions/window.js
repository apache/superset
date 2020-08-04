const _window = () => (typeof window !== 'undefined' && window) || null;

export function screen() {
  const w = _window();
  return w ? w.screen : {};
}

export function windowSize() {
  const w = _window();
  return w
    ? [w.innerWidth, w.innerHeight]
    : [undefined, undefined];
}

export function containerSize() {
  const view = this.context.dataflow,
        el = view.container && view.container();
  return el
    ? [el.clientWidth, el.clientHeight]
    : [undefined, undefined];
}
