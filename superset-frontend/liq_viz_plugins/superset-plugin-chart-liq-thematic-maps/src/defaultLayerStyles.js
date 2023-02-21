const intranetImgs = {
    'city_centre': '/static/scs_png/city_centre.png',
    'lfr': '/static/scs_png/lfr.png',
    'local_transit_outlet': '/static/scs_png/local_transit_outlet.png',
    'neighbourhood': '/static/scs_png/neighbourhood.png',
    'regional': '/static/scs_png/regional.png',
    'sub_regional': '/static/scs_png/sub_regional.png',
    'themed': '/static/scs_png/themed.png',
    'market': '/static/scs_png/market.png' 
}

const iconSizeExprs = {
    'shopping_centres': [
        'case',
        [
            'any',
            ['==', ['get', 'description'], 'Local Centre'],
            ['==', ['get', 'description'], 'Transit Centre'],
            ['==', ['get', 'description'], 'Outlet Centre'],
            ['==', ['get', 'description'], 'Large Format Retail'],
            ['==', ['get', 'description'], 'Market'],
            ['==', ['get', 'description'], 'Themed'],
            ['==', ['get', 'description'], 'Neighbourhood'],
            ['==', ['get', 'description'], 'City Centre']
        ],
        0.46,
        [
            'any',
            ['==', ['get', 'description'], 'Regional'],
            ['==', ['get', 'description'], 'Super Regional']
        ],
        1.38,
        0.92
    ]
}

const iconExprs = {
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

module.exports = { defaultLayerStyles, iconExprs, iconSizeExprs, intranetImgs };