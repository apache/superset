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

  const [dWidth, setDWidth] = useState(Math.round(width / 3));

  useEffect(() => {
    setDWidth(Math.round(width / 3));
  }, [width])

  return (
    <Drawer
      title={drawerTitle}
      placement='right'
      onClose={() => setDrawerOpen(false)}
      visible={open}
      getContainer={false}
      style={{ position: 'absolute' }}
      mask={false}
      width={dWidth}
    >
      {drawerContent}
    </Drawer>
  );
}