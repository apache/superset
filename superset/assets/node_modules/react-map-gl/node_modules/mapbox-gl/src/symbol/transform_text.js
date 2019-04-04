// @flow

import { plugin as rtlTextPlugin } from '../source/rtl_text_plugin';

import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type {Feature} from '../style-spec/expression';
import Formatted from '../style-spec/expression/types/formatted';

function transformText(text: string, layer: SymbolStyleLayer, feature: Feature) {
    const transform = layer.layout.get('text-transform').evaluate(feature, {});
    if (transform === 'uppercase') {
        text = text.toLocaleUpperCase();
    } else if (transform === 'lowercase') {
        text = text.toLocaleLowerCase();
    }

    if (rtlTextPlugin.applyArabicShaping) {
        text = rtlTextPlugin.applyArabicShaping(text);
    }

    return text;
}


export default function(text: Formatted, layer: SymbolStyleLayer, feature: Feature): Formatted {
    text.sections.forEach(section => {
        section.text = transformText(section.text, layer, feature);
    });
    return text;
}
