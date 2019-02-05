export const SAMPLE_TEXT = 'dummy text. does not really matter';

export default function addDummyFill() {
  // @ts-ignore - fix jsdom
  SVGElement.prototype.getBBox = function getBBox() {
    let width = 200;
    let height = 20;

    if (this.getAttribute('class') === 'test-class') {
      width = 100;
    }

    if (this.style.fontFamily === 'Lobster') {
      width = 250;
    }

    if (this.style.fontSize) {
      const size = Number(this.style.fontSize.replace('px', ''));
      const ratio = size / 20;
      width *= ratio;
      height *= ratio;
    }

    if (this.style.fontStyle === 'italic') {
      width *= 1.5;
    }

    if (this.style.fontWeight === '700') {
      width *= 2;
    }

    if (this.style.letterSpacing) {
      width *= 1.1;
    }

    return {
      x: 0,
      y: 0,
      width,
      height,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    };
  };
}
