import React, { useEffect, useState } from 'react';
import { Collapse, Divider, List, Avatar, Button, Icon } from 'antd';
import {
    EyeOutlined,
    EyeInvisibleOutlined
  } from '@ant-design/icons';

const defaults = require('../defaultLayerStyles.js');
const intranetImgs = defaults.intranetImgs;

const { Panel } = Collapse;

export default function Legend(props) {

    const {
        thematicData,
        boundaryData,
        intranetLayers
    } = props;

    const nameMap = {
        'shopping_centres': 'Shopping Centres',
        'department_stores': 'Department Stores',
        'discount_department_stores': 'Discount Department Stores',
        'large_format_retail': 'Large Format Retail',
        'mini_majors': 'Mini Majors',
        'supermarkets': 'Supermarkets',
        'liquor': 'Liquor'
    }

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
    }

    return (
        <>
            <Divider orientation='left'>
                Intranet Layers
            </Divider>
            <Collapse>
                {(intranetLayers ? intranetLayers : []).map((l, i) => (
                    <Panel header={nameMap[l]} key={i}>
                        <List
                            itemLayout='horizontal'
                            dataSource={(l in legend ? legend[l] : []).map(d => {
                                return {title: d[0], img: d[1], desc: d[2]}
                            })}
                            renderItem={item => (
                                <List.Item extra={<Button type='text' shape='circle' icon={<EyeOutlined />}/>}>
                                    <List.Item.Meta 
                                        avatar={<Avatar src={item.img} shape='square' size={24}/>}
                                        title={<p>{item.title}</p>}
                                    />
                                </List.Item>
                            )}
                        />
                    </Panel>
                ))}
            </Collapse>
            <Divider orientation='left'>
                Thematic
            </Divider>
            <Divider orientation='left'>
                Boundary
            </Divider>
        </>
    );
}