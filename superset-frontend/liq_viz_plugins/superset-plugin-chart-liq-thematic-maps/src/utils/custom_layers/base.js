import LiqMarker from "../../liqMarker.js";
import cmap from '../api/lambdaCmap.js';

const createSVG = (color, shape, size) => {
  const marker = new LiqMarker(size, 0, 'none', color)
  if (shape === 'circle') return marker.createCircle().img;
  if (shape === 'square') return marker.createSquare().img;
  if (shape === 'star') return marker.createStar().img;
  if (shape === 'pentagon') return marker.createPentagon().img;
  return marker.createTriangle().img;
}

export class ColorStyle {
  constructor(color) {
    this._color = color;
  }

  get color() {
    return `${this._color}`;
  }
}

export class ColorStyleAttribute {
  constructor(colorScheme, breaksMode, metricCol, customMode, numClasses, data) {
    this.colorScheme = colorScheme;
    this.breaksMode = breaksMode;
    this.metricCol = metricCol;
    this.customMode = customMode;
    this.numClasses = numClasses;
    this.data = data;
  }

  // Returns promise of result
  async setColors() {

    const req = await cmap(this.colorScheme, this.breaksMode, this.data, this.metricCol, this.customMode, this.numClasses);
    const res = await req.json()

    // Continue logic to set state here
    /*
      - Create mapbox style spec for colour paint property
    */

    return this;

  }
}

export class BaseCustom {
  constructor(
    name,
    source,
    geom,
    // Add other table metadata attributes here
  )

  // Add async function to grab data
}