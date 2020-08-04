
// https://developer.mozilla.org/en-US/docs/Web/CSS/background-clip#Browser_compatibility
export default function backgroundClip(property, value) {
  if (typeof value === 'string' && value === 'text') {
    return ['-webkit-text', 'text'];
  }
}