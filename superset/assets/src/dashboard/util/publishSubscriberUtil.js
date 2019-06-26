import { union, find } from 'lodash';

export const APPLY_FILTER = 'APPLY_FILTER';
export const USE_AS_MODAL = 'USE_AS_MODAL';

const CHART_UPDATE_SUCCEEDED = 'CHART_UPDATE_SUCCEEDED';
const INCLUDE_IN_TITLE = 'INCLUDE_IN_TITLE';
//check slice is modal or not
export function isModalSlice(slice) {
    let actions = getUniqueActionsForSlice(slice);
    return isUseAsModalActionExist(actions);
}

export function isUseAsModalActionExist(actions) {
    return (actions && actions.some((action) => action == USE_AS_MODAL)) ? true : false;
}

export function getActionsMapForSlice(slice) {
    let actions = {};
    if (slice && slice.formData && slice.formData.hasOwnProperty('subscriber_layers')) {
        let subscriberLayers = slice.formData.subscriber_layers
        if (subscriberLayers) {
            subscriberLayers.forEach(susbcriberLayer => {
                if (isUseAsModalActionExist(susbcriberLayer.actions)) {
                    if (!actions['USE_AS_MODAL'])
                        actions['USE_AS_MODAL'] = [];
                    actions['USE_AS_MODAL'].push([susbcriberLayer.sliceId]);
                }
                let subscribe_columns = susbcriberLayer.subscribe_columns
                subscribe_columns.forEach(column => {
                    let column_actions = column.actions;
                    column_actions.forEach(action => {
                        if (!actions[action])
                            actions[action] = [];
                        actions[action] = union(actions[action], [susbcriberLayer.sliceId]);
                    })
                })
            });
        }
    }// backward compitable
    else if (slice && slice.formData && slice.formData.hasOwnProperty('linked_slice')) {
        let linked_slice = slice.formData['linked_slice'];
        if (linked_slice && linked_slice.length > 0) {
            linked_slice.forEach(ls => {
                if (Number.isInteger(ls)) {
                    if (!actions['APPLY_FILTER'])
                        actions['APPLY_FILTER'] = [];
                    actions['APPLY_FILTER'].push(ls);
                }
            })
        }
    }
    return actions;
}

export function getUniqueActionsForSlice(slice) {
    let actions;
    if (slice && slice.form_data && slice.form_data.hasOwnProperty('subscriber_layers')) {
        let subscriberLayers = slice.form_data.subscriber_layers
        if (subscriberLayers) {
            actions = [];
            subscriberLayers.forEach(element => {
                actions = union(actions, element.actions);
            });
        }
    }
    return actions;
}

export function getModalSliceIDFor(publishSubscriberMap, publisherId) {
    if (publisherId && publishSubscriberMap && publishSubscriberMap.hasOwnProperty('subscribers')) {
        const subscribers = publishSubscriberMap.publishers[publisherId]['subcribers'];
        let modalSliceId;
        subscribers.forEach(subscriberId => {
            let subscriberSlice = publishSubscriberMap.subscribers[subscriberId];
            if ((subscriberSlice.actions[USE_AS_MODAL] && (subscriberSlice.actions[USE_AS_MODAL].some((id) => id == parseInt(publisherId)))))
                modalSliceId = subscriberSlice.id;
        })
        return modalSliceId;
    }
    return undefined
}

export function getSubHeaderForSlice(subscribers, chartId, filters) {
    let subHeader = '';
    if (chartId != -1 && subscribers && subscribers[chartId]) {
        const subscriber = subscribers[chartId];
        if (subscriber.actions[INCLUDE_IN_TITLE]) {
            for (let lsKey in subscriber.linked_slices) {
                if (keyExists(lsKey, filters)) {
                    subscriber.linked_slices[lsKey].forEach(linkedSlice => {
                        if (linkedSlice.actions.indexOf(INCLUDE_IN_TITLE) > -1) {
                            let columnName = linkedSlice['col'];
                            let subHeaderValues = filters[lsKey][columnName];
                            const values = subHeaderValues ? getSubHeaderValues(subHeaderValues) : [];

                            if(values.length > 0) {
                                if(subHeader != '') {
                                    values.push(subHeader)
                                }

                                subHeader = values.join(' | ');
                            }
                        }
                    });
                }
            }
        }
    }
    return subHeader;
}

function getSubHeaderValues(headerValues) {
    let subTitleHeaders;

    if (headerValues.constructor == Array) {
        subTitleHeaders = headerValues.concat();
    }
    else {
        subTitleHeaders = [headerValues];
    }

    return subTitleHeaders;
}

export function keyExists(key, search) {
    if (!search || (search.constructor !== Array && search.constructor !== Object)) {
        return false;
    }

    for (let i = 0; i < search.length; i++) {
        if (search[i] === key) {
            return true;
        }
    }
    return key in search;
}

export default {
    APPLY_FILTER,
    USE_AS_MODAL,
    isModalSlice,
    getModalSliceIDFor,
    getSubHeaderForSlice,
    keyExists,
    getActionsMapForSlice
}
