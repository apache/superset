import React, { useEffect, useState } from 'react';
import { Form, InputNumber, Button, Typography, Slider } from 'antd';
import { HexColorPicker } from 'react-colorful';

const geoFunctions = require('../utils/geoFunctions.js');
const getRadius = geoFunctions.createGeoJSONRadius;

export default function Radius(props) {

  const {
    map
  } = props;

  const [distance, setDistance] = useState(5);
  const [message, setMessage] = useState('');
  const [color, setColor] = useState('#0000FF');
  const [opacity, setOpacity] = useState(0.5);

  const removeRadius = () => {
    if ('radius' in map.current.getStyle().sources) {
      map.current.removeLayer('radius');
      map.current.removeSource('radius');
    }
  }

  const drawRadius = (e) => {
    map.current.addSource('radius', {
      'type': 'geojson',
      'data': getRadius([e.lngLat.lng, e.lngLat.lat], distance, 256)
    });
    map.current.addLayer({
      'id': 'radius',
      'type': 'fill',
      'source': 'radius',
      'layout': {},
      'paint': {
        'fill-color': color,
        'fill-opacity': opacity
      }
    });
    map.current.off('click', drawRadius);
    setMessage('');
  }

  const onSettingsSave = () => {
    removeRadius();
    map.current.on('click', drawRadius);
    setMessage('Click anywhere on the map');
  }

  useEffect(() => {
    if ('radius' in map.current.getStyle().sources) {
      map.current.setPaintProperty('radius', 'fill-color', color);
    }
  }, [color])

  useEffect(() => {
    if ('radius' in map.current.getStyle().sources) {
      map.current.setPaintProperty('radius', 'fill-opacity', opacity);
    }
  }, [opacity])

  return (
    <Form layout='vertical'>
      <Form.Item label='Distance (km)'>
        <InputNumber min={0} max={50} defaultValue={5} onChange={v => setDistance(v)}/>
      </Form.Item>
      <Form.Item label='Colour'>
        <HexColorPicker color={color} onChange={setColor} />
      </Form.Item>
      <Form.Item label='Opacity'>
        <Slider 
          min={0.0}
          max={1.0}
          step={0.1}
          onChange={v => setOpacity(v)}
          value={opacity}
        />
      </Form.Item>
      <Form.Item>
          <Button type='primary' htmlType='submit' onClick={onSettingsSave}>
            OK
          </Button>
          {'     '}
          <Button type='danger' onClick={removeRadius}>
            Clear
          </Button>
      </Form.Item>
      <Form.Item>
        <Typography>{message}</Typography>
      </Form.Item>
    </Form>
  );
}