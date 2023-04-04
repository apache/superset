const createRing = (diameter, strokeWidth, color) => {
  
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", diameter);
  svg.setAttribute("height", diameter);

  const outerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  outerCircle.setAttribute("cx", diameter/2);
  outerCircle.setAttribute("cy", diameter/2);
  outerCircle.setAttribute("r", diameter/2 - strokeWidth);
  outerCircle.setAttribute("stroke", color);
  outerCircle.setAttribute("stroke-width", strokeWidth);
  outerCircle.setAttribute("fill", "none");

  svg.appendChild(outerCircle);

  // Convert the SVG element to a data URL
  const svgData = new XMLSerializer().serializeToString(svg);
  const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);

  // Create an Image object with the data URL
  const img = new Image();
  img.src = dataUrl;

  return img
}

export const regionalSC = createRing(35, 4, 'red');
export const subRegionalSC = createRing(30, 3, 'blue');
export const neighbourhoodSC = createRing(25, 3, 'orange');
export const cityCentreSC = createRing(25, 3, '#e8e80c');
export const themedSC = createRing(25, 3, '#FF69B4');
export const lfrSC = createRing(25, 3, 'blue');
export const outletSC = createRing(25, 3, 'brown');
export const marketSC = createRing(25, 3, 'green');