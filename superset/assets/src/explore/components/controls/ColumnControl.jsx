/* eslint-disable */
import React from 'react';
import { t } from '@superset-ui/translation';
import PropTypes from 'prop-types';
import { CompactPicker } from 'react-color';
import { Button } from 'react-bootstrap';

import SelectControl from './SelectControl';
import TextControl from './TextControl';
import ControlHeader from './../ControlHeader';

const D3_TIME_FORMAT_OPTIONS = [
    ['.3s', '.3s | 12.3k'],
    ['.3%', '.3% | 1234543.210%'],
    ['.4r', '.4r | 12350'],
    ['.3f', '.3f | 12345.432'],
    ['+,', '+, | +12,345.4321'],
    ['$,.2f', '$,.2f | $12,345.43'],
];

const COMPARISION_OPTIONS = [
    '<',
    '=',
    '>',
    'contains',
    'startsWith',
    'endsWith',
];

const FONT_OPTIONS = [
    'normal',
    'bold',
];

const TEXT_ALIGN = [
    'left',
    'center',
    'right',
];

const propTypes = {
    name: PropTypes.string.isRequired,
    value: PropTypes.object,
    formData: PropTypes.object,
    label: PropTypes.string,
    description: PropTypes.string,
    onChange: PropTypes.func,
    columns: PropTypes.array,
};

const defaultProps = {
    value: {},
    formData: {},
    onChange: () => {},
};

export default class ColumnControl extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            metrics: props.formData.metrics || [],
            value: props.value,
            selectedMetric: null,
            selectedColumns: [],
        };
    }
    onSelectedMetricChange(value) {
        this.setState({ selectedMetric: value });
    }
    onSelectedColumnsChange(index, value) {
        const selectedColumns = this.state.selectedColumns || [];
        if (value) {
            this.setState({ selectedColumns: [...selectedColumns.slice(0, index), value] });
        } else {
            this.setState({ selectedColumns: selectedColumns.slice(0, index) });
        }
    }
    onValueChange(metric, type, newValue) {
        const value = this.props.value;
        if (!(metric in value)) {
            value[metric] = {};
        }
        if (!(type in value[metric])) {
            value[metric][type] = null;
        }
        value[metric][type] = newValue;
        this.setState({ value });
        this.props.onChange(value);
    }
    onCancel(metric, colorChoice) {
        const value = this.props.value;
        if (!(metric in value)) {
            value[metric] = {};
        }
        if (!(colorChoice in value[metric])) {
            value[metric][colorChoice] = {};
        }
        value[metric][colorChoice] = {};
        this.setState({ value });
        this.props.onChange(value);
    }
    getCombinedMetric() {
        if (this.props.formData.viz_type !== 'pivot_table') {
            return this.state.selectedMetric;
        }
        return [this.state.selectedMetric].concat(this.state.selectedColumns);
    }
    getUnique(array) {
        return [...(new Set(array))];
    }
    getSelectedColumnsOptions(index) {
        const metrics = this.getCombinedMetric();
        let subOptions = this.props.columns;
        for (let i = 0; i <= index; i++) {
            subOptions = subOptions.filter(v => (v[i] === metrics[i]));
        }
        return this.getUnique(subOptions.map(v => (v[index + 1])));
    }
    render() {
        const vizType = this.props.formData.viz_type;
        const columns = this.props.formData.columns || [];
        let validColumns = columns;
        if (this.props.columns[0]) {
            validColumns = columns.slice(0, this.props.columns[0].length - 1);
        }
        const value = this.state.value === null ? {} : this.state.value;
        const metric = (validColumns.length === 0 ?
            this.state.selectedMetric : this.getCombinedMetric());
        const bcColoringOption = (
            metric in value &&
            'bcColoringOption' in value[metric]
        ) ? value[metric].bcColoringOption : {};
        const textAlign = (
            metric in value &&
            'textAlign' in value[metric]
        ) ? value[metric].textAlign : null;
        const formatting = (
            metric in value &&
            'formatting' in value[metric]
        ) ? value[metric].formatting : null;
        const comparisionOption = (
            metric in value &&
            'comparisionOption' in value[metric]
        ) ? value[metric].comparisionOption : null;
        const basement = (
            metric in value &&
            'basement' in value[metric]
        ) ? value[metric].basement : null;
        const coloringOption = (
            metric in value &&
            'coloringOption' in value[metric]
        ) ? value[metric].coloringOption : {};
        const fontOption = (
            metric in value &&
            'fontOption' in value[metric]
        ) ? value[metric].fontOption : null;
        let selectedColumnsElement = null;
        let metricElementHeader = null;
        let metricElement = null;
        let metricSettingElementHeader = null;
        let metricSettingElement = null;
        if (vizType === 'pivot_table' && this.state.selectedMetric !== null) {
            selectedColumnsElement = validColumns.map((column, index) => {
                if (index === 0 || this.state.selectedColumns[(index - 1)]) {
                    return (<div className="space-1" key={index}>
                        <SelectControl
                            name="column_focus"
                            label={t('Column')}
                            choices={this.getSelectedColumnsOptions(index)}
                            onChange={this.onSelectedColumnsChange.bind(this, index)}
                            value={this.state.selectedColumns[index]}
                        />
                    </div>);
                }
                return null;
            });
        }
        if (this.state.selectedMetric !== null) {
            metricElementHeader = (
                <div className="space-1">
                    <ControlHeader
                        label="Column Setting:"
                        description="General Column Setting"
                    />
                </div>
            );
            metricElement = (
                <div>
                    <table className="table table-bordered" style={{ fontSize: '12px' }}>
                        <tbody key={metric}>
                        <tr>
                            <td><span>Background Color</span></td>
                            <td>
                                <CompactPicker
                                    color={bcColoringOption}
                                    onChangeComplete={this.onValueChange.bind(this, metric, 'bcColoringOption')}
                                />
                                <Button
                                    id="cancel-bgcolor-button"
                                    style={{ marginLeft: '15px' }}
                                    bsSize="xs"
                                    onClick={this.onCancel.bind(this, metric, 'bcColoringOption')}
                                >
                                    <i className="fa fa-close" /> Reset Color
                                </Button>
                            </td>
                        </tr>
                        <tr>
                            <td><span>Text Align</span></td>
                            <td>
                                <SelectControl
                                    name={metric + '___textAlign'}
                                    default={TEXT_ALIGN[2]}
                                    choices={TEXT_ALIGN}
                                    clearable
                                    onChange={this.onValueChange.bind(this, metric, 'textAlign')}
                                    value={textAlign}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td><span>Formatting</span></td>
                            <td>
                                <SelectControl
                                    name={metric + '___formatting'}
                                    default={D3_TIME_FORMAT_OPTIONS[0]}
                                    choices={D3_TIME_FORMAT_OPTIONS}
                                    clearable
                                    freeForm
                                    onChange={this.onValueChange.bind(this, metric, 'formatting')}
                                    value={formatting}
                                />
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            );
            metricSettingElementHeader = (
                <div className="space-1">
                    <ControlHeader
                        label="Conditional Setting:"
                        description=""
                    />
                </div>
            );
            metricSettingElement = (
                <div>
                    <table className="table table-bordered" style={{ fontSize: '12px' }}>
                        <tbody key={metric}>
                        <tr>
                            <td><span>Comparision options</span></td>
                            <td>
                                <SelectControl
                                    name={metric + '___comparisionOption'}
                                    default={COMPARISION_OPTIONS[0]}
                                    choices={COMPARISION_OPTIONS}
                                    clearable
                                    onChange={this.onValueChange.bind(this, metric, 'comparisionOption')}
                                    value={comparisionOption}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td><span>Basement setting</span></td>
                            <td>
                                <TextControl
                                    name={metric + '___basementSetting'}
                                    default={''}
                                    clearable
                                    onChange={this.onValueChange.bind(this, metric, 'basement')}
                                    value={basement}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td><span>Coloring options</span></td>
                            <td>
                                <CompactPicker
                                    color={coloringOption}
                                    onChangeComplete={this.onValueChange.bind(this, metric, 'coloringOption')}
                                />
                                <Button
                                    id="cancel-color-button"
                                    style={{ marginLeft: '15px' }}
                                    bsSize="xs"
                                    onClick={this.onCancel.bind(this, metric, 'coloringOption')}
                                >
                                    <i className="fa fa-close" /> Reset Color
                                </Button>
                            </td>
                        </tr>
                        <tr>
                            <td><span>Font options</span></td>
                            <td>
                                <SelectControl
                                    name={metric + '___fontOption'}
                                    default={FONT_OPTIONS[0]}
                                    choices={FONT_OPTIONS}
                                    clearable
                                    onChange={this.onValueChange.bind(this, metric, 'fontOption')}
                                    value={fontOption}
                                />
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            );
        }
        return (
            <div className="panel-collapse">
                <div className="space-1">
                    <SelectControl
                        name="metric_focus"
                        label={t('Metric')}
                        choices={this.getUnique(this.props.columns.map(
                            v => (typeof (v) === 'string' ? v : v[0]),
                        ))}
                        onChange={this.onSelectedMetricChange.bind(this)}
                        value={this.state.selectedMetric}
                    />
                </div>
                <div>
                    {selectedColumnsElement}
                    {metricElementHeader}
                    {metricElement}
                    {metricSettingElementHeader}
                    {metricSettingElement}
                </div>
            </div>
        );
    }
}

ColumnControl.propTypes = propTypes;
ColumnControl.defaultProps = defaultProps;