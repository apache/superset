import React, { useEffect, useState } from 'react';
import { Form, InputNumber, Button, Typography } from 'antd';

const liqSecrets = require('../../../liq_secrets.js').liqSecrets;

const geoFunctions = require('../utils/geoFunctions.js');
const getRadius = geoFunctions.createGeoJSONRadius;

export default function Radius(props) {

  const {
    boundary,
    groupCol,
    radiusColor,
    radiusThreshold,
    map
  } = props;

  const [distance, setDistance] = useState(5);
  const [message, setMessage] = useState('');

  const removeRadius = () => {
    if ('radius' in map.current.getStyle().sources) {
      map.current.removeLayer('radius');
      map.current.removeLayer('radius_sa1s');
      map.current.removeSource('radius');
    }
  }

  const drawRadius = (e) => {
    const radius = getRadius([e.lngLat.lng, e.lngLat.lat], distance, 256);
    map.current.addSource('radius', {
      'type': 'geojson',
      'data': radius
    });
    map.current.addLayer({
      'id': 'radius',
      'type': 'fill',
      'source': 'radius',
      'layout': {},
      'paint': {
        'fill-color': radiusColor,
      }
    });
    map.current.addLayer({
      'id': 'radius_sa1s',
      'type': 'line',
      'source': 'boundary_tileset',
      'source-layer': boundary,
      'paint': {
        'line-color': 'transparent',
      }
    });
    map.current.off('click', drawRadius);
    setMessage('');
    addSA1s(radius);
  }

  const onSettingsSave = () => {
    removeRadius();
    map.current.on('click', drawRadius);
    setMessage('Click anywhere on the map');    
  }

  const addSA1s = (radius) => {
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');

    var raw = {
      'secret': liqSecrets.lambdaFunctions.intersection.secret,
      'GeoJSON': radius,
      'threshold': radiusThreshold
    }

    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify(raw),
      redirect: 'follow'
    }

    fetch(liqSecrets.lambdaFunctions.intersection.url, requestOptions)
      .then(response => response.json())
      .then(result => {
        const paint = [
          'case',
          ['in', ['get', groupCol], ['literal', result.sa1s]],
          '#FFFFFF',
          'transparent'
        ]
        map.current.setPaintProperty('radius_sa1s', 'line-color', paint);
      })
  }

  useEffect(() => {
    if ('radius' in map.current.getStyle().sources) {
      map.current.setPaintProperty('radius', 'fill-color', radiusColor);
    }
  }, [radiusColor])

  return (
    <Form layout='vertical'>
      <Form.Item label='Distance (km)'>
        <InputNumber min={0} max={50} defaultValue={5} onChange={v => setDistance(v)}/>
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