export function preventTouchMove(e) {
  e.preventDefault();
}

export function allowTouchMove(e) {
  e.stopPropagation();
}

export function preventInertiaScroll() {
  const top = this.scrollTop;
  const totalScroll = this.scrollHeight;
  const currentScroll = top + this.offsetHeight;

  if (top === 0) {
    this.scrollTop = 1;
  } else if (currentScroll === totalScroll) {
    this.scrollTop = top - 1;
  }
}

// `ontouchstart` check works on most browsers
// `maxTouchPoints` works on IE10/11 and Surface
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints;
}
