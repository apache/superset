export default class LiqMarker {

  constructor(size, strokeWidth, strokeColor, fill) {
    this.size = size;
    this.strokeWidth = strokeWidth;
    this.strokeColor = strokeColor;
    this.fill = fill;

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("width", size);
    this.svg.setAttribute("height", size);
  }

  static generateTrianglePolygon(width, height) {
    return `0,${height} ${width / 2},0 ${width},${height}`;
  }

  static generatePentagonPolygon(width, height) {
    // Calculate the distance from the center of the pentagon to its vertices
    const radius = Math.min(width, height) / 2;

    // Calculate the angle between each vertex of the pentagon
    const angle = (Math.PI * 2) / 5;

    // Initialize an empty array to store the coordinates of the pentagon's vertices
    const points = [];

    // Loop through each vertex and calculate its coordinates
    for (let i = 0; i < 5; i++) {
      const x = width / 2 + radius * Math.cos(i * angle);
      const y = height / 2 + radius * Math.sin(i * angle);

      // Push the coordinates to the points array
      points.push(`${x},${y}`);
    }

    return points.join(' ');
  }

  static generateStarPolygon(width, height) {

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2;
    const innerRadius = radius * 0.5;
    const numPoints = 5;
    const angleStep = (2 * Math.PI) / (2 * numPoints);

    let points = [];

    for (let i = 0; i < numPoints * 2; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const isOuterPoint = i % 2 === 0;
      const pointRadius = isOuterPoint ? radius : innerRadius;
      const x = centerX + pointRadius * Math.cos(angle);
      const y = centerY + pointRadius * Math.sin(angle);
      points.push(`${x},${y}`);
    }

    return points.join(' ');
  }

  createCircle(
    size = this.size,
    strokeWidth = this.strokeWidth,
    strokeColor = this.strokeColor,
    fill = this.fill,
    proposed = false
  ) {

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", size / 2);
    circle.setAttribute("cy", size / 2);
    circle.setAttribute("r", size / 2 - strokeWidth);
    circle.setAttribute("stroke", strokeColor);
    circle.setAttribute("stroke-width", strokeWidth);
    circle.setAttribute("fill", fill);

    if (proposed) {
      circle.setAttribute('stroke-dasharray', '2 2');
      circle.setAttribute('stroke-dashoffset', '0');
    }

    this.svg.appendChild(circle);
    return this;
  }

  createSquare(size = this.size, strokeWidth = this.strokeWidth, strokeColor = this.strokeColor, fill = this.fill) {

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", size);
    rect.setAttribute("height", size);
    rect.setAttribute("fill", fill);
    rect.setAttribute("stroke", strokeColor);
    rect.setAttribute("stroke-width", strokeWidth);

    this.svg.appendChild(rect);
    return this;
  }

  createStar(size = this.size, strokeWidth = this.strokeWidth, strokeColor = this.strokeColor, fill = this.fill) {

    const star = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const points = this.constructor.generateStarPolygon(size, size);
    star.setAttribute("points", points);
    star.setAttribute("fill", fill);
    star.setAttribute("stroke", strokeColor);
    star.setAttribute("stroke-width", strokeWidth);

    this.svg.appendChild(star);
    return this;
  }

  createPentagon(size = this.size, strokeWidth = this.strokeWidth, strokeColor = this.strokeColor, fill = this.fill) {

    const pentagon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const points = this.constructor.generatePentagonPolygon(size, size);
    pentagon.setAttribute("points", points);
    pentagon.setAttribute("fill", fill);
    pentagon.setAttribute("stroke", strokeColor);
    pentagon.setAttribute("stroke-width", strokeWidth);

    this.svg.appendChild(pentagon);
    return this;
  }

  createTriangle(size = this.size, strokeWidth = this.strokeWidth, strokeColor = this.strokeColor, fill = this.fill) {

    const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const points = this.constructor.generateTrianglePolygon(size, size);
    triangle.setAttribute("points", points);
    triangle.setAttribute("fill", fill);
    triangle.setAttribute("stroke", strokeColor);
    triangle.setAttribute("stroke-width", strokeWidth);

    this.svg.appendChild(triangle);
    return this;
  }

  createPolygon(points) {

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute("points", points);
    poly.setAttribute("fill", this.fill);
    poly.setAttribute("stroke", this.strokeColor);
    poly.setAttribute("stroke-width", this.strokeWidth);

    this.svg.appendChild(poly);
    return this;
  }

  get img() {

    // Convert the SVG element to a data URL
    const svgData = new XMLSerializer().serializeToString(this.svg);
    const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);

    // Create an Iamge object with the data URL
    const image = new Image();
    image.src = dataUrl;

    return image;
  }

}