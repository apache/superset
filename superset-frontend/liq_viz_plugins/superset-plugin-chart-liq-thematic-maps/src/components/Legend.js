import React, { useEffect, useState } from 'react';
import { Collapse, Divider, List, Avatar, Button, Icon } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';

const defaults = require('../defaultLayerStyles.js');
const intranetImgs = defaults.intranetImgs;
const tradeAreaColors = defaults.tradeAreaColors;

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

  const getThematicFilterExpr = (c) => {
    return ['!', ['in', ['get', groupCol], ['literal', colorMap[c]]]];
  };

  const [currHiddenThematic, setCurrHiddenThematic] = useState([]);

  const updateMapThematic = (hidden) => {
    if (hidden.length === 0) {
      map.current.setFilter('boundary_tileset', null);
    } else {
      let filterExpr = ['all'];
      for (const k of hidden) {
        filterExpr.push(getThematicFilterExpr(k));
      }
      map.current.setFilter('boundary_tileset', filterExpr);
    }
  }

  const hideThematic = (c) => {
    if (currHiddenThematic.includes(c)) return;
    let hidden = [...currHiddenThematic];
    hidden.push(c);
    updateMapThematic(hidden);
    setCurrHiddenThematic([...hidden]);
  };

  const unhideThematic = (c) => {
    let hidden = [...currHiddenThematic].filter(x => !(x == c));
    updateMapThematic(hidden);
    setCurrHiddenThematic([...hidden]);
  };

  const hideAll = (e) => {
    e.stopPropagation();
    updateMapThematic([...Object.keys(colorMap)]);
    setCurrHiddenThematic([...Object.keys(colorMap)]);
  }

  const unhideAll = (e) => {
    e.stopPropagation();
    updateMapThematic([]);
    setCurrHiddenThematic([]);
  }

  useEffect(() => {

  }, [])

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
        {(intranetLayers ? intranetLayers : []).map((l, i) => (
          <Panel header={nameMap[l]} key={i}>
            <List
              size='small'
              itemLayout='horizontal'
              dataSource={(l in legend ? legend[l] : []).map(d => {
                return { title: d[0], img: d[1], desc: d[2] }
              })}
              renderItem={item => (
                <List.Item extra={<Button type='text' shape='circle' icon={<EyeOutlined />} />}>
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