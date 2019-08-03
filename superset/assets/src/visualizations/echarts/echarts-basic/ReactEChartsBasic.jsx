import ReactJson from 'react-json-view'
import ReactEcharts from 'echarts-for-react';
import { Tabs, Tab } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import React from "react";
import { isNumber, isObject } from 'util';
import ErrorBoundary from '../../../components/ErrorBoundary';
import { formatNumber } from '@superset-ui/number-format';


class OptionsData{
  constructor(dimensions,metrics,data){
    this._dimensions = dimensions;
    this._metrics = metrics;
    this._data = data;
  }
  values(id, collection){
    id = isNumber(id) ? collection[id]: id;
    return this._data ? this._data.records.map(r => r[id]):[];
  }
  dimension(id){
    return this.values(id, this._dimensions)
              .filter((v,ix,arr) => arr.indexOf(v) === ix);
  }
  metric(id){
    return this.values(id, this._metrics);
  }
  stack(id, tpl){
    id = isNumber(id) ? this._metrics[id]: id;
    let stack = this._dimensions.slice(1);
    let data = this._data ? this._data.records:[];
    let dimensions = this.dimension(1);
    let stackValues = dimensions.reduce((acc,v) =>{
      acc[v] = data.filter(r => r[stack] === v).map(r => r[id]);
      return acc;
    }, {});
    return dimensions.map(k => 
      Object.assign({
        name: k,
        type: 'line',
        stack: stack,
        data: stackValues[k]
      }, tpl));
  }
  dimensions(){
    return this._dimensions
          .map(d => [d, this.values(d, this._dimensions)]);
  }
  metrics(){
    return this._metrics
          .map(d => [d, this.values(d, this._metrics)]);
  }
}

class EChartsBasic extends React.PureComponent {
  constructor(props){
    super(props);
    console.log(props)
    this.echart = null;
    this.state ={
      echartsOptions: props.formData.echartsOptions,
      options: this.getOption(props.formData.echartsOptions),
      editMode: false, //  ¿this.props.explor ???
      opts: {}
    };
  }
  onChartReady(ec_instance){
    this.echart = ec_instance;
  }
  getData(){
    var dimensions = this.props.formData.groupby;
    var metrics = this.props.formData.metrics.map(m => m.label||m);
    var data = this.props.payload.data;
    return new OptionsData(
                dimensions,
                metrics,
                data);
  }
  parseOptions(data){    
      var options = JSON.parse(ecOptions);
      options.xAxis && options.xAxis.filter(x => x.dimension)
                    .map(a => a.data = data.dimension(a.dimension));
      options.yAxis && options.yAxis.filter(x => x.dimension)
                    .map(a => a.data = data.dimension(a.dimension));
      options.series.map(a => a.data = data.metric(a.id));
      return options;
  }
  parseCustomOptionsCode(ecOptions, data){
    return new Function("$data", "t", "n", ecOptions)(data, t, formatNumber);
  }
  parseDefaultOptions(){
    return {
          title:{
            text: "ECharts component",
            subtext: "Edit settings..."
          }
      };
  }
  readEchartOptionsEditor(){
    return this.state.echartsOptions;
  }
  getOption(ecOptions) {
    var data = this.getData();
    //console.log(this.props, this.state, data);
    var options = null;
    try{
      options = this.parseCustomOptionsCode(ecOptions, data);
      if(isObject(options)){
        return options;
      }
    }catch(ex){
      console.error(ex);
    }
    try{
      options = this.parseOptions(ecOptions, data);
      if(isObject(options)){
        return options;
      }
    }catch(ex){
      console.error(ex);
    }
    return this.parseDefaultOptions();
  }
  objectEquals(a,b){
    return JSON.stringify(a).localeCompare(JSON.stringify(b)) === 0;
  }
  opsChanged(prevProps){
    // Check chart options
    var prevOptions = prevProps.formData.echartsOptions || {};
    var newOptions = this.props.formData.echartsOptions || {};
    var prevData = prevProps.payload && prevProps.payload.data.records ?
      prevProps.payload.data.records: [];
    var newData = this.props.payload.data && prevProps.payload.data.records ?
      this.props.payload.data.records: [];
    return !this.objectEquals(prevOptions, newOptions) ||
              !this.objectEquals(prevData, newData);
  }
  componentDidUpdate(prevProps, prevState){
    console.log("ECharts render update");
    if(!this.opsChanged(prevProps))
      return;
      console.log("ECharts render update, ops changed");
    var options = this.getOption(this.props.formData.echartsOptions);
    this.setState({options: options, opts: {}});
  }
  renderEChart(){
    this.react_eachart = (<ReactEcharts 
        notMerge={true}
        option={this.state.options} 
        onChartReady={this.onChartReady.bind(this)}
        onEvents={this.state.options.events}
        />);
    return this.state.error ? <h2>{this.state.error.message}</h2>:
            this.react_eachart;
  }
  onEChartsError(){
    console.log("ECharts error, reseting");
    // opts touch them to force recreate echart instance
    let nstate = {options: {title: { text: "Invalid settings"}}, opts: {error: true}};
    this.setState(nstate);
  }
  renderEditMode(){
    return <Tabs
            id="table-tabs"
            defaultActiveKey={1}>
              <Tab eventKey={1} title={t('EChart')}>
                <ErrorBoundary 
                  onError={this.onEChartsError.bind(this)}
                  showMessage={true}>
                  {this.renderEChart()}
                </ErrorBoundary>
              </Tab>
              <Tab eventKey={2} title={t('Watch')}>
                <ReactJson src={this.state.data} />
              </Tab>
              <Tab eventKey={3} title={t('Options')}>
                <ReactJson src={this.state.options} />
              </Tab>
            </Tabs>;
  }
  render() {
    return this.state.editMode ? this.renderEditMode(): this.renderEChart();
  }
  componentDidCatch(error, info) {
    console.error(error, info);
  }
}

export default EChartsBasic;


