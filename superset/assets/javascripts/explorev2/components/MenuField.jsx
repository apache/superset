import React, { PropTypes } from 'react';
import ControlLabelWithTooltip from './ControlLabelWithTooltip';
import { slugify } from '../../modules/utils';
import Menu, { SubMenu, Item as MenuItem, Divider } from 'rc-menu';
import 'rc-menu/assets/index.css';

require('./Components.css');

const propTypes = {
  name: PropTypes.string.isRequired,
  choices: PropTypes.array,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]).isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
  multi: PropTypes.bool,
  freeForm: PropTypes.bool,
};

const defaultProps = {
  multi: false,
  freeForm: false,
  value: '',
  label: null,
  description: null,
  onChange: () => {},
};

const vizType = [
    { chart: 'area', icon: 'fa fa-area-chart' },
    { chart: 'bar', icon: 'fa fa-bar-chart' },
    { chart: 'big_number', icon: 'fa fa-header' },
    { chart: 'big_number_total', icon: 'fa fa-header' },
    { chart: 'box_plot', icon: 'fa fa-bar-chart' },
    { chart: 'bubble', icon: 'fa fa-bar-chart' },
    { chart: 'bullet', icon: 'fa fa-bar-chart' },
    { chart: 'cal_heatmap', icon: 'fa fa-bar-chart' },
    { chart: 'compare', icon: 'fa fa-line-chart' },
    { chart: 'directed_force', icon: 'fa fa-bar-chart' },
    { chart: 'dist_bar', icon: 'fa fa-bar-chart' },
    { chart: 'filter_box', icon: 'fa fa-check-square' },
    { chart: 'heatmap', icon: 'fa fa-bar-chart' },
    { chart: 'histogram', icon: 'fa fa-bar-chart' },
    { chart: 'horizon', icon: 'fa fa-bar-chart' },
    { chart: 'iframe', icon: 'fa fa-columns' },
    { chart: 'line', icon: 'fa fa-line-chart' },
    { chart: 'mapbox', icon: 'fa fa-bar-chart' },
    { chart: 'markup', icon: 'fa fa-bar-chart' },
    { chart: 'para', icon: 'fa fa-bar-chart' },
    { chart: 'pie', icon: 'fa fa-pie-chart' },
    { chart: 'pivot_table', icon: 'fa fa-table' },
    { chart: 'sankey', icon: 'fa fa-bar-chart' },
    { chart: 'separator', icon: 'fa fa-bar-chart' },
    { chart: 'sunburst', icon: 'fa fa-bar-chart' },
    { chart: 'table', icon: 'fa fa-table' },
    { chart: 'treemap', icon: 'fa fa-bar-chart' },
    { chart: 'word_cloud', icon: 'fa fa-bar-chart' },
    { chart: 'world_map', icon: 'fa fa-map-marker' },
    { chart: 'linePlusBar', icon: 'fa fa-line-chart' },
    { chart: 'multi', icon: 'fa fa-line-chart' },
];

const selectedMenu = {
  chart: '',
  icon: '',
};

export default class MenuField extends React.Component {
  constructor(props) { 
    super(props);
    selectedMenu.chart = this.props.value;
    for (var viz in vizType) { 
      if (vizType[viz].chart === this.props.value) { 
        selectedMenu.chart = vizType[viz].chart;
        selectedMenu.icon = vizType[viz].icon;
        break;    
      }
    }
  }
  onChange(info) {
    let optionValue = info ? info.key : null;
    for (var viz in vizType) {
      if (vizType[viz].chart === optionValue) {
        selectedMenu.chart = vizType[viz].chart;
        selectedMenu.icon = vizType[viz].icon;
        this.props.onChange(this.props.name, optionValue); 
        break;    
      }
    }
  }
  render() {
    const menuProps = {
      mode: 'horizontal',
      openAnimation: 'zoom',
      onClick: this.onChange.bind(this),
    };
    const menuTitle = (<span>
                          <i className="fa fa-bar-chart icon-span"></i>
                          <font size="2">选择图形</font>
                          <i className="fa fa-caret-down pull-right"></i>
                       </span>);
    const baseTitle = (<span>
                         <i className="fa fa-bar-chart icon-span"></i>
                         <font size="2">基础图形</font>
                         <i className="fa fa-caret-right pull-right"></i>
                       </span>);
    const barTitle = (<span>
                        <i className="fa fa-bar-chart icon-span"></i>
                        <font size="2">条形图</font>
                        <i className="fa fa-caret-right pull-right"></i>
                      </span>);
    const lineTitle = (<span>
                         <i className="fa fa-line-chart icon-span"></i>
                         <font size="2">线形图</font>
                         <i className="fa fa-caret-right pull-right"></i>
                       </span>);
    const areaTitle = (<span>
                         <i className="fa fa-area-chart icon-span"></i>
                         <font size="2">面积图</font>
                         <i className="fa fa-caret-right pull-right"></i>
                       </span>);
    const advancedTitle = (<span>
                             <i className="fa fa-external-link-square icon-span"></i>
                             <font size="2">高级图</font>
                             <i className="fa fa-caret-right pull-right"></i>
                           </span>);
    const meterTitle = (<span>
                          <i className="fa fa-tachometer icon-span"></i>
                          <font size="2">计量图</font>
                          <i className="fa fa-caret-right pull-right"></i>
                       </span>);
    const hTitle = (<span>
                      <i className="fa fa-header icon-span"></i>
                      <font size="2">大字图</font>
                      <i className="fa fa-caret-right pull-right"></i>
                    </span>);
    const mapTitle = (<span>
                        <i className="fa fa-map-marker icon-span"></i>
                        <font size="2">地图</font>
                        <i className="fa fa-caret-right pull-right"></i>
                      </span>);
    const otherTitle = (<span>
                          <i className="fa fa-ellipsis-h icon-span"></i>
                          <font size="2">其他</font>
                          <i className="fa fa-caret-right pull-right"></i>
                        </span>);
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const MenuWrap = 
 (<menu {...menuprops}> 
   <submenu title="{menuTitle}"> 
    <menuitem key="filter_box"> 
     <span> <i classname="fa fa-check-square icon-span"></i> <font size="2">提示器</font> </span> 
    </menuitem> 
    <divider /> 
    <menuitem key="table"> 
     <span><i classname="fa fa-table icon-span"></i> <font size="2">表格</font> </span> 
    </menuitem> 
    <menuitem key="pivot_table"> 
     <span><i classname="fa fa-table icon-span"></i> <font size="2">数据透视表</font> </span> 
    </menuitem> 
    <submenu title="{baseTitle}" key="4"> 
     <submenu title="{barTitle}" key="4-1"> 
      <menuitem key="dist_bar"> 
       <span><i classname="fa fa-bar-chart icon-span"></i> <font size="2">条形图</font> </span> 
      </menuitem> 
      <menuitem key="bar"> 
       <span><i classname="fa fa-bar-chart icon-span"></i> <font size="2">条形图(T)</font> </span> 
      </menuitem> 
     </submenu> 
     <submenu title="{lineTitle}" key="4-2"> 
      <menuitem key="multi"> 
       <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">线形图</font> </span> 
      </menuitem> 
      <menuitem key="line"> 
       <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">线形图(T)</font> </span> 
      </menuitem> 
      <menuitem key="linePlusBar"> 
       <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">线形图(S)</font> </span> 
      </menuitem> 
      <menuitem key="compare"> 
       <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">线形图(VS)</font> </span> 
      </menuitem> 
     </submenu> 
     <menuitem key="linePlusBar"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">条线图</font> </span> 
     </menuitem> 
     <submenu title="{areaTitle}" key="4-4"> 
      <menuitem key="area"> 
       <span><i classname="fa fa-area-chart icon-span"></i> <font size="2">面积图</font> </span> 
      </menuitem> 
      <menuitem key="area1"> 
       <span><i classname="fa fa-area-chart icon-span"></i> <font size="2">面积图(T)</font> </span> 
      </menuitem> 
     </submenu> 
     <menuitem key="pie"> 
      <span><i classname="fa fa-pie-chart icon-span"></i> <font size="2">饼形图</font> </span> 
     </menuitem> 
    </submenu> 
    <submenu title="{advancedTitle}" key="5"> 
     <menuitem key="bubble"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">气泡图</font> </span> 
     </menuitem> 
     <menuitem key="5-2" disable="true"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">雷达图</font> </span> 
     </menuitem> 
     <menuitem key="5-3" disable="true"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">散点图</font> </span> 
     </menuitem> 
     <menuitem key="sankey"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">蛇形图</font> </span> 
     </menuitem> 
     <menuitem key="directed_force"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">拓扑图</font> </span> 
     </menuitem> 
     <menuitem key="horizon"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">热力图</font> </span> 
     </menuitem> 
     <menuitem key="mapbox"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">热力图</font> </span> 
     </menuitem> 
     <menuitem key="treemap"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">树状图</font> </span> 
     </menuitem> 
     <menuitem key="box_plot"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">箱体图</font> </span> 
     </menuitem> 
     <menuitem key="para"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">帕拉图</font> </span> 
     </menuitem> 
     <menuitem key="cal_heatmap"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">日历图</font> </span> 
     </menuitem> 
     <menuitem key="sunburst"> 
      <span><i classname="fa fa-line-chart icon-span"></i> <font size="2">环形图</font> </span> 
     </menuitem> 
    </submenu> 
    <submenu title="{meterTitle}" key="6"> 
     <submenu title="{hTitle}" key="6-1"> 
      <menuitem key="big_number"> 
       <span><i classname="fa fa-header icon-span"></i> <font size="2">大字图</font> </span> 
      </menuitem> 
      <menuitem key="big_number_total"> 
       <span><i classname="fa fa-header icon-span"></i> <font size="2">大字图(T)</font> </span> 
      </menuitem> 
     </submenu> 
     <menuitem key="bullet"> 
      <span><i classname="fa fa-space-shuttle icon-span"></i> <font size="2">子弹图</font> </span> 
     </menuitem> 
     <menuitem key="6-3" disable="true"> 
      <span><i classname="fa fa-tachometer icon-span"></i> <font size="2">仪表图</font> </span> 
     </menuitem> 
     <menuitem key="word_cloud" disable="true"> 
      <span><i classname="fa fa-file-word-o icon-span"></i> <font size="2">云字图</font> </span> 
     </menuitem> 
    </submenu> 
    <submenu title="{mapTitle}" key="7"> 
     <menuitem key="world_map"> 
      <span><i classname="fa fa-map-marker icon-span"></i> <font size="2">世界地图</font> </span> 
     </menuitem> 
     <menuitem key="world_map1"> 
      <span><i classname="fa fa-map-marker icon-span"></i> <font size="2">中国地图</font> </span> 
     </menuitem> 
    </submenu> 
    <submenu title="{otherTitle}" key="8"> 
     <menuitem key="markup1"> 
      <span><i classname="fa fa-file-code-o icon-span"></i> <font size="2">叙述</font> </span> 
     </menuitem> 
     <menuitem key="markup"> 
      <span><i classname="fa fa-bar-chart icon-span"></i> <font size="2">标记</font> </span> 
     </menuitem> 
     <menuitem key="iframe"> 
      <span><i classname="fa fa-columns icon-span"></i> <font size="2">iframe</font> </span> 
     </menuitem> 
     <menuitem key="separator"> 
      <span><i classname="fa fa-minus icon-span"></i> <font size="2">separator</font> </span> 
     </menuitem> 
    </submenu> 
   </submenu> 
  </menu>);

    return (
      <div id={`formControlsSelect-${slugify(this.props.label)}`}>
        <div>
            <ControlLabelWithTooltip
            label={this.props.label}
            description={this.props.description}
            />
        </div>
        <div>
            <span style={{float: 'left'}}>{MenuWrap}</span>
            <span style={{paddingLeft: '5px'}}>
               <font size="2">当前图形：</font>
               <i className={`${selectedMenu.icon} icon-current-span`}></i>
               <font size="2">{selectedMenu.chart}</font>
            </span>
        </div>
      </div>
    );
  }
}

MenuField.propTypes = propTypes;
MenuField.defaultProps = defaultProps;
