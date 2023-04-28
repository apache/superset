import React, { useEffect, useState } from 'react';
import { Collapse, Divider, List, Avatar, Button, Typography } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';

import { useAppStore } from '../store/appStore';

const { Panel } = Collapse;

function hideButton(check, hide, unhide, arg) {
  return (
    <Button 
      type='text'
      shape='circle'
      size='small'
      icon={
        check ? <EyeInvisibleOutlined /> : <EyeOutlined />
      }
      onClick={(e) => check ? unhide(e, arg) : hide(e, arg)}
    />
  )
}

export default function LegendSub(props) {

  const {
    config,
    map,
    index,
  } = props;

  const currHidden = useAppStore(state => state.legendHidden[index]);
  const updateLegendHiddenIndex = useAppStore(state => state.updateLegendHiddenIndex);

  const updateMapFilter = (layer, hidden) => {
    if (!map) return;
    if (hidden.length === 0) {
      map.setFilter(layer, null);
      if ('textLayerFilterExpr' in config) map.setFilter(`${layer}_sector_labels`, ['==', ['get', 'centre'], layer]);
      if (config.outline) map.setFilter(`${layer}_outline`, null);
    } else {
      let filterExpr = ['all'];
      let textFilterExpr = ['all'];
      for (const k of hidden) {
        filterExpr.push(config.filterExpr(layer, k));
        if ('textLayerFilterExpr' in config) textFilterExpr.push(config.textLayerFilterExpr(layer, k));
      }
      map.setFilter(layer, filterExpr);
      if ('textLayerFilterExpr' in config) map.setFilter(`${layer}_sector_labels`, textFilterExpr);
      if (config.outline) map.setFilter(`${layer}_outline`, filterExpr);
    }
  }

  const hide = (e, i) => {
    if (currHidden[i.layer].includes(i.item)) return;
    let hidden = {...currHidden};
    currHidden[i.layer].push(i.item);
    updateMapFilter(i.layer, hidden[i.layer]);
    updateLegendHiddenIndex(index, {...hidden});
  };

  const unHide = (e, i) => {
    let hidden = {...currHidden};
    hidden[i.layer] = hidden[i.layer].filter(x => !(x === i.item));
    updateMapFilter(i.layer, hidden[i.layer]);
    updateLegendHiddenIndex(index, {...hidden});
  };

  const hideAll = (e, layer) => {
    e.stopPropagation();
    let hidden = {...currHidden};
    hidden[layer] = [...config.layers[layer]];
    updateMapFilter(layer, hidden[layer]);
    updateLegendHiddenIndex(index, {...hidden});
  };

  const unhideAll = (e, layer) => {
    e.stopPropagation();
    let hidden = {...currHidden};
    hidden[layer] = [];
    updateMapFilter(layer, []);
    updateLegendHiddenIndex(index, {...hidden});
  }

  return (
    <>
      <Divider orientation='left'>
        {config.header}
      </Divider>
      <Collapse>
        {Object.keys(config.layers).map((l, i) => (
          <Panel
            header={config.panelHeaders[i]}
            key={i}
            extra={
              hideButton(
                (l in currHidden) && currHidden[l].length === config.layers[l].length,
                hideAll,
                unhideAll,
                l
              )
            }
          >
            <List 
              size='small'
              itemLayout='horizontal'
              dataSource={config.listData[l]}
              renderItem={item => (
                <List.Item 
                  extra={
                    hideButton(
                      (l in currHidden) && currHidden[l].includes(item.hide),
                      hide,
                      unHide,
                      { layer: l, item: item.hide }
                    )
                  }
                  style={{ fontSize: 12 }}
                >
                  <List.Item.Meta 
                    avatar={item.avatar}
                    title={item.title}
                    description={item.desc}
                  />
                </List.Item>
              )}
            />
          </Panel>
        ))}
      </Collapse>
    </>
  )
}