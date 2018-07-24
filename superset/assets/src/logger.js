/* eslint no-console: 0 */

import $ from 'jquery';

// This creates an association between an eventName and the ActionLog instance so that
// Logger.append calls do not have to know about the appropriate ActionLog instance
const addEventHandlers = {};

export const Logger = {
  start(log) {
    // create a handler to handle adding each event type
    log.eventNames.forEach((eventName) => {
      if (!addEventHandlers[eventName]) {
        addEventHandlers[eventName] = log.addEvent.bind(log);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`Duplicate event handler for event '${eventName}'`);
      }
    });
  },

  append(eventName, eventBody, sendNow) {
    if (addEventHandlers[eventName]) {
      addEventHandlers[eventName](eventName, eventBody, sendNow);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`No event handler for event '${eventName}'`);
    }
  },

  end(log) {
    this.send(log);

    // remove handlers
    log.eventNames.forEach((eventName) => {
      if (addEventHandlers[eventName]) {
        delete addEventHandlers[eventName];
      }
    });
  },

  send(log) {
    const { impressionId, source, sourceId, events } = log;
    let url = '/superset/log/';

    // backend logs treat these request params as first-class citizens
    if (source === 'dashboard') {
      url += `?dashboard_id=${sourceId}`;
    } else if (source === 'slice') {
      url += `?slice_id=${sourceId}`;
    }

    const eventData = [];
    for (const eventName in events) {
      events[eventName].forEach((event) => {
        eventData.push({
          source,
          source_id: sourceId,
          event_name: eventName,
          impression_id: impressionId,
          ...event,
        });
      });
    }

    $.ajax({
      url,
      method: 'POST',
      dataType: 'json',
      data: {
        explode: 'events',
        events: JSON.stringify(eventData),
      },
    });

    // flush events for this logger
    log.events = {}; // eslint-disable-line no-param-reassign
  },

  // note that this returns ms since page load, NOT ms since epoc
  getTimestamp() {
    return Math.round(window.performance.now());
  },
};

export class ActionLog {
  constructor({ impressionId, source, sourceId, sendNow, eventNames }) {
    this.impressionId = impressionId;
    this.source = source;
    this.sourceId = sourceId;
    this.eventNames = eventNames;
    this.sendNow = sendNow || false;
    this.events = {};

    this.addEvent = this.addEvent.bind(this);
  }

  setAttribute(name, value) {
    this[name] = value;
  }

  addEvent(eventName, eventBody, sendNow) {
    if (sendNow) {
      Logger.send({
        ...this,
        // overwrite events so that Logger.send doesn't clear this.events
        events: {
          [eventName]: [
            {
              ts: new Date().getTime(),
              start_offset: Logger.getTimestamp(),
              ...eventBody,
            },
          ],
        },
      });
    } else {
      this.events[eventName] = this.events[eventName] || [];

      this.events[eventName].push({
        ts: new Date().getTime(),
        start_offset: Logger.getTimestamp(),
        ...eventBody,
      });

      if (this.sendNow) {
        Logger.send(this);
      }
    }
  }
}

// Log event types ------------------------------------------------------------
export const LOG_ACTIONS_MOUNT_DASHBOARD = 'mount_dashboard';
export const LOG_ACTIONS_MOUNT_EXPLORER = 'mount_explorer';

export const LOG_ACTIONS_FIRST_DASHBOARD_LOAD = 'first_dashboard_load';
export const LOG_ACTIONS_LOAD_DASHBOARD_PANE = 'load_dashboard_pane';
export const LOG_ACTIONS_LOAD_CHART = 'load_chart_data';
export const LOG_ACTIONS_RENDER_CHART = 'render_chart';
export const LOG_ACTIONS_REFRESH_CHART = 'force_refresh_chart';

export const LOG_ACTIONS_REFRESH_DASHBOARD = 'force_refresh_dashboard';
export const LOG_ACTIONS_EXPLORE_DASHBOARD_CHART = 'explore_dashboard_chart';
export const LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART = 'export_csv_dashboard_chart';
export const LOG_ACTIONS_CHANGE_DASHBOARD_FILTER = 'change_dashboard_filter';

export const DASHBOARD_EVENT_NAMES = [
  LOG_ACTIONS_MOUNT_DASHBOARD,
  LOG_ACTIONS_FIRST_DASHBOARD_LOAD,
  LOG_ACTIONS_LOAD_DASHBOARD_PANE,
  LOG_ACTIONS_LOAD_CHART,
  LOG_ACTIONS_RENDER_CHART,
  LOG_ACTIONS_EXPLORE_DASHBOARD_CHART,
  LOG_ACTIONS_REFRESH_CHART,
  LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART,
  LOG_ACTIONS_CHANGE_DASHBOARD_FILTER,
  LOG_ACTIONS_REFRESH_DASHBOARD,
];

export const EXPLORE_EVENT_NAMES = [
  LOG_ACTIONS_MOUNT_EXPLORER,
  LOG_ACTIONS_LOAD_CHART,
  LOG_ACTIONS_RENDER_CHART,
  LOG_ACTIONS_REFRESH_CHART,
];
