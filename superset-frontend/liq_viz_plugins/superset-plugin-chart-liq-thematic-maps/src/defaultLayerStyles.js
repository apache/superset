const scDims = {
    'city_centre': 15,
    'lfr': 15,
    'local_transit_outlet': 15,
    'neighbourhood': 15,
    'regional': 45,
    'sub_regional': 30,
    'themed': 15,
    'market': 15
}

const intranetImgs = {
    'city_centre': '/static/scs_svg/city_centre.svg',
    'lfr': '/static/scs_svg/lfr.svg',
    'local_transit_outlet': '/static/scs_svg/local_transit_outlet.svg',
    'neighbourhood': '/static/scs_svg/neighbourhood.svg',
    'regional': '/static/scs_svg/regional.svg',
    'sub_regional': '/static/scs_svg/sub_regional.svg',
    'themed': '/static/scs_svg/themed.svg',
    'market': '/static/scs_svg/market.svg' 
  }

const intranetExprs = {
    'shopping_centres': [
        'case',
        [
            'any',
            ['==', ['get', 'description'], 'Local Centre'],
            ['==', ['get', 'description'], 'Transit Centre'],
            ['==', ['get', 'description'], 'Outlet Centre']
        ],
        'local_transit_outlet',
        [
            'any',
            ['==', ['get', 'description'], 'Regional'],
            ['==', ['get', 'description'], 'Super Regional']
        ],
        'regional',
        ['==', ['get', 'description'], 'Market'],
        'market',
        ['==', ['get', 'description'], 'Themed'],
        'themed',
        ['==', ['get', 'description'], 'Large Format Retail'],
        'lfr',
        ['==', ['get', 'description'], 'City Centre'],
        'city_centre',
        ['==', ['get', 'description'], 'Neighbourhood'],
        'neighbourhood',
        'sub_regional'
    ]
}

const defaultLayerStyles = {
    boundaryStyle: {
        'fill-color': 'transparent',
        'fill-outline-color': '#2E2EFF',
        'fill-opacity': 0.5
    },
    intranetLayerStyle: (layer) => {
        return {
            'circle-radius': 5,
            'circle-color': intranetColors[layer],
            'circle-stroke-width': 1
        }
    }
};

module.exports = { defaultLayerStyles, intranetExprs, scDims, intranetImgs };