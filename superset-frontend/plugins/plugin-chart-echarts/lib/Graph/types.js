import { DEFAULT_LEGEND_FORM_DATA, LegendOrientation, LegendType, } from '../types';
export const DEFAULT_FORM_DATA = {
    ...DEFAULT_LEGEND_FORM_DATA,
    source: '',
    target: '',
    layout: 'force',
    roam: true,
    draggable: false,
    selectedMode: 'single',
    showSymbolThreshold: 0,
    repulsion: 1000,
    gravity: 0.3,
    edgeSymbol: 'none,arrow',
    edgeLength: 400,
    baseEdgeWidth: 3,
    baseNodeSize: 20,
    friction: 0.2,
    legendOrientation: LegendOrientation.Top,
    legendType: LegendType.Scroll,
};
//# sourceMappingURL=types.js.map