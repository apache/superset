import React, { useState } from 'react';
import { Button, Radio, Form, InputNumber, Typography } from 'antd';

export default function Drivetime(props) {
  
  const [travelMode, setTravelMode] = useState('drive');
  const [travelMetric, setTravelMetric] = useState('distance');
  const [message, setMessage] = useState('');
  
  return (
    <Form layout='vertical'>
      <Form.Item label='Travel mode'>
        <Radio.Group 
          value={travelMode} 
          onChange={(e) => setTravelMode(e.target.value)}
          buttonStyle='solid'
          size='medium'
      >
          <Radio.Button value='drive'>Drive</Radio.Button>
          <Radio.Button value='cycle'>Cycle</Radio.Button>
          <Radio.Button value='walk'>Walk</Radio.Button>
        </Radio.Group>
      </Form.Item>
      <Form.Item label='Travel metric'>
        <Radio.Group
          value={travelMetric}
          onChange={(e) => setTravelMetric(e.target.value)}
          buttonStyle='solid'
          size='medium'
        >
          <Radio.Button value='distance'>Distance</Radio.Button>
          <Radio.Button value='time'>Time</Radio.Button>
        </Radio.Group>
      </Form.Item>
      <Form.Item>
        <InputNumber addonAfter={travelMetric === 'distance' ? 'km' : 'min'}/>
      </Form.Item>
      <Form.Item>
          <Button type='primary' htmlType='submit' onClick={() => {}}>
            OK
          </Button>
          {'     '}
          <Button type='dashed' onClick={() => {}}>
            Clear
          </Button>
      </Form.Item>
      <Form.Item>
        <Typography>{message}</Typography>
      </Form.Item>
    </Form>
  );
}