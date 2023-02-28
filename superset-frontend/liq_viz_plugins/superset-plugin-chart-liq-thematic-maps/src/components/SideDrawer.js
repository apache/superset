import React, { useEffect, useState } from 'react';
import { Drawer } from 'antd';

export default function SideDrawer(props) {

    const { 
        drawerTitle,
        drawerContent,
        open,
        setDrawerOpen
    } = props;

    return (
        <Drawer 
            title={drawerTitle}
            placement='right' 
            onClose={() => setDrawerOpen(false)} 
            visible={open}
            getContainer={false}
            style={{position: 'absolute'}}
            mask={false}
            width={512}
        >
            {drawerContent}
        </Drawer>
    );
}