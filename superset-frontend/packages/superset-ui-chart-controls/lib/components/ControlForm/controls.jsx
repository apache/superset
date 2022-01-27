import { Slider, InputNumber, Input } from 'antd';
import Checkbox from 'antd/lib/checkbox';
import Select from '../Select';
import RadioButtonControl from '../../shared-controls/components/RadioButtonControl';
export const ControlFormItemComponents = {
    Slider,
    InputNumber,
    Input,
    Select,
    // Directly export Checkbox will result in "using name from external module" error
    // ref: https://stackoverflow.com/questions/43900035/ts4023-exported-variable-x-has-or-is-using-name-y-from-external-module-but
    Checkbox: Checkbox,
    RadioButtonControl,
};
//# sourceMappingURL=controls.jsx.map