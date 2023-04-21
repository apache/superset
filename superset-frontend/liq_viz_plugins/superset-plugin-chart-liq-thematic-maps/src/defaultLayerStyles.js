const PROPOSED_CHECK = ['==', ['get', 'proposed'], true];
const PROPOSED_CHECK_F = ['==', ['get', 'proposed'], false];

const gen_proposed = (val, attr, img) => {
  
  if (typeof val === 'object') {

    const p_expr = ['any'];
    const c_expr = ['any'];

    val.map(v => {
      const check = ['==', ['get', attr], v];
      p_expr.push(['all', PROPOSED_CHECK, check]);
      c_expr.push(['all', PROPOSED_CHECK_F, check]);
    })

    return [[...p_expr], `${img}P`, [...c_expr], img];

  }

  const check = ['==', ['get', attr], val];
  
  return [['all', PROPOSED_CHECK, check], `${img}P`, ['all', PROPOSED_CHECK_F, check], img]

}

const intranetLegendExprs = {
  'shopping_centres': {
    'Super Regional': ['!', ['==', ['get', 'description'], 'Super Regional']],
    'Regional': ['!', ['==', ['get', 'description'], 'Regional']],
    'Sub-regional': ['!', ['==', ['get', 'description'], 'Sub-regional']],
    'Neighbourhood': ['!', ['==', ['get', 'description'], 'Neighbourhood']],
    'City Centre': ['!', ['==', ['get', 'description'], 'City Centre']],
    'Themed': ['!', ['==', ['get', 'description'], 'Themed']],
    'Large Format Retail': ['!', ['==', ['get', 'description'], 'Large Format Retail']],
    'Outlet': ['!', ['==', ['get', 'description'], 'Outlet Centre']],
    'Market': ['!', ['==', ['get', 'description'], 'Market']],
    'Local': ['!', ['==', ['get', 'description'], 'Local Centre']],
    'Transit': ['!', ['==', ['get', 'description'], 'Transit Centre']]
  },
  'department_stores': {
    'David Jones': ['!', ['==', ['get', 'tenant_id'], 4537]],
    'Myer': ['!', ['==', ['get', 'tenant_id'], 11884]],
    'Harris Scarfe': ['!', ['==', ['get', 'tenant_id'], 7644]],
    'Unknown DS': ['in', ['get', 'tenant_id'], ['literal', [4537, 11884, 7644]]]
  },
  'discount_department_stores': {
    'Kmart': ['!', ['==', ['get', 'tenant_id'], 9595]],
    'Kmart Hub': ['!', ['==', ['get', 'tenant_id'], 92073]],
    'Big W': ['!', ['==', ['get', 'tenant_id'], 1759]],
    'Target': ['!', ['==', ['get', 'tenant_id'], 16842]],
    'Target Country': ['!', ['==', ['get', 'tenant_id'], 16844]],
    'Unknown DDS': ['in', ['get', 'tenant_id'], ['literal', [9595, 92073, 1759, 16842, 16844]]]
  },
  'large_format_retail': {
    'Amart': ['!', ['==', ['get', 'tenant_id'], 16550]],
    'Anaconda': ['!', ['==', ['get', 'tenant_id'], 525]],
    'Bunnings': ['!', ['==', ['get', 'tenant_id'], 2431]],
    'Domayne': ['!', ['==', ['get', 'tenant_id'], 4992]],
    'Fantastic Furniture': ['!', ['==', ['get', 'tenant_id'], 5881]],
    'Forty Winks': ['!', ['==', ['get', 'tenant_id'], 6334]],
    'Harvey Norman Group': ['!', ['==', ['get', 'tenant_id'], 7656]],
    'Ikea': ['!', ['==', ['get', 'tenant_id'], 8299]],
    'Lincraft': ['!', ['==', ['get', 'tenant_id'], 10112]],
    'Snooze': ['!', ['==', ['get', 'tenant_id'], 2893]],
    'Spotlight': ['!', ['==', ['get', 'tenant_id'], 15974]],
    'The Good Guys': ['!', ['==', ['get', 'tenant_id'], 17321]]
  },
  'supermarkets': {
    'Woolworths': [
      '!', 
      [
        'any',
        ['==', ['get', 'tenant_id'], 19145],
        ['==', ['get', 'tenant_id'], 19153]
      ]
    ],
    'Coles': [
      '!', 
      [
        'any',
        ['==', ['get', 'tenant_id'], 3898],
        ['==', ['get', 'tenant_id'], 44728]
      ]
    ],
    'Aldi': ['!', ['==', ['get', 'tenant_id'], 341]],
    'IGA': ['!', ['==', ['get', 'tenant_id'], 8291]],
    'FoodWorks': ['!', ['==', ['get', 'tenant_id'], 6267]],
    'Costco': ['!', ['==', ['get', 'tenant_id'], 4149]],
    'Drakes': ['!', ['==', ['get', 'tenant_id'], 39173]],
    'Spar': ['!', ['==', ['get', 'tenant_id'], 15874]],
    'IGA Express': ['!', ['==', ['get', 'tenant_id'], 8294]],
    'Others': [
      'in',
      ['get', 'tenant_id'],
      ['literal', [19145, 19153, 3898, 44728, 341, 8291, 6267, 4149, 39173, 15874, 8294, 18239]]
    ],
    'Unknown Smkt': ['!', ['==', ['get', 'tenant_id'], 18239]]
  },
  'mini_majors': {
    'Apple Store': ['!', ['==', ['get', 'tenant_id'], 20105]],
    'Best & Less': ['!', ['==', ['get', 'tenant_id'], 1655]],
    'Chemist Warehouse': ['!', ['==', ['get', 'tenant_id'], 3342]],
    'Cotton On': ['!', ['==', ['get', 'tenant_id'], 4167]],
    'Country Road': ['!', ['==', ['get', 'tenant_id'], 4171]],
    'Daiso': ['!', ['==', ['get', 'tenant_id'], 22164]],
    'Dan Murphy\'s': ['!', ['==', ['get', 'tenant_id'], 4492]],
    'First Choice Liquor': ['!', ['==', ['get', 'tenant_id'], 6058]],
    'Glue Store': ['!', ['==', ['get', 'tenant_id'], 20461]],
    'H & M': ['!', ['==', ['get', 'tenant_id'], 24715]],
    'Harris Farm Markets': ['!', ['==', ['get', 'tenant_id'], 7650]],
    'HS Home': ['!', ['==', ['get', 'tenant_id'], 24930]],
    'JB Hi-Fi': ['!', ['==', ['get', 'tenant_id'], 8725]],
    'Kathmandu': ['!', ['==', ['get', 'tenant_id'], 9218]],
    'Mecca Cosmetica': ['!', ['==', ['get', 'tenant_id'], 11041]],
    'Priceline Pharmacy': ['!', ['==', ['get', 'tenant_id'], 13827]],
    'Rebel Sport': ['!', ['==', ['get', 'tenant_id'], 14218]],
    'Rivers': ['!', ['==', ['get', 'tenant_id'], 14519]],
    'Sephora': ['!', ['==', ['get', 'tenant_id'], 25346]],
    'Terry White Chemist': ['!', ['==', ['get', 'tenant_id'], 17006]],
    'The Reject Shop': ['!', ['==', ['get', 'tenant_id'], 17494]],
    'TK Maxx': ['!', ['==', ['get', 'tenant_id'], 17925]],
    'Uniqlo': ['!', ['==', ['get', 'tenant_id'], 24586]],
    'Zara': ['!', ['==', ['get', 'tenant_id'], 22168]]
  },
  'liquor': {
    'Liquorland': ['!', ['==', ['get', 'tenant_id'], 10154]],
    'BWS': ['!', ['==', ['get', 'tenant_id'], 2494]],
    'IGA Liquor': ['!', ['==', ['get', 'tenant_id'], 93808]],
    'Aldi Liquor': ['!', ['==', ['get', 'tenant_id'], 39252]],
    'Vintage Cellars': ['!', ['==', ['get', 'tenant_id'], 18514]],
    'First Choice Liquor': ['!', ['==', ['get', 'tenant_id'], 6058]],
    'Dan Murphys': ['!', ['==', ['get', 'tenant_id'], 4492]],
    'Other Liquor': [
      'in',
      ['get', 'tenant_id'],
      ['literal', [10154, 2494, 93808, 39252, 18514, 6058, 4492]]
    ]
  }
};

const iconExprs = {
  'shopping_centres': [
    'case',
    ...gen_proposed(['Local Centre', 'Transit Centre', 'Outlet Centre'], 'description', 'outletSC'),
    ...gen_proposed(['Regional', 'Super Regional'], 'description', 'regionalSC'),
    ...gen_proposed('Market', 'description', 'marketSC'),
    ...gen_proposed('Themed', 'description', 'themedSC'),
    ...gen_proposed('Large Format Retail', 'description', 'lfrSC'),
    ...gen_proposed('City Centre', 'description', 'cityCentreSC'),
    ...gen_proposed('Neighbourhood', 'description', 'neighbourhoodSC'),
    PROPOSED_CHECK,
    'subRegionalSCP',
    'subRegionalSC'
  ],
  'department_stores': [
    'case',
    ...gen_proposed(4537, 'tenant_id', 'davidJones'),
    ...gen_proposed(11884, 'tenant_id', 'myer'),
    ...gen_proposed(7644, 'tenant_id', 'harrisScarfe'),
    PROPOSED_CHECK,
    'unknownDSP',
    'unknownDS'
  ],
  'discount_department_stores': [
    'case',
    ...gen_proposed(9595, 'tenant_id', 'kmart'),
    ...gen_proposed(92073, 'tenant_id', 'kmartHub'),
    ...gen_proposed(1759, 'tenant_id', 'bigW'),
    ...gen_proposed(16842, 'tenant_id', 'target'),
    ...gen_proposed(16844, 'tenant_id', 'targetCountry'),
    PROPOSED_CHECK,
    'unknownDDSP',
    'unknownDDS'
  ],
  'large_format_retail': [
    'case',
    ...gen_proposed(16550, 'tenant_id', 'amart'),
    ...gen_proposed(525, 'tenant_id', 'anaconda'),
    ...gen_proposed(2431, 'tenant_id', 'bunnings'),
    ...gen_proposed(4992, 'tenant_id', 'domayne'),
    ...gen_proposed(5881, 'tenant_id', 'fantasticFurniture'),
    ...gen_proposed(6334, 'tenant_id', 'fortWinks'),
    ...gen_proposed(7656, 'tenant_id', 'harveyNorman'),
    ...gen_proposed(8299, 'tenant_id', 'ikea'),  
    ...gen_proposed(10112, 'tenant_id', 'lincraft'),
    ...gen_proposed(2893, 'tenant_id', 'snooze'),
    ...gen_proposed(15974, 'tenant_id', 'spotlight'),
    ...gen_proposed(17321, 'tenant_id', 'theGoodGuys'),
    ''
  ],
  'supermarkets': [
    'case',
    [
      'any',
      ['==', ['get', 'tenant_id'], 19145],
      ['==', ['get', 'tenant_id'], 19153]
    ],
    'woolworths',
    [
      'any',
      ['==', ['get', 'tenant_id'], 3898],
      ['==', ['get', 'tenant_id'], 44728]
    ],
    'coles',
    ['==', ['get', 'tenant_id'], 341],
    'aldi',
    ['==', ['get', 'tenant_id'], 8291],
    'iga',
    ['==', ['get', 'tenant_id'], 6267],
    'foodWorks',
    ['==', ['get', 'tenant_id'], 4149],
    'costco',
    ['==', ['get', 'tenant_id'], 39173],
    'drakes',
    ['==', ['get', 'tenant_id'], 15874],
    'spar',
    ['==', ['get', 'tenant_id'], 8294],
    'igaExpress',
    ['==', ['get', 'tenant_id'], 18239],
    'unknownSmkt',
    'otherSmkt'
  ],
  'mini_majors': [
    'case',
    ...gen_proposed(20105, 'tenant_id', 'appleStore'),
    ...gen_proposed(1655, 'tenant_id', 'bestAndLess'),
    ...gen_proposed(3342, 'tenant_id', 'chemistWarehouse'),
    ...gen_proposed(4167, 'tenant_id', 'cottonOn'),
    ...gen_proposed(4171, 'tenant_id', 'countryRoad'),
    ...gen_proposed(22164, 'tenant_id', 'daiso'),
    ...gen_proposed(4492, 'tenant_id', 'danMurphys'),
    ...gen_proposed(6058, 'tenant_id', 'firstChoiceLiquor'),
    ...gen_proposed(20461, 'tenant_id', 'glueStore'),
    ...gen_proposed(24715, 'tenant_id', 'hAndM'),
    ...gen_proposed(7650, 'tenant_id', 'harrisFarmMarkets'),
    ...gen_proposed(24930, 'tenant_id', 'hsHome'),
    ...gen_proposed(8725, 'tenant_id', 'jbhifi'),
    ...gen_proposed(9218, 'tenant_id', 'kathmandu'),
    ...gen_proposed(11041, 'tenant_id', 'meccaCosmetica'),
    ...gen_proposed(13827, 'tenant_id', 'pricelinePharmacy'),
    ...gen_proposed(14218, 'tenant_id', 'rebelSports'),
    ...gen_proposed(14519, 'tenant_id', 'rivers'),
    ...gen_proposed(25346, 'tenant_id', 'sephora'),
    ...gen_proposed(17006, 'tenant_id', 'terryWhiteChemmart'),
    ...gen_proposed(17494, 'tenant_id', 'theRejectShop'),
    ...gen_proposed(17925, 'tenant_id', 'tkMaxx'),
    ...gen_proposed(24586, 'tenant_id', 'uniqlo'),
    ...gen_proposed(22168, 'tenant_id', 'zara'),
    ''
  ],
  'liquor': [
    'case',
    ['==', ['get', 'tenant_id'], 10154],
    'liquorLand',
    ['==', ['get', 'tenant_id'], 2494],
    'bws',
    ['==', ['get', 'tenant_id'], 93808],
    'igaLiquor',
    ['==', ['get', 'tenant_id'], 39252],
    'aldiLiquor',
    ['==', ['get', 'tenant_id'], 18514],
    'vintageCellars',
    ['==', ['get', 'tenant_id'], 6058],
    'firstChoiceLiquor',
    ['==', ['get', 'tenant_id'], 4492],
    'danMurphys',
    'otherLiquor'
  ]
}

const tradeAreaColors = {
  'P1': '#fde6ec',
  'P2': '#fcdbe4',
  'P3': '#fbcfdc',
  'P4': '#fac4d3',
  'P5': '#f9b9cb',
  'P6': '#f9adc3',
  'P7': '#f8a2bb',
  'P8': '#f797b2',
  'P9': '#f68baa',
  'P10': '#f580a2',
  'S1': '#d2c6df',
  'S2': '#ccbadf',
  'S3': '#c6afdf',
  'S4': '#c1a3df',
  'S5': '#bb98df',
  'S6': '#b58cde',
  'S7': '#af81de',
  'S8': '#aa75de',
  'S9': '#a46ade',
  'S10': '#9e5ede',
  'T1': '#e8c6a5',
  'T2': '#e6c19e',
  'T3': '#e4bd97',
  'T4': '#e2b890',
  'T5': '#e0b489',
  'T6': '#ddaf81',
  'T7': '#dbab7a',
  'T8': '#d9a673',
  'T9': '#d7a26c',
  'T10': '#d59d65'
}

const defaultLayerStyles = {
  boundaryStyle: {
    'fill-color': [
      'case',
      ['==', ['feature-state', 'hover'], true],
      '#D3D3D3',
      ['==', ['feature-state', 'color'], null],
      'transparent',
      ['feature-state', 'color']
    ],
    'fill-outline-color': '#2E2EFF',
    'fill-opacity': 0.5
  }
};

module.exports = { 
  defaultLayerStyles, 
  iconExprs, 
  tradeAreaColors,
  intranetLegendExprs 
};