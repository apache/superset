import * as _ from 'lodash';

export const APPLY_FILTER = 'APPLY_FILTER';
export const USE_AS_MODAL = 'USE_AS_MODAL';
const CHART_UPDATE_SUCCEEDED = "CHART_UPDATE_SUCCEEDED"
//check slice is modal or not
export function isModalSlice(slice) {
    let actions = getUniqueActionsForSlice(slice);
    return isUseAsModalActionExist(actions);
}

export function isUseAsModalActionExist(actions) {
    return (actions && actions.indexOf(USE_AS_MODAL) != -1) ? true :false;
}

export function getUniqueActionsForSlice(slice) {
    let actions;
    if (slice && slice.form_data && slice.form_data.hasOwnProperty('subscriber_layers')) {
        let subscriberLayers = slice.form_data.subscriber_layers
        if (subscriberLayers) {
            actions = [];
            subscriberLayers.forEach(element => {
                actions = _.union(actions, element.actions);
            });
        }
    }
    return actions;
}

export function getModalSliceIDFor(publishSubscriberMap, publisherId) {
    if (publishSubscriberMap && publishSubscriberMap.hasOwnProperty('subscribers')) {
        const subscribers = Object.values(publishSubscriberMap.subscribers);
        var item = _.find(subscribers, function (item) {
            return ((item.actions.indexOf(USE_AS_MODAL) > -1) && (Object.keys(item.linked_slices).indexOf(publisherId) != -1));
        });
        return item ? item.id : undefined;
    }
    return undefined
}

export default {
    APPLY_FILTER,
    USE_AS_MODAL,
    isModalSlice,
    getModalSliceIDFor,
}