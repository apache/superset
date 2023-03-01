import React, { useEffect, useState } from 'react';
import { Collapse, Divider, List, Avatar, Button, Icon } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';

const defaults = require('../defaultLayerStyles.js');
const intranetImgs = defaults.intranetImgs;
const tradeAreaColors = defaults.tradeAreaColors;
const intranetLegendExprs = defaults.intranetLegendExprs;

const { Panel } = Collapse;

const nameMap = {
  'shopping_centres': 'Shopping Centres',
  'department_stores': 'Department Stores',
  'discount_department_stores': 'Discount Department Stores',
  'large_format_retail': 'Large Format Retail',
  'mini_majors': 'Mini Majors',
  'supermarkets': 'Supermarkets',
  'liquor': 'Liquor'
};

const legend = {
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
    ['IGA', intranetImgs['IGA'], ''],
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
    thematicData,
    thematicCol,
    intranetLayers,
    map
  } = props;

  const [currHiddenThematic, setCurrHiddenThematic] = useState([]);
  const [currHiddenIntranet, setCurrHiddenIntranet] = useState(
    Object.fromEntries(intranetLayers.map(l => [l, []]))
  );

  const getThematicFilterExpr = (color) => {
    return ['!', ['in', ['get', groupCol], ['literal', colorMap[color]]]];
  };

  const updateMapThematic = (layer, layerType, hidden) => {
    if (!map.current) return;
    if (hidden.length === 0) {
      map.current.setFilter(layer, null);
    } else {
      let filterExpr = ['all'];
      for (const k of hidden) {
        if (layerType === 'thematic') {
          filterExpr.push(getThematicFilterExpr(k));
        } else if (layerType === 'intranet') {
          filterExpr.push(intranetLegendExprs[layer][k]);
        }
      }
      map.current.setFilter(layer, filterExpr);
    }
  }

  const hideIntranet = (layer, store) => {
    if (currHiddenIntranet[layer].includes(store)) return;
    let hidden = {...currHiddenIntranet}
    hidden[layer].push(store);
    updateMapThematic(layer, 'intranet', hidden[layer]);
    setCurrHiddenIntranet({...hidden});
  }

  const hideThematic = (color) => {
    if (currHiddenThematic.includes(color)) return;
    let hidden = [...currHiddenThematic];
    hidden.push(color);
    updateMapThematic('boundary_tileset', 'thematic', hidden);
    setCurrHiddenThematic([...hidden]);
  };

  const unhideIntranet = (layer, store) => {
    let hidden = {...currHiddenIntranet};
    hidden[layer] = hidden[layer].filter(x => !(x == store));
    updateMapThematic(layer, 'intranet', hidden[layer]);
    setCurrHiddenIntranet({...hidden});
  }

  const unhideThematic = (color) => {
    let hidden = [...currHiddenThematic].filter(x => !(x == color));
    updateMapThematic('boundary_tileset', 'thematic', hidden);
    setCurrHiddenThematic([...hidden]);
  };

  const hideAll = (e) => {
    e.stopPropagation();
    updateMapThematic('boundary_tileset', 'thematic', [...Object.keys(colorMap)]);
    setCurrHiddenThematic([...Object.keys(colorMap)]);
  }

  const unhideAll = (e) => {
    e.stopPropagation();
    updateMapThematic('boundary_tileset', 'thematic', []);
    setCurrHiddenThematic([]);
  }

  // Update intranet layer added in real time
  useEffect(() => {
    let hidden = {...currHiddenIntranet};
    for (const l of intranetLayers) {
      if (!(l in hidden)) hidden[l] = [];
    }
    setCurrHiddenIntranet({...hidden});
  }, [intranetLayers])

  return (
    <>
      <Divider orientation='left'>
        Thematic
      </Divider>
      <Collapse>
        <Panel 
          header={thematicCol} 
          key='0'
          extra={
            <Button 
              type='text'
              shape='circle'
              size='small'
              icon={
                currHiddenThematic.length === 0 ? <EyeOutlined /> : <EyeInvisibleOutlined />
              }
              onClick={
                currHiddenThematic.length === 0 ? (e) => hideAll(e) : (e) => unhideAll(e)
              }
            />
          }
        >
          <List
            size='small'
            itemLayout='horizontal'
            dataSource={(thematicData ? Object.keys(thematicData) : []).map(k => {
              return { title: k, color: thematicData[k] }
            })}
            renderItem={item => (
              <List.Item 
                extra={
                  <Button 
                    type='text' 
                    shape='circle' 
                    size='small'
                    icon={
                      currHiddenThematic.includes(item.color) ? <EyeInvisibleOutlined /> : <EyeOutlined />
                    }
                    onClick={currHiddenThematic.includes(item.color) ? () => unhideThematic(item.color) : () => hideThematic(item.color)} 
                  />
                }
              >
                <List.Item.Meta
                avatar={<div style={{width: 24, height: 24, background: item.color}} />}
                title={item.title}
                />
              </List.Item>
            )}  
          />
        </Panel>
      </Collapse>
      <Divider orientation='left'>
        Intranet Layers
      </Divider>
      <Collapse>
        {intranetLayers && intranetLayers.map((l, i) => (
          <Panel header={nameMap[l]} key={i}>
            <List
              size='small'
              itemLayout='horizontal'
              dataSource={(l in legend ? legend[l] : []).map(d => {
                return { title: d[0], img: d[1], desc: d[2], layer: l }
              })}
              renderItem={item => (
                <List.Item 
                  extra={
                    <Button 
                      type='text' 
                      shape='circle'
                      size='small' 
                      icon={
                        currHiddenIntranet[item.layer].includes(item.title) ? <EyeInvisibleOutlined /> : <EyeOutlined />
                      }
                      onClick={
                        currHiddenIntranet[item.layer].includes(item.title) ? 
                          () => unhideIntranet(item.layer, item.title) :
                          () => hideIntranet(item.layer, item.title)
                      } 
                    />
                  }
                >
                  <List.Item.Meta
                    avatar={<Avatar src={item.img} shape='square' size={24} />}
                    title={item.title}
                  />
                </List.Item>
              )}
            />
          </Panel>
        ))}
      </Collapse>
    </>
  );
}