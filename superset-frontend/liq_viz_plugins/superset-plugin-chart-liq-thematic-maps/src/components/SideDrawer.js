import React, { useEffect, useState } from 'react';
import { Drawer } from 'antd';

export default function SideDrawer(props) {

  const {
    drawerTitle,
    drawerContent,
    open,
    setDrawerOpen,
    width
  } = props;

  // Width of side panel to be a quarter of the width of plugin
  const [dWidth, setDWidth] = useState(Math.round(width / 4));

  useEffect(() => {
    setDWidth(Math.round(width / 4));
  }, [width])

  return (
    <Drawer
      title={drawerTitle}
      placement='right'
      onClose={() => setDrawerOpen(false)}
      open={open}
      getContainer={false}
      rootStyle={{ position: 'absolute' }}
      mask={false}
      width={dWidth}
    >
      {drawerContent}
    </Drawer>
  );
}