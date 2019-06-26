/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import * as _ from 'lodash';

import {
    APPLY_FILTER,
    isUseAsModalActionExist,
    getActionsMapForSlice,
} from './publishSubscriberUtil'

function createPublishDataFor(slice, slices) {
    return {
        id: slice.id,
        publish_columns: slice.formData.publish_columns,
        subcribers: getSubsribersFor(slice.id, slices),
        viz_type: slice.formData.viz_type,

    }

}

function getSubsribersFor(publisherId, slices) {
    var subs = [];
    slices.forEach(element => {
        if (isSubscriber(element) && isPublisherExistInLinkedSlices(element, publisherId)) {
            subs.push(element.id);
        }
    });
    return subs;
}

function isPublisher(slice) {
    return (slice.formData.publish_columns && slice.formData.publish_columns.length > 0)
}

function getPublisherMap(slices) {
    var pubs;
    slices.forEach(element => {
        if (isPublisher(element)) {
            if (!pubs) {
                pubs = {};
            }
            pubs[element.id] = createPublishDataFor(element, slices);
        }
    });
    return pubs;
}

function createFilterDataFromPublishColumns(obj) {
    var filterList = [];
    obj.publish_columns.forEach(element => {
        filterList.push({
            col: element,
            op: 'in',
            actions: [APPLY_FILTER],
        })
    });
    return filterList;
}

function isPublisherExistInLinkedSlices(slice, publisherId) {
    var item = _.find(slice.formData.linked_slice, function (item) {
        return ((Number.isInteger(item) && item == publisherId) ||
            (item instanceof Object && item.publisher_id == publisherId))
    })
    return (item != undefined)
}

function getLinkedSlices(slices, publishers) {
    var ls = {};
    slices.forEach(element => {
        // backward compitable
        if (Number.isInteger(element) && publishers && publishers.hasOwnProperty(element)) {
            ls[element] = createFilterDataFromPublishColumns(publishers[element]);
        }
        // as per new ds
        else if (element instanceof Object && publishers && publishers.hasOwnProperty(element.publisher_id)) {
            ls[element.publisher_id] = element.subscribe_columns;
        }
    });
    return ls;
}

function createSubscriberDataFor(slice, publishers) {
    return {
        id: slice.id,
        viz_type: slice.formData.viz_type,
        actions: slice.formData.hasOwnProperty('actions') && slice.formData.actions ? slice.formData.actions : {},
        linked_slices: getLinkedSlices(slice.formData.linked_slice, publishers),
        extras: slice.formData.hasOwnProperty('extras') ? slice.formData.extras : undefined,
        useAsModal: slice.formData.useAsModal,
    }

}

function isSubscriber(slice) {
    return (slice.formData.linked_slice && slice.formData.linked_slice.length > 0)
}

function getSubscriberMap(slices, publishers) {
    var subs;
    slices.forEach(element => {
        if (isSubscriber(element)) {
            if (!subs) {
                subs = {};
            }
            subs[element.id] = createSubscriberDataFor(element, publishers)
        }
    });
    return subs;
}

export default function getPublishSubscriberMap(slices) {
    slices = updateSlices(slices);
    let publishers = getPublisherMap(slices);
    let subscribers = publishers ? getSubscriberMap(slices, publishers) : undefined;
    return {
        publishers: publishers,
        subscribers: subscribers
    };
}

function updateSlices(slices) {
    let updatedSlices = _.clone(slices);
    updatedSlices.forEach(slice => {
        const linkedSlices = getLinkedSlicesFromSubscriberLayer(slice.formData.subscriber_layers);
        slice.formData.linked_slice = linkedSlices ? linkedSlices : slice.formData.linked_slice;
        slice.formData.actions = getActionsMapForSlice(slice);
        slice.formData.useAsModal = 'USE_AS_MODAL' in slice.formData.actions;
    });

    return updatedSlices;
}

function getLinkedSlicesFromSubscriberLayer(subscriberLayer) {
    let linkedSlices;
    if (subscriberLayer) {
        linkedSlices = [];
        subscriberLayer.forEach(element => {
            element.subscribe_columns.forEach(item => {

                linkedSlices.push({
                  publisher_id: element.sliceId,
                  subscribe_columns: element.subscribe_columns
                });
            });
        });
    }

    return linkedSlices;
}
