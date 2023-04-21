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
const david_jonesP = new LiqMarker(OTHER_SIZE, 1, 'black', '#6bc1ff')
const myer_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const myer_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const harris_scarfe = new LiqMarker(OTHER_SIZE, 1, 'black', '#1111af');
const harris_scarfeP = new LiqMarker(OTHER_SIZE, 1, 'black', '#1111af');
const unknown_ds = new LiqMarker(OTHER_SIZE, 1, 'black', '#252525');
const unknown_dsP = new LiqMarker(OTHER_SIZE, 1, 'black', '#252525');

export const davidJones = david_jones.createStar().img;
export const davidJonesP = david_jonesP.createStar(...PROPOSED).img;

export const myer = myer_c.createStar().img;
export const myerP = myer_cP.createStar(...PROPOSED).img;

export const harrisScarfe = harris_scarfe.createSquare().img;
export const harrisScarfeP = harris_scarfeP.createSquare(...PROPOSED).img;

export const unknownDS = unknown_ds.createStar().img;
export const unknownDSP = unknown_dsP.createStar(...PROPOSED).img;

// Discount department stores
const kmart_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const kmart_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const kmart_hub = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const kmart_hubP = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const target_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527');
const target_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527');
const target_country = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527');
const target_countryP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527');
const big_w = new LiqMarker(OTHER_SIZE, 1, 'black', '#1111af');
const big_wP = new LiqMarker(OTHER_SIZE, 1, 'black', '#1111af');
const unknown_dds = new LiqMarker(OTHER_SIZE, 1, 'black', '#252525');
const unknown_ddsP = new LiqMarker(OTHER_SIZE, 1, 'black', '#252525');

export const kmart = kmart_c.createTriangle().img;
export const kmartP = kmart_cP.createTriangle(...PROPOSED).img;

export const kmartHub = kmart_hub.createPolygon(reverseTrianglePoints(OTHER_SIZE)).img;
export const kmartHubP = kmart_hubP.createPolygon(reverseTrianglePoints(OTHER_SC_SIZE), ...PROPOSED).img;

export const target = target_c.createTriangle().img;
export const targetP = target_cP.createTriangle(...PROPOSED).img;

export const targetCountry = target_country.createPolygon(reverseTrianglePoints(OTHER_SC_SIZE)).img;
export const targetCountryP = target_countryP.createPolygon(reverseTrianglePoints(OTHER_SIZE), ...PROPOSED).img

export const bigW = big_w.createTriangle().img;
export const bigWP = big_wP.createTriangle(...PROPOSED).img;

export const unknownDDS = unknown_dds.createTriangle().img;
export const unknownDDSP = unknown_ddsP.createTriangle(...PROPOSED).img;

// LFR
const amart_c = new LiqMarker(OTHER_SIZE, 1, 'black', 'gray');
const amart_cP = new LiqMarker(OTHER_SIZE, 1, 'black', 'gray');
const anaconda_c = new LiqMarker(OTHER_SIZE, 1, 'black', 'orange');
const anaconda_cP = new LiqMarker(OTHER_SIZE, 1, 'black', 'orange');
const bunnings_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#008080');
const bunnings_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#008080');
const domayne_c = new LiqMarker(OTHER_SIZE, 1, 'black', 'green');
const domayne_cP = new LiqMarker(OTHER_SIZE, 1, 'black', 'green');
const fantastic_furniture = new LiqMarker(OTHER_SIZE, 1, 'black', 'red');
const fantastic_furnitureP = new LiqMarker(OTHER_SIZE, 1, 'black', 'red');
const forty_winks = new LiqMarker(OTHER_SIZE, 1, 'black', 'blue');
const forty_winksP = new LiqMarker(OTHER_SIZE, 1, 'black', 'blue');
const harvey_norman = new LiqMarker(OTHER_SIZE, 1, 'black', '#ADD8E6');
const harvey_normanP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ADD8E6');
const ikea_c = new LiqMarker(OTHER_SIZE, 1, 'black', 'yellow');
const ikea_cP = new LiqMarker(OTHER_SIZE, 1, 'black', 'yellow');
const lincraft_c = new LiqMarker(OTHER_SIZE, 1, 'black', 'purple');
const lincraft_cP = new LiqMarker(OTHER_SIZE, 1, 'black', 'purple');
const snooze_c = new LiqMarker(OTHER_SIZE, 1, 'black', 'brown');
const snooze_cP = new LiqMarker(OTHER_SIZE, 1, 'black', 'brown');
const spotlight_c = new LiqMarker(OTHER_SIZE, 1, 'black', 'red');
const spotlight_cP = new LiqMarker(OTHER_SIZE, 1, 'black', 'red');
const the_good_guys = new LiqMarker(OTHER_SIZE, 2, 'black', 'purple');
const the_good_guysP = new LiqMarker(OTHER_SIZE, 2, 'black', 'purple');

export const amart = amart_c.createPolygon(diamondPoints(OTHER_SIZE)).img;
export const amartP = amart_cP.createPolygon(diamondPoints(OTHER_SIZE), ...PROPOSED).img;

export const anaconda = anaconda_c.createTriangle().img;
export const anacondaP = anaconda_cP.createTriangle(...PROPOSED).img;

export const bunnings = bunnings_c.createSquare().img;
export const bunningsP = bunnings_cP.createSquare(...PROPOSED).img;

export const domayne = domayne_c.createPolygon(diamondPoints(OTHER_SIZE)).img;
export const domayneP = domayne_cP.createPolygon(diamondPoints(OTHER_SIZE), ...PROPOSED).img;

export const fantasticFurniture = fantastic_furniture.createPolygon(diamondPoints(OTHER_SIZE)).img;
export const fantasticFurnitureP = fantastic_furnitureP.createPolygon(diamondPoints(OTHER_SIZE), ...PROPOSED);

export const fortyWinks = forty_winks.createPolygon(reverseTrianglePoints(OTHER_SIZE)).img;
export const fortyWinksP = forty_winksP.createPolygon(reverseTrianglePoints(OTHER_SIZE), ...PROPOSED).img;

export const harveyNorman = harvey_norman.createStar().img;
export const harveyNormanP = harvey_normanP.createStar(...PROPOSED).img;

export const ikea = ikea_c.createPolygon(diamondPoints(OTHER_SIZE)).img;
export const ikeaP = ikea_cP.createPolygon(diamondPoints(OTHER_SIZE), ...PROPOSED).img;

export const lincraft = lincraft_c.createCircle().img;
export const lincraftP = lincraft_cP.createCircle(...PROPOSED).img;

export const snooze = snooze_c.createPolygon(reverseTrianglePoints(OTHER_SIZE)).img;
export const snoozeP = snooze_cP.createPolygon(reverseTrianglePoints(OTHER_SIZE), ...PROPOSED).img;

export const spotlight = spotlight_c.createCircle().img;
export const spotlightP = spotlight_cP.createCircle(...PROPOSED).img;

export const theGoodGuys = the_good_guys.createStar().img;
export const theGoodGuysP = the_good_guysP.createStar(...PROPOSED).img;

// Mini majors
const apple_store = new LiqMarker(OTHER_SIZE, 1, 'black', '#85cc14'); //star
const apple_storeP = new LiqMarker(OTHER_SIZE, 1, 'black', '#85cc14'); 
const best_and_less = new LiqMarker(OTHER_SIZE, 1, 'black', '#b74fc9'); //circle
const best_and_lessP = new LiqMarker(OTHER_SIZE, 1, 'black', '#b74fc9');
const chemist_warehouse = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431'); //poly diamond
const chemist_warehouseP = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const cotton_on = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431'); //circle
const cotton_onP = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const country_road = new LiqMarker(OTHER_SIZE, 1, 'black', '#6bc1ff'); // cricle
const country_roadP = new LiqMarker(OTHER_SIZE, 1, 'black', '#6bc1ff');
const daiso_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#b74fc9'); //square
const daiso_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#b74fc9');
const dan_murphys = new LiqMarker(OTHER_SIZE, 1, 'black', '#015c00'); //pentagon
const dan_murphysP = new LiqMarker(OTHER_SIZE, 1, 'black', '#015c00');
const first_choice_liquor = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431'); //pentagon
const first_choice_liquorP = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const glue_store = new LiqMarker(OTHER_SIZE, 1, 'black', '#ff6e00'); //circle
const glue_storeP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ff6e00');
const h_and_m = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527'); //circle
const h_and_mP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527');
const harris_farm_markets = new LiqMarker(OTHER_SIZE, 1, 'black', '#6bc1ff'); // pentagon
const harris_farm_marketsP = new LiqMarker(OTHER_SIZE, 1, 'black', '#6bc1ff');
const hs_home = new LiqMarker(OTHER_SIZE, 1, 'black', '#1111af'); //poly rev triangle
const hs_homeP = new LiqMarker(OTHER_SIZE, 1, 'black', '#1111af');
const jb_hi_fi = new LiqMarker(OTHER_SIZE, 1, 'black', '#ff6e00'); //star
const jb_hi_fiP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ff6e00');
const kathmandu_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#ff6e00'); //triangle
const kathmandu_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ff6e00');
const mecca_cosmetica = new LiqMarker(OTHER_SIZE, 1, 'black', '#7fc314'); //poly rev triangle
const mecca_cosmeticaP = new LiqMarker(OTHER_SIZE, 1, 'black', '#7fc314');
const priceline_pharmacy = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527'); //poly diamond
const priceline_pharmacyP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527');
const rebel_sports = new LiqMarker(OTHER_SIZE, 1, 'black', '#6bc1ff'); //triangle
const rebel_sportsP = new LiqMarker(OTHER_SIZE, 1, 'black', '#6bc1ff');
const rivers_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#1198a4'); // circle
const rivers_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#1198a4');
const sephora_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431'); //poly rev triangle
const sephora_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const terry_white_chemmart = new LiqMarker(OTHER_SIZE, 1, 'black', '#7fc314'); //poly diamond
const terry_white_chemmartP = new LiqMarker(OTHER_SIZE, 1, 'black', '#7fc314');
const the_reject_shop = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527'); //square
const the_reject_shopP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527');
const tk_maxx = new LiqMarker(OTHER_SIZE, 1, 'black', '#1111af'); //circle;
const tk_maxxP = new LiqMarker(OTHER_SIZE, 1, 'black', '#1111af');
const uniqlo_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#ff77c2'); //circle
const uniqlo_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ff77c2');
const zara_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#85cc14'); //circle
const zara_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#85cc14');

export const appleStore = apple_store.createStar().img;
export const appleStoreP = apple_storeP.createStar(...PROPOSED).img;

export const bestAndLess = best_and_less.createCircle().img;
export const bestAndLessP = best_and_lessP.createCircle(...PROPOSED).img;

export const chemistWarehouse = chemist_warehouse.createPolygon(diamondPoints(OTHER_SIZE)).img;
export const chemistWarehouseP = chemist_warehouseP.createPolygon(diamondPoints(OTHER_SIZE), ...PROPOSED).img;

export const cottonOn = cotton_on.createCircle().img;
export const cottonOnP = cotton_onP.createCircle(...PROPOSED).img;

export const countryRoad = country_road.createCircle().img;
export const countryRoadP = country_roadP.createCircle(...PROPOSED).img;

export const daiso = daiso_c.createSquare().img;
export const daisoP = daiso_cP.createSquare(...PROPOSED).img;

export const danMurphys = dan_murphys.createPentagon().img;
export const danMurphysP = dan_murphysP.createPentagon(...PROPOSED).img;

export const firstChoiceLiquor = first_choice_liquor.createPentagon().img;
export const firstChoiceLiquorP = first_choice_liquorP.createPentagon(...PROPOSED).img;

export const glueStore = glue_store.createCircle().img;
export const glueStoreP = glue_storeP.createCircle(...PROPOSED).img;

export const hAndM = h_and_m.createCircle().img;
export const hAndMP = h_and_mP.createCircle(...PROPOSED).img;

export const harrisFarmMarkets = harris_farm_markets.createPentagon().img;
export const harrisFarmMarketsP = harris_farm_marketsP.createPentagon(...PROPOSED).img;

export const hsHome = hs_home.createPolygon(reverseTrianglePoints(OTHER_SIZE)).img;
export const hsHomeP = hs_homeP.createPolygon(reverseTrianglePoints(OTHER_SIZE), ...PROPOSED).img;

export const jbhifi = jb_hi_fi.createStar().img;
export const jbhifiP = jb_hi_fiP.createStar(...PROPOSED).img;

export const kathmandu = kathmandu_c.createTriangle().img;
export const kathmanduP = kathmandu_cP.createTriangle(...PROPOSED).img;

export const meccaCosmetica = mecca_cosmetica.createPolygon(reverseTrianglePoints(OTHER_SIZE)).img;
export const meccaCosmeticaP = mecca_cosmeticaP.createPolygon(reverseTrianglePoints(OTHER_SIZE), ...PROPOSED).img;

export const pricelinePharmacy = priceline_pharmacy.createPolygon(diamondPoints(OTHER_SIZE)).img;
export const pricelinePharmacyP = priceline_pharmacyP.createPolygon(diamondPoints(OTHER_SIZE), ...PROPOSED).img;

export const rebelSports = rebel_sports.createTriangle().img;
export const rebelSportsP = rebel_sportsP.createTriangle(...PROPOSED).img;

export const rivers = rivers_c.createCircle().img;
export const riversP = rivers_cP.createCircle(...PROPOSED).img;

export const sephora = sephora_c.createPolygon(reverseTrianglePoints(OTHER_SIZE)).img;
export const sephoraP = sephora_cP.createPolygon(reverseTrianglePoints(OTHER_SIZE), ...PROPOSED).img;

export const terryWhiteChemmart = terry_white_chemmart.createPolygon(diamondPoints(OTHER_SIZE)).img;
export const terryWhiteChemmartP = terry_white_chemmartP.createPolygon(diamondPoints(OTHER_SIZE), ...PROPOSED).img;

export const theRejectShop = the_reject_shop.createSquare().img;
export const theRejectShopP = the_reject_shopP.createSquare(...PROPOSED).img;

export const tkMaxx = tk_maxx.createCircle().img;
export const tkMaxxP = tk_maxxP.createCircle(...PROPOSED).img;

export const uniqlo = uniqlo_c.createCircle().img;
export const uniqloP = uniqlo_cP.createCircle(...PROPOSED).img;

export const zara = zara_c.createCircle().img;
export const zaraP = zara_cP.createCircle(...PROPOSED).img;

// Supermarkets
const woolworths_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#01b208');
const woolworths_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#01b208');
const coles_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const coles_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#bb1431');
const aldi_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#6bc1ff');
const aldi_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#6bc1ff');
const iga_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527');
const iga_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527');
const food_works = new LiqMarker(OTHER_SIZE, 1, 'black', '#ff6e00');
const food_worksP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ff6e00');
const costco_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#b74fc9');
const costco_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#b74fc9');
const drakes_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#a9a9a9');
const drakes_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#a9a9a9');
const spar_c = new LiqMarker(OTHER_SIZE, 1, 'black', '#700184');
const spar_cP = new LiqMarker(OTHER_SIZE, 1, 'black', '#700184');
const iga_express = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527');
const iga_expressP = new LiqMarker(OTHER_SIZE, 1, 'black', '#ffc527');
const other_smkt = new LiqMarker(OTHER_SIZE, 1, 'black', '#1111af');
const other_smktP = new LiqMarker(OTHER_SIZE, 1, 'black', '#1111af');
const unknown_smkt = new LiqMarker(OTHER_SIZE, 1, 'black', '#252525');
const unknown_smktP = new LiqMarker(OTHER_SIZE, 1, 'black', '#252525');

export const woolworths = woolworths_c.createCircle().img;
export const woolworthsP = woolworths_cP.createCircle(...PROPOSED).img;

export const coles = coles_c.createCircle().img;
export const colesP = coles_cP.createCircle(...PROPOSED).img;

export const aldi = aldi_c.createCircle().img;
export const aldiP = aldi_cP.createCircle(...PROPOSED).img;

export const iga = iga_c.createCircle().img;
export const igaP = iga_cP.createCircle(...PROPOSED).img;

export const foodWorks = food_works.createCircle().img;
export const foodWorksP = food_worksP.createCircle(...PROPOSED).img;

export const costco = costco_c.createCircle().img;
export const costcoP = costco_cP.createCircle(...PROPOSED).img;

export const drakes = drakes_c.createCircle().img;
export const drakesP = drakes_cP.createCircle(...PROPOSED).img;

export const spar = spar_c.createCircle().img;
export const sparP = spar_cP.createCircle(...PROPOSED).img;

export const igaExpress = iga_express.createCircle().img;
export const igaExpressP = iga_expressP.createCircle(...PROPOSED).img;

export const otherSmkt = other_smkt.createCircle().img;
export const otherSmktP = other_smktP.createCircle(...PROPOSED).img;

export const unknownSmkt = unknown_smkt.createCircle().img;
export const unknownSmktP = unknown_smktP.createCircle(...PROPOSED).img;

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