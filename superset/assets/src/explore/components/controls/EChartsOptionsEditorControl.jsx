/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import ControlHeader from '../ControlHeader';
import TextAreaControl from './TextAreaControl';
import { t } from '@superset-ui/translation';
import { Button, FormGroup, FormControl } from 'react-bootstrap';
import { timeSaturday } from 'd3-time';
import { clearTimeout } from 'timers';

const propTypes = {
  options: PropTypes.string,
  onChange: PropTypes.func,
};

const defaultProps = {
  options: null,
  onChange: () => {},
};

class Axis extends React.Component{
  constructor(props){
    super(props);
    this.state = {
      types: ['', 'category', 'value', 'time', 'log']
    }
  }
  onChangeType(ev){
    let id = ev.target.attributes["data-id"].value;
    this.props.onChange(id, {id, type: ev.target.value});
  }
  onChangeDimension(ev){
    let id = ev.target.attributes["data-id"].value;
    this.props.onChange(id, {id, dimension: ev.target.value});
  }
  toOptions(collection){
    return collection.map(t => (<option>{t}</option>));
  }
  render(){
    return (<div>
              <h3>{this.props.title}</h3>
              {this.props.axis.map(m =>{
                return (<div><span>{m.id}</span>&nbsp;
                            <select key={m.id} 
                                    data-id={m.id}
                                    onChange={this.onChangeType.bind(this)}
                                    value={m.type}>
                                    {this.toOptions(this.state.types)}
                            </select>
                            <select
                                    key={m.id+"_m"} 
                                    data-id={m.id}
                                    onChange={this.onChangeDimension.bind(this)}
                                    value={m.dimension}>
                                    {this.toOptions([''].concat(this.props.dimensions.map(d => d.id)))}
                            </select>
                        </div>); 
              })}
            </div>);
  }
}

class Series extends React.Component{
  constructor(props){
    super(props);
    this.types = ['line', 'bar', 'pie'].map(t => (<option>{t}</option>));
  }
  onChangeType(ev){
    let id = ev.target.attributes["data-id"].value;
    this.props.onChange(id, {id, type: ev.target.value});
  }
  render(){
    return (<div>
              <h3>Series</h3>
              {this.props.series.map(m =>{
                return (<div><span>{m.id}</span>&nbsp;
                            <select key={m.id} 
                                    data-id={m.id}
                                    onChange={this.onChangeType.bind(this)}
                                    value={m.type}>
                                    {this.types}
                          </select>
                        </div>); 
              })}
            </div>);
  }
}



export default class EChartsOptionsEditorControl extends React.Component {
  constructor(props){
    super(props);
    var options = JSON.stringify({}, null, 2);
    this.state = {
      title: "Demo echart",
      options: options,
      xaxis: [{id: "Bottom", type: "category"}, {id: "Top", type: ''}],
      yaxis: [{id: "Left", type: "category"}, {id: "Right", type: ''}],
      dimensions: this.getDimensions(),
      series: this.getSeries(),
      simpleMode: false,
      options_advanced: options
    };
    this.lastEditorChangeTimeout = null;
  }
  onChange(){
    this.props.onChange(this.state.options);
  }
  selectTemplate(e){
    console.log("selectTemplate", e.target.value);
    this.buildOptions(TEMPLATES[e.target.value]);
  }
  renderTemplateSelector(){
    return (<select key="tselect" onChange={this.selectTemplate.bind(this)}>
      {Object.keys(TEMPLATES).map(k => (<option key={k}>{k}</option>))}
    </select>)
  }
  getDimensions(){
    let collection = this.state ? this.state.dimensions:[];
    return this.props.controls.groupby.value.map(m => {
      return this.finInCollectionById(m, collection) || 
        {id: m, name: m, type: 'category'};
    });
  }
  getSeries(){
    let collection = this.state ? this.state.series:[];
    return this.props.controls.metrics.value.map(m => m.label||m)
              .map(m => {
                return this.finInCollectionById(m, collection) || 
                  {id: m, name: m, type: 'line'};
              });
  }
  onXAxisChange(id, axis){
    let newAxis = this.state.xaxis.map(d => d.id === id ? axis: d);
    this.setState({xaxis: newAxis});
  }
  onYAxisChange(id, axis){
    let newAxis = this.state.yaxis.map(d => d.id === id ? axis: d);
    this.setState({yaxis: newAxis});
  }
  onSeriesChange(id, serie){
    let newSeries = this.state.series.map(d => d.id === id ? serie: d);
    this.setState({series: newSeries});
  }
  finInCollectionById(id, col){
    return (col||[]).filter(c => c.id === id)[0];
  }
  areEqualObjects(opsa, opsb){
    return JSON.stringify(opsa).localeCompare(JSON.stringify(opsb)) === 0;
  }
  syncControls(){
    return new Promise(function(y,n){
      var sync = {};
      if(!this.areEqualObjects(this.getSeries(), this.state.series)){
        sync.series = this.getSeries()
      }
      if(!this.areEqualObjects(this.getDimensions(), this.state.dimensions)){
        sync.dimensions = this.getDimensions();
      }
      if(Object.keys(sync).length){
        this.setState(sync, y);
      }else{
        y();
      }
    }.bind(this));
  }
  buildOptions(ops){
    this.syncControls()
      .then(function(){
        let orgOps = JSON.parse(this.state.options); // Different instances
        ops = ops || JSON.parse(this.state.options);
        ops.yAxis = this.state.yaxis.filter(x => x.type || x.dimension);
        if(!ops.xAxis.length){
          delete ops.xAxis;
        }
        ops.xAxis = this.state.xaxis.filter(x => x.type || x.dimension);
        if(!ops.yAxis.length){
          delete ops.yAxis;
        }
        ops.series = this.state.series;
        if(!this.areEqualObjects(ops, orgOps)){
          ops = JSON.stringify(ops, null, 2);
          var newState = {options: ops};
          if(this.state.simpleMode){
            newState.options_advanced = ops;
          }
          this.setState(newState, this.onChange.bind(this));
        }
      }.bind(this));
  }
  onEditorChange(options_advanced){
    clearTimeout(this.this.lastEditorChangeTimeout);
    this.lastEditorChangeTimeout = setTimeout(function(){
      var newState = {options: options_advanced};
      this.setState(newState, this.onChange.bind(this));
      this.props.onChange(options_advanced);
    }.bind(this), 1000);
  }
  renderWizard(){
    return [ (<Axis title={t("X Axis")}
                  axis={this.state.xaxis}
                  dimensions={this.state.dimensions}
                  onChange={this.onXAxisChange.bind(this)}/>),
              (<Axis title={t("Y Axis")}
                  axis={this.state.yaxis}
                  dimensions={this.state.dimensions}
                  onChange={this.onYAxisChange.bind(this)}/>),
              (<Series series={this.state.series}
              onChange={this.onSeriesChange.bind(this)}/>)];
  }
  renderAdvanced(){
    return [(<h3>Advanced Editor</h3>),
            (<TextAreaControl 
              onChange={this.onEditorChange.bind(this)} 
              language="json" 
              value={this.state.options_advanced} 
              height={600} />)];
  }
  wizardChange(ev){
    this.setState({simpleMode: ev.target.checked});
  }
  render() {
    //console.log(this.props, this.state);
    this.state.simpleMode && 
      setTimeout(() => this.buildOptions(), 0); // Need better way to catch form changes
    return (
      <FormGroup controlId="echartsOptionsId">
        <h4><input type="checkbox"
              checked={this.state.simpleMode}
              onChange={this.wizardChange.bind(this)}/> Use Wizard
        </h4>
        {this.state.simpleMode ? this.renderWizard(): this.renderAdvanced()}
      </FormGroup>
    );
  }
}
EChartsOptionsEditorControl.propTypes = propTypes;
EChartsOptionsEditorControl.defaultProps = defaultProps;
