import React, { useEffect, useState } from 'react';
import {Avatar } from 'antd';
import LegendSub from './LegendSub.js';

import { useAppStore } from '../store/appStore';
import { icons } from 'antd/lib/image/PreviewGroup.js';

const iconsSVG = require('../iconSVG.js');
const defaults = require('../defaultLayerStyles.js');
const intranetImgs = defaults.intranetImgs;
const intranetLegendExprs = defaults.intranetLegendExprs;

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
    ['Super Regional', iconsSVG.regionalSC, ''],
    ['Regional', iconsSVG.regionalSC, ''],
    ['Sub-regional', iconsSVG.subRegionalSC, ''],
    ['Neighbourhood', iconsSVG.neighbourhoodSC, ''],
    ['City Centre', iconsSVG.cityCentreSC, ''],
    ['Themed', iconsSVG.themedSC, ''],
    ['Large Format Retail', iconsSVG.lfrSC, ''],
    ['Outlet', iconsSVG.outletSC, ''],
    ['Market', iconsSVG.marketSC, ''],
    ['Local', iconsSVG.outletSC, ''],
    ['Transit', iconsSVG.outletSC, '']
  ],
  'department_stores': [
    ['David Jones', iconsSVG.davidJones, ''],
    ['Myer', iconsSVG.myer, ''],
    ['Harris Scarfe', iconsSVG.harrisScarfe, ''],
    ['Unknown DS', iconsSVG.unknownDS, '']
  ],
  'discount_department_stores': [
    ['Kmart', iconsSVG.kmart, ''],
    ['Kmart Hub', iconsSVG.kmartHub, ''],
    ['Target', iconsSVG.target, ''],
    ['Target Country', iconsSVG.targetCountry, ''],
    ['Big W', iconsSVG.bigW, ''],
    ['Unknown DDS', iconsSVG.unknownDDS, '']
  ],
  'large_format_retail': [
    ['Amart', iconsSVG.amart, ''],
    ['Anaconda', iconsSVG.anaconda, ''],
    ['Bunnings', iconsSVG.bunnings, ''],
    ['Domayne', iconsSVG.domayne, ''],
    ['Fantastic Furniture', iconsSVG.fantasticFurniture, ''],
    ['Forty Winks', iconsSVG.fortyWinks, ''],
    ['Harvey Norman Group', iconsSVG.harveyNorman, ''],
    ['Ikea', iconsSVG.ikea, ''],
    ['Lincraft', iconsSVG.lincraft, ''],
    ['Snooze', iconsSVG.snooze, ''],
    ['Spotlight', iconsSVG.spotlight, ''],
    ['The Good Guys', iconsSVG.theGoodGuys, '']
  ],
  'mini_majors': [
    ['Apple Store', iconsSVG.appleStore, ''],
    ['Best & Less', iconsSVG.bestAndLess, ''],
    ['Chemist Warehouse', iconsSVG.chemistWarehouse, ''],
    ['Cotton On', iconsSVG.cottonOn, ''],
    ['Country Road', iconsSVG.countryRoad, ''],
    ['Daiso', iconsSVG.daiso, ''],
    ['Dan Murphy\'s', iconsSVG.danMurphys, ''],
    ['First Choice Liquor', iconsSVG.firstChoiceLiquor, ''],
    ['Glue Store', iconsSVG.glueStore, ''],
    ['H & M', iconsSVG.hAndM, ''],
    ['Harris Farm Markets', iconsSVG.harrisFarmMarkets, ''],
    ['HS Home', iconsSVG.hsHome, ''],
    ['JB Hi-Fi', iconsSVG.jbhifi, ''],
    ['Kathmandu', iconsSVG.kathmandu, ''],
    ['Mecca Cosmetica', iconsSVG.meccaCosmetica, ''],
    ['Priceline Pharmacy', iconsSVG.pricelinePharmacy, ''],
    ['Rebel Sport', iconsSVG.rebelSports, ''],
    ['Rivers', iconsSVG.rivers, ''],
    ['Sephora',iconsSVG.sephora, ''],
    ['Terry White Chemist', iconsSVG.terryWhiteChemmart, ''],
    ['The Reject Shop', iconsSVG.theRejectShop, ''],
    ['TK Maxx', iconsSVG.tkMaxx, ''],
    ['Uniqlo', iconsSVG.uniqlo, ''],
    ['Zara', iconsSVG.zara, '']
  ],
  'supermarkets': [
    ['Woolworths', iconsSVG.woolworths, ''],
    ['Coles', iconsSVG.coles, ''],
    ['Aldi',iconsSVG.aldi, ''],
    ['IGA', iconsSVG.iga, ''],
    ['FoodWorks', iconsSVG.foodWorks, ''],
    ['Costco', iconsSVG.costco, ''],
    ['Drakes', iconsSVG.drakes, ''],
    ['Spar', iconsSVG.spar, ''],
    ['IGA Express', iconsSVG.igaExpress, ''],
    ['Others', iconsSVG.otherSmkt, ''],
    ['Unknown Smkt', iconsSVG.unknownSmkt, '']
  ],
  'liquor': [
    ['Liquorland', iconsSVG.liquorLand, ''],
    ['BWS', iconsSVG.bws, ''],
    ['IGA Liquor', iconsSVG.igaLiquor, ''],
    ['Aldi Liquor', iconsSVG.aldiLiquor, ''],
    ['Vintage Cellars', iconsSVG.vintageCellars, ''],
    ['First Choice Liquor', iconsSVG.firstChoiceLiquor, ''],
    ['Dan Murphys', iconsSVG.danMurphys, ''],
    ['Other Liquor', iconsSVG.otherLiquor, '']
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

  const [configs, setConfigs] = useState([]); // Keep track of which legends to display
  const currHidden = useAppStore(state => state.legendHidden);

  const updateLegendHiddenAll = useAppStore(state => state.updateLegendHiddenAll);

  // Function to instantiate thematic legend config
  const thematicLegendData = (thematicData, thematicCol, colorMap, groupCol) => {
    return {
      header: 'Thematic',
      panelHeaders: [thematicCol],
      init: { 'boundary_tileset': [] },
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
            avatar: <img src={d[1].src} />,
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
      filterExpr: (l, k) => ['!', ['in', ['get', groupCol], ['literal', taSectorSA1Map[l][k]]]],
      textLayer: {
        layer: 'trade_area_sector_centroids',
        filterExpr: (l, k) => [
          '!',
          ['all',
            ['==', ['get', 'label'], k],
            ['==', ['get', 'centre'], l]
          ] 
        ]
      }
    }
  }

  // Hook to update configs
  useEffect(() => {
    let newConfigs = [];
    let newHidden = [];
    if (thematicData) {
      const cfg = thematicLegendData(thematicData, thematicCol, colorMap, groupCol)
      newConfigs.push(cfg);
      newHidden.push(cfg.init);
    }
    if (intranetLayers && intranetLayers.length > 0) {
      const cfg = intranetLegendData(intranetLayers);
      newConfigs.push(cfg);
      newHidden.push(cfg.init);
    } 
    if (tradeAreas && tradeAreas.length > 0) {
      const cfg = treadeAreaLegendData(tradeAreas, taSectorSA1Map, taSectorColorMap, groupCol);
      newConfigs.push(cfg);
      newHidden.push(cfg.init);
    }
    setConfigs([...newConfigs]);

    let nHidden = 0;
    currHidden.map(x => {
      Object.keys(x).map(k => nHidden += x[k].length);
    });
    if (nHidden === 0) updateLegendHiddenAll([...newHidden]);
  }, [thematicData, intranetLayers, tradeAreas])

  return (
    <>
      {configs.map((c, i) => (
        currHidden.length > 0 && 
        <LegendSub 
          config={c} 
          map={map} 
          key={i} 
          index={i} 
        /> 
      ))}
    </>
  )

}