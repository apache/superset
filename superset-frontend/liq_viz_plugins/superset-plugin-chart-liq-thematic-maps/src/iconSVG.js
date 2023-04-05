class LiqMarker {
  
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
    return `0,${height} ${width/2},0 ${width},${height}`;
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

  createCircle(size=this.size, strokeWidth=this.strokeWidth, strokeColor=this.strokeColor, fill=this.fill) {

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", size/2);
    circle.setAttribute("cy", size/2);
    circle.setAttribute("r", size/2 - strokeWidth);
    circle.setAttribute("stroke", strokeColor);
    circle.setAttribute("stroke-width", strokeWidth);
    circle.setAttribute("fill", fill);
  
    this.svg.appendChild(circle);
    return this;
  }

  createSquare(size=this.size, strokeWidth=this.strokeWidth, strokeColor=this.strokeColor, fill=this.fill) {
    
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

  createStar(size=this.size, strokeWidth=this.strokeWidth, strokeColor=this.strokeColor, fill=this.fill) {
  
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const points = this.constructor.generateStarPolygon(size, size);
    star.setAttribute("points", points);
    star.setAttribute("fill", fill);
    star.setAttribute("stroke", strokeColor);
    star.setAttribute("stroke-width", strokeWidth);
  
    this.svg.appendChild(star);
    return this;
  }

  createPentagon(size=this.size, strokeWidth=this.strokeWidth, strokeColor=this.strokeColor, fill=this.fill) {
  
    const pentagon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const points = this.constructor.generatePentagonPolygon(size, size);
    pentagon.setAttribute("points", points);
    pentagon.setAttribute("fill", fill);
    pentagon.setAttribute("stroke", strokeColor);
    pentagon.setAttribute("stroke-width", strokeWidth);
  
    this.svg.appendChild(pentagon);
    return this;
  }

  createTriangle(size=this.size, strokeWidth=this.strokeWidth, strokeColor=this.strokeColor, fill=this.fill) {

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

const diamondPoints = (size) => `${size/2},0 0,${size/2} ${size/2},${size} ${size},${size/2}`;
const reverseTrianglePoints = (size) => `0,0 ${size/2},${size} ${size},0`;

// Shopping Centres
export const regionalSC = (new LiqMarker(35, 4, 'red', 'none').createCircle().img);
export const subRegionalSC = (new LiqMarker(30, 3, 'blue', 'none').createCircle().img);
export const neighbourhoodSC = (new LiqMarker(25, 3, 'orange', 'none').createCircle().img);
export const cityCentreSC = (new LiqMarker(25, 3, '#e8e80c', 'none').createCircle().img);
export const themedSC = (new LiqMarker(25, 3, '#FF69B4', 'none').createCircle().img);
export const lfrSC = (new LiqMarker(25, 3, 'blue', 'none').createCircle().img);
export const outletSC = (new LiqMarker(25, 3, 'brown', 'none').createCircle().img);
export const marketSC = (new LiqMarker(25, 3, 'green', 'none').createCircle().img);

// Department stores
export const davidJones = (new LiqMarker(25, 2, 'black', '#ADD8E6').createStar().img);
export const myer = (new LiqMarker(25, 2, 'black', 'red').createStar().img);
export const harrisScarfe = (new LiqMarker(25, 2, 'black', 'blue').createSquare().img);
export const unknownDS = (new LiqMarker(25, 2, 'black', 'black').createStar().img)

// Discount department stores
export const kmart = (new LiqMarker(25, 2, 'black', 'red').createTriangle().img);
export const kmartHub = (new LiqMarker(25, 2, 'black', 'red').createPolygon(
  reverseTrianglePoints(25)
).img)
export const target = (new LiqMarker(25, 2, 'black', 'yellow').createTriangle().img);
export const targetCountry = (new LiqMarker(25, 2, 'black', 'yellow').createPolygon(
  reverseTrianglePoints(25)
).img);
export const bigW = (new LiqMarker(25, 2, 'black', 'blue').createTriangle().img);
export const unknownDDS = (new LiqMarker(25, 2, 'black', 'black').createTriangle().img);

// LFR
export const amart = (new LiqMarker(25, 2, 'black', 'gray').createPolygon(
  diamondPoints(25)
).img);
export const anaconda = (new LiqMarker(25, 2, 'black', 'orange').createTriangle().img);
export const bunnings = (new LiqMarker(25, 2, 'black', '#008080').createSquare().img);
export const domayne = (new LiqMarker(25, 2, 'black', 'green').createPolygon(
  diamondPoints(25)
).img);
export const fantasticFurniture = (new LiqMarker(25, 2, 'black', 'red').createPolygon(
  diamondPoints(25)
).img);
export const fortyWinks = (new LiqMarker(25, 2, 'black', 'blue').createPolygon(
  reverseTrianglePoints(25)
).img);
export const harveyNorman = (new LiqMarker(25, 2, 'black', '#ADD8E6').createStar().img);
export const ikea = (new LiqMarker(25, 2, 'black', 'yellow').createPolygon(
  diamondPoints(25)
).img);
export const lincraft = (new LiqMarker(25, 2, 'black', 'purple').createCircle().img);
export const snooze = (new LiqMarker(25, 2, 'black', 'brown').createPolygon(
  reverseTrianglePoints(25)
).img);
export const spotlight = (new LiqMarker(25, 2, 'black', 'red').createCircle().img);
export const theGoodGuys = (new LiqMarker(25, 2, 'black', 'purple').createStar().img);

// Mini majors
export const appleStore = (new LiqMarker(25, 2, 'black', '#90EE90').createStar().img);
export const bestAndLess = (new LiqMarker(25, 2, 'black', 'blue').createCircle().img);
export const chemistWarehouse = (new LiqMarker(25, 2, 'black', 'brown').createPolygon(
  diamondPoints(25)
).img);
export const cottonOn = (new LiqMarker(25, 2, 'black', 'brown').createCircle().img);
export const countryRoad = (new LiqMarker(25, 2, 'black', 'pink').createCircle().img);
export const daiso = (new LiqMarker(25, 2, 'black', 'blue').createSquare().img);
export const danMurphys = (new LiqMarker(25, 2, 'black', 'green').createPentagon().img);
export const firstChoiceLiquor = (new LiqMarker(25, 2, 'black', 'brown').createPentagon().img);
export const glueStore = (new LiqMarker(25, 2, 'black', 'orange').createCircle().img);
export const hAndM = (new LiqMarker(25, 2, 'black', 'yellow').createCircle().img);
export const harrisFarmMarkets = (new LiqMarker(25, 2, 'black', 'blue').createPentagon().img);
export const hsHome = (new LiqMarker(25, 2, 'black', 'purple').createPolygon(
  reverseTrianglePoints(25)
).img);
export const jbhifi = (new LiqMarker(25, 2, 'black', 'orange').createStar().img);
export const kathmandu = (new LiqMarker(25, 2, 'black', 'yellow').createTriangle().img);
export const meccaCosmetica = (new LiqMarker(25, 2, 'black', 'orange').createPolygon(
  reverseTrianglePoints(25)
).img);
export const pricelinePharmacy = (new LiqMarker(25, 2, 'black', 'pink').createPolygon(
  diamondPoints(25)
).img);
export const rebelSports = (new LiqMarker(25, 2, 'black', '#008080').createTriangle().img);
export const rivers = (new LiqMarker(25, 2, 'black', '#90EE90').createCircle().img);
export const sephora = (new LiqMarker(25, 2, 'black', 'green').createPolygon(
  reverseTrianglePoints(25)
).img);
export const terryWhiteChemmart = (new LiqMarker(25, 2, 'black', 'blue').createPolygon(
  diamondPoints(25)
).img);
export const theRejectShop = (new LiqMarker(25, 2, 'black', 'brown').createSquare().img);
export const tkMaxx = (new LiqMarker(25, 2, 'black', '#008080').createCircle().img);
export const uniqlo = (new LiqMarker(25, 2, 'black', 'purple').createCircle().img);
export const zara = (new LiqMarker(25, 2, 'black', 'green').createCircle().img);

// Woolworths
export const woolworths = (new LiqMarker(25, 2, 'black', '#90EE90').createCircle().img);
export const coles = (new LiqMarker(25, 2, 'black', 'red').createCircle().img);
export const aldi = (new LiqMarker(25, 2, 'black', '#ADD8E6').createCircle().img);
export const iga = (new LiqMarker(25, 2, 'black', 'yellow').createCircle().img);
export const foodWorks = (new LiqMarker(25, 2, 'black', 'orange').createCircle().img);
export const costco = (new LiqMarker(25, 2, 'black', 'purple').createCircle().img);
export const drakes = (new LiqMarker(25, 2, 'black', 'white').createCircle().img);
export const spar = (new LiqMarker(25, 2, 'black', 'brown').createCircle().img);
export const igaExpress = (new LiqMarker(25, 2, 'black', 'blue').createCircle().img);
export const otherSmkt = (new LiqMarker(25, 2, 'black', 'blue').createCircle().img);
export const unknownSmkt = (new LiqMarker(25, 2, 'black', 'black').createCircle().img);

// Liquor
export const liquorLand = (new LiqMarker(25, 2, 'black', 'brown').createPolygon(
  diamondPoints(25)
).img);
export const bws = (new LiqMarker(25, 2, 'black', 'green').createPolygon(
  diamondPoints(25)
).img);
export const igaLiquor = (new LiqMarker(25, 2, 'black', 'yellow').createPolygon(
  diamondPoints(25)
).img);
export const aldiLiquor = (new LiqMarker(25, 2, 'black', '#008080').createPolygon(
  diamondPoints(25)
).img);
export const vintageCellars = (new LiqMarker(25, 2, 'black', 'purple').createPolygon(
  diamondPoints(25)
).img);
export const otherLiquor = (new LiqMarker(25, 2, 'black', 'blue').createCircle().img);