import React, { useEffect, useState } from 'react';
import { Collapse, Divider, List, Avatar, Button, Typography } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import LegendSub from './LegendSub.js';

const defaults = require('../defaultLayerStyles.js');
const intranetImgs = defaults.intranetImgs;
const intranetLegendExprs = defaults.intranetLegendExprs;

const { Panel } = Collapse;
const { Text } = Typography;

// Map tile layer names to a more human readable format
const nameMap = {
  'shopping_centres': 'Shopping Centres',
  'department_stores': 'Department Stores',
  'discount_department_stores': 'Discount Department Stores',
  'large_format_retail': 'Large Format Retail',
  'mini_majors': 'Mini Majors',
  'supermarkets': 'Supermarkets',
  'liquor': 'Liquor'
};

// Map each tile intranet layer and it's corresponding data for the legend in the format [Name, Image Icon Source, Description]
const intranetLegend = {
  'shopping_centres': [
    ['Super Regional', intranetImgs['regional'], ''],
    ['Regional', intranetImgs['regional'], ''],
    ['Sub-regional', intranetImgs['sub_regional'], ''],
    ['Neighbourhood', intranetImgs['neighbourhood'], ''],
    ['City Centre', intranetImgs['city_centre'], ''],
    ['Themed', intranetImgs['themed'], ''],
    ['Large Format Retail', intranetImgs['lfr'], ''],
    ['Outlet', intranetImgs['local_transit_outlet'], ''],
    ['Market', intranetImgs['market'], ''],
    ['Local', intranetImgs['local_transit_outlet'], ''],
    ['Transit', intranetImgs['local_transit_outlet'], '']
  ],
  'department_stores': [
    ['David Jones', intranetImgs['david_jones'], ''],
    ['Myer', intranetImgs['myer'], ''],
    ['Harris Scarfe', intranetImgs['harris_scarfe'], ''],
    ['Unknown DS', intranetImgs['unknown_ds'], '']
  ],
  'discount_department_stores': [
    ['Kmart', intranetImgs['kmart'], ''],
    ['Kmart Hub', intranetImgs['kmart_hub'], ''],
    ['Target', intranetImgs['target'], ''],
    ['Big W', intranetImgs['big_w'], ''],
    ['Target Country', intranetImgs['target_country'], ''],
    ['Unknown DDS', intranetImgs['unknown_dds'], '']
  ],
  'large_format_retail': [
    ['Amart', intranetImgs['amart'], ''],
    ['Anaconda', intranetImgs['anaconda'], ''],
    ['Bunnings', intranetImgs['bunnings'], ''],
    ['Domayne', intranetImgs['domayne'], ''],
    ['Fantastic Furniture', intranetImgs['fantastic_furniture'], ''],
    ['Forty Winks', intranetImgs['forty_winks'], ''],
    ['Harvey Norman Group', intranetImgs['harvey_norman'], ''],
    ['Ikea', intranetImgs['ikea'], ''],
    ['Lincraft', intranetImgs['lincraft'], ''],
    ['Snooze', intranetImgs['snooze'], ''],
    ['Spotlight', intranetImgs['spotlight'], ''],
    ['The Good Guys', intranetImgs['the_good_guys'], '']
  ],
  'mini_majors': [
    ['Apple Store', intranetImgs['apple_store'], ''],
    ['Best & Less', intranetImgs['best_and_less'], ''],
    ['Chemist Warehouse', intranetImgs['chemist_warehouse'], ''],
    ['Cotton On', intranetImgs['cotton_on'], ''],
    ['Country Road', intranetImgs['country_road'], ''],
    ['Daiso', intranetImgs['daiso'], ''],
    ['Dan Murphy\'s', intranetImgs['dan_murphys'], ''],
    ['First Choice Liquor', intranetImgs['first_choice_liquor'], ''],
    ['Glue Store', intranetImgs['glue_store'], ''],
    ['H & M', intranetImgs['h_and_m'], ''],
    ['Harris Farm Markets', intranetImgs['harris_farm_markets'], ''],
    ['HS Home', intranetImgs['hs_home'], ''],
    ['JB Hi-Fi', intranetImgs['jbhifi'], ''],
    ['Kathmandu', intranetImgs['kathmandu'], ''],
    ['Mecca Cosmetica', intranetImgs['mecca_cosmetica'], ''],
    ['Priceline Pharmacy', intranetImgs['priceline_pharmacy'], ''],
    ['Rebel Sport', intranetImgs['rebel_sports'], ''],
    ['Rivers', intranetImgs['rivers'], ''],
    ['Sephora', intranetImgs['sephora'], ''],
    ['Terry White Chemist', intranetImgs['terry_white_chemmart'], ''],
    ['The Reject Shop', intranetImgs['the_reject_shop'], ''],
    ['TK Maxx', intranetImgs['tk_maxx'], ''],
    ['Uniqlo', intranetImgs['uniqlo'], ''],
    ['Zara', intranetImgs['zara'], '']
  ],
  'supermarkets': [
    ['Woolworths', intranetImgs['woolworths'], ''],
    ['Coles', intranetImgs['coles'], ''],
    ['Aldi', intranetImgs['aldi'], ''],
    ['IGA', intranetImgs['iga'], ''],
    ['FoodWorks', intranetImgs['foodworks'], ''],
    ['Costco', intranetImgs['costco'], ''],
    ['Drakes', intranetImgs['drakes_supermarket'], ''],
    ['Spar', intranetImgs['spar'], ''],
    ['IGA Express', intranetImgs['iga_express'], ''],
    ['Others', intranetImgs['other_smkt'], ''],
    ['Unknown Smkt', intranetImgs['unknown_smkt'], '']
  ],
  'liquor': [
    ['Liquorland', intranetImgs['liquorland'], ''],
    ['BWS', intranetImgs['bws'], ''],
    ['IGA Liquor', intranetImgs['iga_liquor'], ''],
    ['Aldi Liquor', intranetImgs['aldi_liquor'], ''],
    ['Vintage Cellars', intranetImgs['vintage_cellars'], ''],
    ['First Choice Liquor', intranetImgs['first_choice_liquor'], ''],
    ['Dan Murphys', intranetImgs['dan_murphys'], ''],
    ['Other Liquor', intranetImgs['other_liquor']]
  ]
};

export default function Legend(props) {
  
  const {
    colorMap,
    groupCol,
    thematicData, // maps thematic breaks to their respective colours 
    thematicCol, // name of the thematic metric column
    intranetLayers,
    tradeAreas, // list of trade area names rendered on the map
    taSectorSA1Map,
    taSectorColorMap,
    map
  } = props;

  // Function to instantiate thematic legend config
  const thematicLegendData = (thematicData, thematicCol, colorMap, groupCol) => {
    return {
      header: 'Thematic',
      panelHeaders: [thematicCol],
      init: { 'boundary_tileset': []},
      layers: { 'boundary_tileset': Object.keys(colorMap) },
      listData: {
        'boundary_tileset': Object.keys(thematicData).map(k => {
          return {
            title: k,
            desc: '',
            avatar: <div style={{width: 24, height: 24, background: thematicData[k]}}/>,
            hide: thematicData[k]
          }
        }),
      },
      filterExpr: (l, k) => ['!', ['in', ['get', groupCol], ['literal', colorMap[k]]]]
    }
  }

  // Function to instantiate intranet legend config
  const intranetLegendData = (intranetLayers) => {
    return {
      header: 'Intranet Layers',
      panelHeaders: intranetLayers.map(x => nameMap[x]),
      init: Object.fromEntries(
        Object.keys(intranetLegend).map(x => [x, []])
      ),
      layers: Object.fromEntries(
        intranetLayers.map(x => [x, intranetLegend[x].map(d => d[0])])
      ),
      listData: Object.fromEntries(
        intranetLayers.map(x => [x, intranetLegend[x].map(d => {
          return {
            title: d[0],
            desc: d[2],
            avatar: <Avatar src={d[1]} shape='square' size={24} />,
            hide: d[0]
          }
        })])
      ),
      filterExpr: (l, k) => intranetLegendExprs[l][k]
    }
  };

  // Function to instantiate trade area legend config
  const treadeAreaLegendData = (tradeAreas, taSectorSA1Map, taSectorColorMap, groupCol) => {
    return {
      header: 'All trade areas',
      panelHeaders: Object.keys(taSectorSA1Map),
      init: Object.fromEntries(
        tradeAreas.map(x => [x, []])
      ),
      layers: Object.fromEntries(
        tradeAreas.map(x => [x, Object.keys(taSectorSA1Map[x])])
      ),
      listData: Object.fromEntries(
        tradeAreas.map(x => [x, Object.keys(taSectorSA1Map[x]).sort((a, b) => a.localeCompare(b)).map(d => {
          return {
            title: d,
            desc: '',
            avatar: <div style={{width: 24, height: 24, background: taSectorColorMap[x][d]}}/>,
            hide: d
          }
        })])
      ),
      filterExpr: (l, k) => ['!', ['in', ['get', groupCol], ['literal', taSectorSA1Map[l][k]]]]
    }
  }

  // Keep track of which legends to display
  const [configs, setConfigs] = useState([]);

  // Hook to update configs
  useEffect(() => {
    let newConfigs = [];
    if (thematicData) newConfigs.push(
      thematicLegendData(thematicData, thematicCol, colorMap, groupCol)
    );
    if (intranetLayers && intranetLayers.length > 0) newConfigs.push(
      intranetLegendData(intranetLayers)
    );
    if (tradeAreas && tradeAreas.length > 0) newConfigs.push(
      treadeAreaLegendData(tradeAreas, taSectorSA1Map, taSectorColorMap, groupCol)
    );
    setConfigs([...newConfigs]);
  }, [thematicData, intranetLayers, tradeAreas])

  return (
    <>
      {configs.map((c, i) => (
        <LegendSub config={c} map={map} key={i} /> 
      ))}
    </>
  )

}