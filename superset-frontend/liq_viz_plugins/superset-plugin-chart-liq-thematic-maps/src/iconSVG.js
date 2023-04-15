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

  createCircle(
    size=this.size, 
    strokeWidth=this.strokeWidth, 
    strokeColor=this.strokeColor, 
    fill=this.fill,
    proposed=false
  ) {

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", size/2);
    circle.setAttribute("cy", size/2);
    circle.setAttribute("r", size/2 - strokeWidth);
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

const REGIONAL_SIZE = 35;
const SUB_REGIONAL_SIZE = 30;
const NEIGHBOURHOOD_SIZE = 25;
const OTHER_SC_SIZE = 20;
const OTHER_SIZE = 15;

// Shopping Centres
const regional = new LiqMarker(REGIONAL_SIZE, 4, '#d02033', 'none');
const regionalP = new LiqMarker(REGIONAL_SIZE, 4, '#d02033', 'none');
const sub_regional = new LiqMarker(SUB_REGIONAL_SIZE, 3, '#2b2bc9', 'none');
const sub_regionalP = new LiqMarker(SUB_REGIONAL_SIZE, 3, '#2b2bc9', 'none');
const neighbourhood = new LiqMarker(NEIGHBOURHOOD_SIZE, 3, '#ffbd01', 'none');
const neighbourhoodP = new LiqMarker(NEIGHBOURHOOD_SIZE, 3, '#ffbd01', 'none');
const city_centre = new LiqMarker(OTHER_SC_SIZE, 3, '#e8e80c', 'none');
const city_centreP = new LiqMarker(OTHER_SC_SIZE, 3, '#e8e80c', 'none');
const themed = new LiqMarker(OTHER_SC_SIZE, 3, '#FF69B4', 'none');
const themedP = new LiqMarker(OTHER_SC_SIZE, 3, '#FF69B4', 'none');
const lfr = new LiqMarker(OTHER_SC_SIZE, 3, 'purple', 'none');
const lfrP = new LiqMarker(OTHER_SC_SIZE, 3, 'purple', 'none');
const outlet = new LiqMarker(OTHER_SC_SIZE, 3, 'brown', 'none');
const outletP = new LiqMarker(OTHER_SC_SIZE, 3, 'brown', 'none');
const market = new LiqMarker(OTHER_SC_SIZE, 3, 'green', 'none');
const marketP = new LiqMarker(OTHER_SC_SIZE, 3, 'green', 'none');

export const regionalSC = regional.createCircle().img;
export const regionalSCP = regionalP.createCircle(REGIONAL_SIZE, 4, '#d02033', 'none', true).img;

export const subRegionalSC = sub_regional.createCircle().img;
export const subRegionalSCP = sub_regionalP.createCircle(SUB_REGIONAL_SIZE, 3, '#2b2bc9', 'none', true);

export const neighbourhoodSC = neighbourhood.createCircle().img;
export const neighbourhoodSCP = neighbourhoodP.createCircle(NEIGHBOURHOOD_SIZE, 3, '#ffbd01', 'none', true).img;

export const cityCentreSC = city_centre.createCircle().img;
export const cityCentreSCP = city_centreP.createCircle(OTHER_SC_SIZE, 3, '#e8e80c', 'none', true).img;

export const themedSC = themed.createCircle().img;
export const themedSCP = themedP.createCircle(OTHER_SC_SIZE, 3, '#FF69B4', 'none', true).img;

export const lfrSC = lfr.createCircle().img;
export const lfrSCP = lfrP.createCircle(OTHER_SC_SIZE, 3, 'purple', 'none', true).img;

export const outletSC = outlet.createCircle().img;
export const outletSCP = outletP.createCircle(OTHER_SC_SIZE, 3, 'brown', 'none', true).img;

export const marketSC = market.createCircle().img;
export const marketSCP = marketP.createCircle(OTHER_SC_SIZE, 3, 'green', 'none', true).img;

// Department stores
export const davidJones = (new LiqMarker(OTHER_SIZE, 2, 'black', '#6bc1ff').createStar().img);
export const myer = (new LiqMarker(OTHER_SIZE, 2, 'black', '#bb1431').createStar().img);
export const harrisScarfe = (new LiqMarker(OTHER_SIZE, 2, 'black', '#1111af').createSquare().img);
export const unknownDS = (new LiqMarker(OTHER_SIZE, 2, 'black', '#252525').createStar().img)

// Discount department stores
export const kmart = (new LiqMarker(OTHER_SIZE, 2, 'black', '#bb1431').createTriangle().img);
export const kmartHub = (new LiqMarker(OTHER_SIZE, 2, 'black', '#bb1431').createPolygon(
  reverseTrianglePoints(OTHER_SIZE)
).img)
export const target = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ffc527').createTriangle().img);
export const targetCountry = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ffc527').createPolygon(
  reverseTrianglePoints(OTHER_SIZE)
).img);
export const bigW = (new LiqMarker(OTHER_SIZE, 2, 'black', '#1111af').createTriangle().img);
export const unknownDDS = (new LiqMarker(OTHER_SIZE, 2, 'black', '#252525').createTriangle().img);

// LFR
export const amart = (new LiqMarker(OTHER_SIZE, 2, 'black', 'gray').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const anaconda = (new LiqMarker(OTHER_SIZE, 2, 'black', 'orange').createTriangle().img);
export const bunnings = (new LiqMarker(OTHER_SIZE, 2, 'black', '#008080').createSquare().img);
export const domayne = (new LiqMarker(OTHER_SIZE, 2, 'black', 'green').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const fantasticFurniture = (new LiqMarker(OTHER_SIZE, 2, 'black', 'red').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const fortyWinks = (new LiqMarker(OTHER_SIZE, 2, 'black', 'blue').createPolygon(
  reverseTrianglePoints(OTHER_SIZE)
).img);
export const harveyNorman = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ADD8E6').createStar().img);
export const ikea = (new LiqMarker(OTHER_SIZE, 2, 'black', 'yellow').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const lincraft = (new LiqMarker(OTHER_SIZE, 2, 'black', 'purple').createCircle().img);
export const snooze = (new LiqMarker(OTHER_SIZE, 2, 'black', 'brown').createPolygon(
  reverseTrianglePoints(OTHER_SIZE)
).img);
export const spotlight = (new LiqMarker(OTHER_SIZE, 2, 'black', 'red').createCircle().img);
export const theGoodGuys = (new LiqMarker(OTHER_SIZE, 2, 'black', 'purple').createStar().img);

// Mini majors
export const appleStore = (new LiqMarker(OTHER_SIZE, 2, 'black', '#85cc14').createStar().img);
export const bestAndLess = (new LiqMarker(OTHER_SIZE, 2, 'black', '#b74fc9').createCircle().img);
export const chemistWarehouse = (new LiqMarker(OTHER_SIZE, 2, 'black', '#bb1431').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const cottonOn = (new LiqMarker(OTHER_SIZE, 2, 'black', '#bb1431').createCircle().img);
export const countryRoad = (new LiqMarker(OTHER_SIZE, 2, 'black', '#6bc1ff').createCircle().img);
export const daiso = (new LiqMarker(OTHER_SIZE, 2, 'black', '#b74fc9').createSquare().img);
export const danMurphys = (new LiqMarker(OTHER_SIZE, 2, 'black', '#015c00').createPentagon().img);
export const firstChoiceLiquor = (new LiqMarker(OTHER_SIZE, 2, 'black', '#bb1431').createPentagon().img);
export const glueStore = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ff6e00').createCircle().img);
export const hAndM = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ffc527').createCircle().img);
export const harrisFarmMarkets = (new LiqMarker(OTHER_SIZE, 2, 'black', '#6bc1ff').createPentagon().img);
export const hsHome = (new LiqMarker(OTHER_SIZE, 2, 'black', '#1111af').createPolygon(
  reverseTrianglePoints(OTHER_SIZE)
).img);
export const jbhifi = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ff6e00').createStar().img);
export const kathmandu = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ff6e00').createTriangle().img);
export const meccaCosmetica = (new LiqMarker(OTHER_SIZE, 2, 'black', '#7fc314').createPolygon(
  reverseTrianglePoints(OTHER_SIZE)
).img);
export const pricelinePharmacy = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ffc527').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const rebelSports = (new LiqMarker(OTHER_SIZE, 2, 'black', '#6bc1ff').createTriangle().img);
export const rivers = (new LiqMarker(OTHER_SIZE, 2, 'black', '#1198a4').createCircle().img);
export const sephora = (new LiqMarker(OTHER_SIZE, 2, 'black', '#bb1431').createPolygon(
  reverseTrianglePoints(OTHER_SIZE)
).img);
export const terryWhiteChemmart = (new LiqMarker(OTHER_SIZE, 2, 'black', '#7fc314').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const theRejectShop = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ffc527').createSquare().img);
export const tkMaxx = (new LiqMarker(OTHER_SIZE, 2, 'black', '#1111af').createCircle().img);
export const uniqlo = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ff77c2').createCircle().img);
export const zara = (new LiqMarker(OTHER_SIZE, 2, 'black', '#85cc14').createCircle().img);

// Supermarkets
export const woolworths = (new LiqMarker(OTHER_SIZE, 2, 'black', '#01b208').createCircle().img);
export const coles = (new LiqMarker(OTHER_SIZE, 2, 'black', '#bb1431').createCircle().img);
export const aldi = (new LiqMarker(OTHER_SIZE, 2, 'black', '#6bc1ff').createCircle().img);
export const iga = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ffc527').createCircle().img);
export const foodWorks = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ff6e00').createCircle().img);
export const costco = (new LiqMarker(OTHER_SIZE, 2, 'black', '#b74fc9').createCircle().img);
export const drakes = (new LiqMarker(OTHER_SIZE, 2, 'black', '#a9a9a9').createCircle().img);
export const spar = (new LiqMarker(OTHER_SIZE, 2, 'black', '#700184').createCircle().img);
export const igaExpress = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ffc527').createCircle().img);
export const otherSmkt = (new LiqMarker(OTHER_SIZE, 2, 'black', '#1111af').createCircle().img);
export const unknownSmkt = (new LiqMarker(OTHER_SIZE, 2, 'black', '#252525').createCircle().img);

// Liquor
export const liquorLand = (new LiqMarker(OTHER_SIZE, 2, 'black', '#e31a1c').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const bws = (new LiqMarker(OTHER_SIZE, 2, 'black', '#ff6e00').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const igaLiquor = (new LiqMarker(OTHER_SIZE, 2, 'black', '#f9d729').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const aldiLiquor = (new LiqMarker(OTHER_SIZE, 2, 'black', '#6bc1ff').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const vintageCellars = (new LiqMarker(OTHER_SIZE, 2, 'black', '#d346d1').createPolygon(
  diamondPoints(OTHER_SIZE)
).img);
export const otherLiquor = (new LiqMarker(OTHER_SIZE, 2, 'black', '#0000ff').createCircle().img);