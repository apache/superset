import React, { useEffect, useState } from 'react';
import { Form, InputNumber, Button, Typography } from 'antd';

const geoFunctions = require('../utils/geoFunctions.js');
const getRadius = geoFunctions.createGeoJSONRadius;

export default function Radius(props) {

  const {
    map
  } = props;

  const [distance, setDistance] = useState(5);
  const [message, setMessage] = useState('');

  const drawRadius = (e) => {
    map.current.addSource('radius', {
      'type': 'geojson',
      'data': getRadius([e.lngLat.lng, e.lngLat.lat], distance)
    });
    map.current.addLayer({
      'id': 'radius',
      'type': 'fill',
      'source': 'radius',
      'layout': {},
      'paint': {
        'fill-color': 'blue',
        'fill-opacity': 0.5
      }
    });
    map.current.off('click', drawRadius);
    setMessage('');
  }

  const onSettingsSave = () => {
    if ('radius' in map.current.getStyle().sources) {
      map.current.removeLayer('radius');
      map.current.removeSource('radius');
    }
    map.current.on('click', drawRadius);
    setMessage('Click anywhere on the map');
  }

  return (
    <Form layout='vertical'>
      <Form.Item label='Distance (km)'>
        <InputNumber min={0} max={50} defaultValue={5} onChange={v => setDistance(v)}/>
      </Form.Item>
      <Form.Item>
        <Button type='primary' htmlType='submit' onClick={onSettingsSave}>
          OK
        </Button>
      </Form.Item>
      <Form.Item>
        <Typography>{message}</Typography>
      </Form.Item>
    </Form>
  );
}