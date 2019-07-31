import ReactJson from 'react-json-view'
import ReactEcharts from 'echarts-for-react';
import { Tabs, Tab } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import React from "react";
import { isNumber, isObject } from 'util';
import ErrorBoundary from '../../../components/ErrorBoundary';

class OptionsData{
  constructor(dimensions,metrics,data){
    this._dimensions = dimensions;
    this._metrics = data ? 
            data.columns.filter(c => dimensions.indexOf(c) === -1)
            :[];
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
      editMode: true, //  ¿this.props.explor ???
      opts: {}
    };
  }
  onChartReady(ec_instance){
    this.echart = ec_instance;
  }
  getData(){
    var dimensions = this.props.formData.groupby;
    var metrics = this.props.formData.metrics;
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
    return new Function("$data", ecOptions)(data);
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
  opsChanged(prevProps){
    if(prevProps.formData.echartsOptions){
      return prevProps.formData.echartsOptions
            .localeCompare(this.props.formData.echartsOptions) !== 0;
    }
    return !!this.props.formData.echartsOptions;
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


