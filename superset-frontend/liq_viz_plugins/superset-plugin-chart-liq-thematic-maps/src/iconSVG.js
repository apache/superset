import LiqMarker from './liqMarker.js';

// shorthand to bypass required parameters
const _ = undefined;
const PROPOSED = [_, _, _, _, true];

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
export const regionalSCP = regionalP.createCircle(...PROPOSED).img;

export const subRegionalSC = sub_regional.createCircle().img;
export const subRegionalSCP = sub_regionalP.createCircle(...PROPOSED).img;

export const neighbourhoodSC = neighbourhood.createCircle().img;
export const neighbourhoodSCP = neighbourhoodP.createCircle(...PROPOSED).img;

export const cityCentreSC = city_centre.createCircle().img;
export const cityCentreSCP = city_centreP.createCircle(...PROPOSED).img;

export const themedSC = themed.createCircle().img;
export const themedSCP = themedP.createCircle(...PROPOSED).img;

export const lfrSC = lfr.createCircle().img;
export const lfrSCP = lfrP.createCircle(...PROPOSED).img;

export const outletSC = outlet.createCircle().img;
export const outletSCP = outletP.createCircle(...PROPOSED).img;

export const marketSC = market.createCircle().img;
export const marketSCP = marketP.createCircle(...PROPOSED).img;

// Department stores
const david_jones = new LiqMarker(OTHER_SIZE, 1, 'black', '#6bc1ff');
const myer_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const harris_scarfe = new LiqMarker(OTHER_SIZE, 2, 'black', '#1111af');
const unknown_ds = new LiqMarker(OTHER_SIZE, 2, 'black', '#252525');

export const davidJones = david_jones.createStar().img;
export const davidJonesP = david_jones.createStar(...PROPOSED).img;

export const myer = myer_c.createStar().img;
export const myerP = myer_c.createStar(...PROPOSED).img;

export const harrisScarfe = harris_scarfe.createSquare().img;
export const harrisScarfeP = harris_scarfe.createSquare(...PROPOSED).img;

export const unknownDS = unknown_ds.createStar().img;
export const unknownDSP = unknown_ds.createStar(...PROPOSED).img;

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