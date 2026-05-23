import { Behavior, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from '../images/thumbnail.png';


const metadata = new ChartMetadata({
    description: 'A dedicated Interactive custom Date Picker.',
    name: t('Custom Date Picker'),
    thumbnail,
    behaviors: [Behavior.InteractiveChart],
    tags: [t('Filter'), t('Interactive'), t('Time')],
});


export default class CustomDatePickerPlugin extends ChartPlugin {
    constructor() {
        super({
            buildQuery,
            controlPanel,
            loadChart: () => import('../CustomDatePicker'),
            metadata,
            transformProps,
        });
    }
}


export { CustomDatePickerPlugin };