const intranetImgs = {
    'city_centre': '/static/scs_png/city_centre.png',
    'lfr': '/static/scs_png/lfr.png',
    'local_transit_outlet': '/static/scs_png/local_transit_outlet.png',
    'neighbourhood': '/static/scs_png/neighbourhood.png',
    'regional': '/static/scs_png/regional.png',
    'sub_regional': '/static/scs_png/sub_regional.png',
    'themed': '/static/scs_png/themed.png',
    'market': '/static/scs_png/market.png',
    'david_jones': '/static/ds_png/david_jones.png',
    'myer': '/static/ds_png/myer.png',
    'harris_scarfe': '/static/ds_png/harris_scarfe.png',
    'unknown_ds': '/static/ds_png/unknown.png',
    'big_w': '/static/dds_png/big_w.png',
    'kmart': '/static/dds_png/kmart.png',
    'kmart_hub': '/static/dds_png/kmart_hub.png',
    'target': '/static/dds_png/target.png',
    'target_country': '/static/dds_png/target_country.png',
    'unknown_dds': '/static/dds_png/unknown.png',
    'amart': '/static/lfr_png/amart.png',
    'anaconda': '/static/lfr_png/anaconda.png',
    'bunnings': '/static/lfr_png/bunnings.png',
    'domayne': '/static/lfr_png/domayne.png',
    'fantastic_furniture': '/static/lfr_png/fantastic_furniture.png',
    'forty_winks': '/static/lfr_png/forty_winks.png',
    'harvey_norman': '/static/lfr_png/harvey_norman.png',
    'ikea': '/static/lfr_png/ikea.png',
    'lincraft': '/static/lfr_png/lincraft.png',
    'snooze': '/static/lfr_png/snooze.png',
    'spotlight': '/static/lfr_png/spotlight.png',
    'the_good_guys': '/static/lfr_png/the_good_guys.png',
    'aldi': '/static/smkt_png/aldi.png',
    'coles': '/static/smkt_png/coles.png',
    'costco': '/static/smkt_png/costco.png',
    'drakes_supermarket': '/static/smkt_png/drakes_supermarket.png',
    'foodworks': '/static/smkt_png/foodworks.png',
    'iga': '/static/smkt_png/iga.png',
    'iga_express': '/static/smkt_png/iga_express.png',
    'other_smkt': '/static/smkt_png/others.png',
    'unknown_smkt': '/static/smkt_png/unknown.png',
    'woolworths': '/static/smkt_png/woolworths.png' 
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
    ],
    'department_stores': 2,
    'discount_department_stores': 0.5
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
    ],
    'department_stores': [
        'case',
        ['==', ['get', 'tenant_id'], 4537],
        'david_jones',
        ['==', ['get', 'tenant_id'], 11884],
        'myer',
        ['==', ['get', 'tenant_id'], 7644],
        'harris_scarfe',
        'unknown_ds'
    ],
    'discount_department_stores': [
        'case',
        ['==', ['get', 'tenant_id'], 9595],
        'kmart',
        ['==', ['get', 'tenant_id'], 92073],
        'kmart_hub',
        ['==', ['get', 'tenant_id'], 1759],
        'big_w',
        ['==', ['get', 'tenant_id'], 16842],
        'target',
        ['==', ['get', 'tenant_id'], 16844],
        'target_country',
        'unknown_dds'
    ],
    'large_format_retail': [
        'case',
        ['==', ['get', 'tenant_id'], 16550],
        'amart',
        ['==', ['get', 'tenant_id'], 525],
        'anaconda',
        ['==', ['get', 'tenant_id'], 2431],
        'bunnings',
        ['==', ['get', 'tenant_id'], 4992],
        'domayne',
        ['==', ['get', 'tenant_id'], 5881],
        'fantastic_furniture',
        ['==', ['get', 'tenant_id'], 6334],
        'forty_winks',
        ['==', ['get', 'tenant_id'], 7656],
        'harvey_norman',
        ['==', ['get', 'tenant_id'], 8299],
        'ikea',
        ['==', ['get', 'tenant_id'], 10112],
        'lincraft',
        ['==', ['get', 'tenant_id'], 2893],
        'snooze',
        ['==', ['get', 'tenant_id'], 15974],
        'spotlight',
        ['==', ['get', 'tenant_id'], 17321],
        'the_good_guys',
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
        'foodworks',
        ['==', ['get', 'tenant_id'], 4149],
        'costco',
        ['==', ['get', 'tenant_id'], 39173],
        'drakes_supermarket',
        ['==', ['get', 'tenant_id'], 15874],
        'spar',
        ['==', ['get', 'tenant_id'], 8294],
        'iga_express',
        ['==', ['get', 'tenant_id'], 18239],
        'unknown_smkt',
        'other_smkt'
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