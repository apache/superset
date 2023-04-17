import React, { useEffect, useState } from 'react';
import { Form, InputNumber, Button, Typography } from 'antd';
import { refreshChart } from '../utils/overrides/chartActionOverride';
import { useDispatch } from 'react-redux';
import { SupersetClient } from '@superset-ui/core';

const liqSecrets = require('../../../liq_secrets.js').liqSecrets;

const geoFunctions = require('../utils/geoFunctions.js');
const getRadius = geoFunctions.createGeoJSONRadius;

const otherUtils = require('../utils/others.js');
const uuid = otherUtils.uuidv4;

export default function Radius(props) {

  const {
    boundary,
    groupCol,
    radiusColor,
    radiusThreshold,
    radiusLinkedCharts,
    map
  } = props;

  const [distance, setDistance] = useState(5);
  const [message, setMessage] = useState('');
  const [id, setId] = useState(uuid());

  const dispatch = useDispatch();

  const refreshLinkedCharts = () => {
    const split = window.location.href.split('/');
    if (split[4] === 'dashboard') {
      const dashboardId = parseInt(split[5]);
      radiusLinkedCharts.forEach(chartKey =>
        dispatch(refreshChart(chartKey, true, dashboardId)),
      );
    }
  }

  // Remove radius geojson source and layer and delete radius key url param
  const removeRadius = () => {
    if ('radius' in map.current.getStyle().sources) {
      map.current.removeLayer('radius');
      map.current.removeLayer('radius_sa1s');
      map.current.removeSource('radius');
      const url = new URL(window.location.href);
      url.searchParams.delete('radius_key');
      window.history.replaceState(null, null, url);
      refreshLinkedCharts();
    }
  }

  // Add radius geojson source and layer and update radius key url param
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
    const url = new URL(window.location.href);
    url.searchParams.set('radius_key', id);
    window.history.pushState(null, null, url);
  }

  const onSettingsSave = () => {
    removeRadius();
    map.current.on('click', drawRadius);
    setMessage('Click anywhere on the map');    
  }

  // Post constituent SA1s and radius key to internal api
  const postRkeySA1s = (sa1s) => {
    SupersetClient.post({
      endpoint: 'api/v1/liq/set_radius',
      jsonPayload: {
        'radius_key': id,
        'sa1s': sa1s
      }
    }).then(() => refreshLinkedCharts());
  }

  // Query lambda function to get constituent SA1s of radius and update map style to reflect
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
        const boundaries = ['SA1_CODE21', 'SA2_CODE21', 'SA3_CODE21', 'SA4_CODE21', 'DZN_CODE21']
        const paint = [
          'case',
          ['in', ['get', boundaries.includes(groupCol) ? groupCol : 'SA1_CODE21'], ['literal', result.sa1s]],
          '#FFFFFF',
          'transparent'
        ]
        map.current.setPaintProperty('radius_sa1s', 'line-color', paint);
        postRkeySA1s(result.sa1s);
      })
  }

  // Hook for styling radius color in real time
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
          <Button type='dashed' onClick={removeRadius}>
            Clear
          </Button>
      </Form.Item>
      <Form.Item>
        <Typography>{message}</Typography>
      </Form.Item>
    </Form>
  );
}