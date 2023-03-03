import React, { useEffect, useState } from 'react';
import { Collapse, Divider, List, Avatar, Button, Typography } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';

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
    map
  } = props;

  const [currHidden, setCurrHidden] = useState(config.init);

  const updateMapFilter = (layer, hidden) => {
    if (!map.current) return;
    if (hidden.length === 0) {
      map.current.setFilter(layer, null);
    } else {
      let filterExpr = ['all'];
      for (const k of hidden) filterExpr.push(
        config.filterExpr(layer, k)
      );
      map.current.setFilter(layer, filterExpr);
    }
  }

  const hide = (e, i) => {
    if (currHidden[i.layer].includes(i.item)) return;
    let hidden = {...currHidden};
    currHidden[i.layer].push(i.item);
    updateMapFilter(i.layer, hidden[i.layer]);
    setCurrHidden({...hidden});
  };

  const unHide = (e, i) => {
    let hidden = {...currHidden};
    hidden[i.layer] = hidden[i.layer].filter(x => !(x === i.item));
    updateMapFilter(i.layer, hidden[i.layer]);
    setCurrHidden({...hidden});
  };

  const hideAll = (e, layer) => {
    e.stopPropagation();
    let hidden = {...currHidden};
    hidden[layer] = [...config.layers[layer]];
    updateMapFilter(layer, hidden[layer]);
    setCurrHidden({...hidden});
  };

  const unhideAll = (e, layer) => {
    e.stopPropagation();
    let hidden = {...currHidden};
    hidden[layer] = [];
    updateMapFilter(layer, []);
    setCurrHidden({...hidden});
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