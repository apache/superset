// @flow
// Copyright (c) 2015 Uber Technologies, Inc.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
import React, {PureComponent, cloneElement} from 'react';
import PropTypes from 'prop-types';
import MapContext from './map-context';
import assert from '../utils/assert';

import type {MapContextProps} from './map-context';

const propTypes = {
  type: PropTypes.string.isRequired,
  id: PropTypes.string
};

type SourceProps = {
  id?: string,
  type: string,
  children?: any
};

let sourceCounter = 0;

export default class Source<Props: SourceProps> extends PureComponent<Props> {
  static propTypes = propTypes;

  constructor(props: Props) {
    super(props);
    this.id = props.id || `jsx-source-${sourceCounter++}`;
    this.type = props.type;
  }

  componentWillUnmount() {
    this._map.removeSource(this.id);
  }

  id: string;
  type: string;
  _map: any = null;
  _sourceOptions: any = {};

  getSource() {
    return this._map.getSource(this.id);
  }

  _createSource() {
    const map = this._map;
    if (map.style._loaded) {
      map.addSource(this.id, this._sourceOptions);
    } else {
      map.once('styledata', () => this.forceUpdate());
    }
  }

  /* eslint-disable complexity */
  _updateSource() {
    const {_sourceOptions: sourceOptions, props} = this;
    assert(!props.id || props.id === this.id, 'source id changed');
    assert(props.type === this.type, 'source type changed');

    let changedKey = null;
    let changedKeyCount = 0;

    for (const key in props) {
      if (key !== 'children' && key !== 'id' && sourceOptions[key] !== props[key]) {
        sourceOptions[key] = props[key];
        changedKey = key;
        changedKeyCount++;
      }
    }

    const {type, _map: map} = this;
    const source = this.getSource();
    if (!source) {
      this._createSource();
      return;
    }
    if (!changedKeyCount) {
      return;
    }
    if (type === 'geojson') {
      source.setData(sourceOptions.data);
    } else if (type === 'image') {
      source.updateImage({url: sourceOptions.url, coordinates: sourceOptions.coordinates});
    } else if (
      (type === 'canvas' || type === 'video') &&
      changedKeyCount === 1 &&
      changedKey === 'coordinates'
    ) {
      source.setCoordinates(sourceOptions.coordinates);
    } else {
      map.removeSource(this.id);
      map.addSource(sourceOptions);
    }
  }
  /* eslint-enable complexity */

  _render(context: MapContextProps) {
    this._map = context.map;
    this._updateSource();
    return React.Children.map(this.props.children, child =>
      cloneElement(child, {
        source: this.id
      })
    );
  }

  render() {
    return <MapContext.Consumer>{this._render.bind(this)}</MapContext.Consumer>;
  }
}
