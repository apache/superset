import React, { useEffect, useState } from 'react';
import { Collapse, Divider, List, Avatar, Button, Typography } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';

const { Panel } = Collapse;

function hideButton(check, hide, unhide) {
  return (
    <Button 
      type='text'
      shape='circle'
      size='small'
      icon={
        check ? <EyeInvisibleOutlined /> : <EyeOutlined />
      }
      onClick={(e) => check ? unhide(e) : hide(e)}
    />
  )
}

export default function LegendSub(props) {

  const {
    dividerHeader,
    layers,
    listData,
    type,
    initState,
    allState,
    map
  } = props;

  const [currHidden, setCurrHidden] = useState(initState);

  const updateMapFilter = (layer, layerType, hidden) => {
    return;
  }

  const hide = (i) => {
    if (currHidden[i.layer].includes(i.item)) return;
    let hidden = {...currHidden};
    currHidden[x.layer].push(x.item);
    updateMapFilter(i.layer, type, hidden[i.layer]);
    setCurrHidden({...hidden});
  };

  const unHide = (i) => {
    let hidden = {...currHidden};
    hidden[i.layer] = hidden[i.layer].filter(x => !(x === i.item));
    updateMapFilter(i.layer, type, hidden[i.layer]);
    setCurrHidden({...hidden});
  };

  const hideAll = (e, layer) => {
    e.stopPropagation();
    let hidden = {...currHidden};
    hidden[layer] = [...allState[layer]];
    updateMapFilter(layer, type, hidden[layer]);
    setCurrHidden({...hidden});
  };

  const unhideAll = (e, layer) => {
    e.stopPropagation();
    let hidden = {...currHidden};
    hidden[layer] = [];
    updateMapFilter(layer, type, []);
    setCurrHidden({...hidden});
  }

  return (
    <>
      <Divider orientation='left'>
        {dividerHeader}
      </Divider>
      <Collapse>
        {Object.keys(layers).map((l, i) => (
          <Panel
            header={l.header}
            key={i}
            extra={
              hideButton(
                currHidden[l].length === layers[l].length,
                hideAll,
                unhideAll
              )
            }
          >
            <List 
              size='small'
              itemLayout='horizontal'
              dataSource={listData[l]}
              renderItem={item => (
                <List.Item 
                  extra={
                    hideButton(
                      currHidden.includes(item.title),
                      hide,
                      unHide
                    )
                  }
                >
                  <List.Item.Meta 
                    avatar={item.avatar}
                    title={item.title}
                    description={item.descirption}
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