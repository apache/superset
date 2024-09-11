import React, { useState } from 'react';
import { Button, Modal, Collapse, Divider, Flex, Input, Switch, Card, Col, Row, Space } from 'antd-v5';
import type { CollapseProps } from 'antd-v5';
import { CaretRightOutlined } from '@ant-design/icons';


export interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose  }) => {
  console.log("Settings isOpen", isOpen)

  const cardList = (
    <div>
       <p>2: Schemas</p>
    <p>10 Tables</p>
    <p>1000: Columns Total</p>
    </div>
   
  );
  const textInput1 = (
    <Flex vertical gap={12} style={{ paddingInlineStart: 10 }}>
      <p>Tell the assistant what type of data your data sources contain</p>
      <Input />
      <Input variant="borderless" />
    </Flex>
  );
  const textbelowInput2 = (
    <Flex vertical gap={12} style={{ paddingInlineStart: 10 }}>
      <p>What type lf analytics do you want to visualize</p>
      <Input />
      <Input variant="borderless" />
    </Flex>
  );



  const onSwitchChange = (checked: boolean) => {
    console.log(`switch to ${checked}`);
  };

  const feedbackSwitch = (
    <div>
      <Divider />
      <Flex style={{ paddingInlineStart: 10, marginBottom: 15, marginTop: 15 }}>

        <Switch style={{ paddingInline: 10 }} defaultChecked onChange={onSwitchChange} checked={false} />
        <p style={{ marginLeft: 10, fontSize: 18 }}>Enable Developer Logs Collection</p>
      </Flex>
    </div>


  );
  const feedbackSwitch2 = (
    <div>
      <Flex style={{ paddingInlineStart: 10, marginTop: 10, }}>
        <Switch style={{ paddingInline: 10 }} defaultChecked onChange={onSwitchChange} />
        <p style={{ marginLeft: 10, fontSize: 18 }}>Allow Usage Log Collection</p>
      </Flex>
    </div>
  );

  const contextCard = (

    <Row gutter={16} style={{marginBottom:10}}>
    <Col span={6}>
      <Card title="DataSource 1" bordered={false} style={{background:'#67EBE3'}}>
        {cardList}
      </Card>
    </Col>
    <Col span={6}>
      <Card title="Datasource 2" bordered={false} style={{background:'#67EBBB'}}>
      {cardList}
      </Card>
    </Col>
    <Col span={6}>
      <Card title="Datasource 3" bordered={false} style={{background:'#89EB67'}}>
      {cardList}
      </Card>
    </Col>
    <Col span={6}>
      <Card title="Unselected" bordered={false} style={{background:'#EBDE67'}}>
      {cardList}
      </Card>
    </Col>
  </Row>
  );


  const text1 = (
    <h2 style={{ paddingInlineStart: 10, fontWeight: 'bold', fontSize: 20 }}>Assistant Instructions</h2>

  );
  const text2 = (
    <h2 style={{ paddingInlineStart: 10, fontWeight: 'bold', fontSize: 20 }}>Context Settings</h2>

  );
  const text3 = (
    <h2 style={{ paddingInlineStart: 10, fontWeight: 'bold', fontSize: 20 }}>Feedback and Analytics</h2>

  );
  const subtext2 = (
    <p style={{ marginTop: 5, paddingInlineStart: 10, fontSize: 18 }}>Control how the assistant interprates your data</p>

  );
  const subtext3 = (
    <div>
      <p style={{ marginTop: 5, paddingInlineStart: 10, fontSize: 18 }}>Select what datasources the assistant has access to</p>
    </div>

  );
  const subtext4 = (
    <div>
      <p style={{ marginTop: 5, paddingInlineStart: 10, fontSize: 18 }}>Tell us how we can improve this feature</p>
    </div>

  );



  const items: CollapseProps['items'] = [
    {
      key: '1',
      label: <div>{text1}{subtext2}</div>,
      children: <div>{textInput1}{textbelowInput2}</div>,

    },
    {
      key: '2',
      label: <div>{text2}{subtext3}</div>,
      children: <div><Divider/>{contextCard}</div>,
    },
    {
      key: '3',
      label: <div>{text3}{subtext4}</div>,
      children: <div>
        {feedbackSwitch}
        {feedbackSwitch2} 
      <Flex gap="large" wrap style={{paddingTop:40, marginTop:65}}>
        <Button style={{background:'#FFA7A7',color:'#AF003F',border:'none'}} size='large'>
         Report a Bug
        </Button>
        <Button style={{background:'#F0F0F0',color:'#727272',border:'none'}} size='large'>
         Privacy Policy
        </Button>
      </Flex></div>,
    },

  ];
  const onChange = (key: string | string[]) => {
    console.log(key);
  };

  const handleOk = () => {
    
    onClose();
  };

  const handleCancel = () => {
    
    onClose();
  };

  return (
    <>
     <Modal
          title={(
            <h4>
              Assistant Settings
            </h4>
          )}
          centered
          styles={{
            content:{
              background: 'white'
            },
            body:{
              backgroundColor: 'white'
            },
            mask: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)'
            },
            header:{
              background: 'white',
            }
          }}
          open={isOpen}
          onOk={handleOk}
          onCancel={handleCancel}
          width={1000}
          footer={[
            <Button key="back" style={{ border: 'none', background: '#95C9E7', color: '006FAF', paddingInline: 40 }} onClick={handleCancel}>
              Cancel
            </Button>,
            <Button key="submit" style={{ border: 'none', background: '#DEDEDE', color: '#000000', paddingInline: 40 }} onClick={handleOk}>
              Save
            </Button>,
          ]}

        >
            <Collapse style={{ background: '#F6F6F6' }} expandIconPosition={'end'} onChange={onChange} items={items} bordered={false} expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />} defaultActiveKey={['1']} />
        </Modal>
    </>
  );
};

export default Settings;