const createCircle = (diameter, strokeWidth, strokeColor, fillColor) => {
  
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", diameter);
  svg.setAttribute("height", diameter);

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", diameter/2);
  circle.setAttribute("cy", diameter/2);
  circle.setAttribute("r", diameter/2 - strokeWidth);
  circle.setAttribute("stroke", strokeColor);
  circle.setAttribute("stroke-width", strokeWidth);
  circle.setAttribute("fill", fillColor);

  return circle;
}

const createSCRing = (diameter, strokeWidth, color, proposed) => {
  
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", diameter);
  svg.setAttribute("height", diameter);

  const outerCircle = createCircle(diameter, strokeWidth, color, "none");
  svg.appendChild(outerCircle);

  if (proposed) {
    const innerCircle = createCircle(diameter, 1, "white", "none");
    svg.appendChild(innerCircle);
  }

  // Convert the SVG element to a data URL
  const svgData = new XMLSerializer().serializeToString(svg);
  const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);

  // Create an Image object with the data URL
  const img = new Image();
  img.src = dataUrl;

  return img
}

export const regionalSC = createSCRing(35, 4, 'red', false);
export const subRegionalSC = createSCRing(30, 3, 'blue', false);
export const neighbourhoodSC = createSCRing(25, 3, 'orange', false);
export const cityCentreSC = createSCRing(25, 3, '#e8e80c', false);
export const themedSC = createSCRing(25, 3, '#FF69B4', false);
export const lfrSC = createSCRing(25, 3, 'blue', false);
export const outletSC = createSCRing(25, 3, 'brown', false);
export const marketSC = createSCRing(25, 3, 'green', false);