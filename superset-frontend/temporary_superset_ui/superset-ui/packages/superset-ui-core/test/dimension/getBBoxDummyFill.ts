let originalFn: () => DOMRect;

const textToWidth = {
  paris: 200,
  tokyo: 300,
  beijing: 400,
};

export const SAMPLE_TEXT = Object.keys(textToWidth);

export function addDummyFill() {
  // @ts-ignore - fix jsdom
  originalFn = SVGElement.prototype.getBBox;

  // @ts-ignore - fix jsdom
  SVGElement.prototype.getBBox = function getBBox() {
    let width = textToWidth[this.textContent as keyof typeof textToWidth] || 200;
    let height = 20;

    if (this.getAttribute('class') === 'test-class') {
      width /= 2;
    }

    if (this.style.fontFamily === 'Lobster') {
      width *= 1.25;
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

export function removeDummyFill() {
  // @ts-ignore - fix jsdom
  SVGElement.prototype.getBBox = originalFn;
}
