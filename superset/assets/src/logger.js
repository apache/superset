import $ from 'jquery';

// export const LOG_ACTIONS_PAGE_LOAD = 'page_load_perf';
export const LOG_ACTIONS_MOUNT_DASHBOARD = 'mount_dashboard';
export const LOG_ACTIONS_LOAD_DASHBOARD_PANE = 'load_dashboard_pane';
export const LOG_ACTIONS_LOAD_CHART = 'load_chart_data';
export const LOG_ACTIONS_RENDER_CHART = 'render_chart';

export const LOG_ACTIONS_REFRESH_DASHBOARD = 'force_refresh_dashboard';
export const LOG_ACTIONS_EXPLORE_DASHBOARD_CHART = 'explore_dashboard_chart';
export const LOG_ACTIONS_REFRESH_DASHBOARD_CHART = 'force_refresh_dashboard_chart';
export const LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART = 'export_csv_dashboard_chart';
export const LOG_ACTIONS_CHANGE_DASHBOARD_FILTER = 'change_dashboard_filter';

export const DASHBOARD_EVENT_NAMES = [
  LOG_ACTIONS_MOUNT_DASHBOARD,
  LOG_ACTIONS_LOAD_DASHBOARD_PANE,
  LOG_ACTIONS_LOAD_CHART,
  LOG_ACTIONS_RENDER_CHART,
  LOG_ACTIONS_EXPLORE_DASHBOARD_CHART,
  LOG_ACTIONS_REFRESH_DASHBOARD_CHART,
  LOG_ACTIONS_EXPORT_CSV_DASHBOARD_CHART,
  LOG_ACTIONS_CHANGE_DASHBOARD_FILTER,
  LOG_ACTIONS_REFRESH_DASHBOARD,
];

// This creates an association between an eventName and the ActionLog instance so that
// Logger.append calls do not have to know about the appropriate ActionLog instance
const addEventHandlers = {};

export const Logger = {
  start(log) {
    log.setAttribute('startAt', new Date().getTime() - this.getTimestamp());

    // create a handler to handle adding each event type
    log.eventNames.forEach((eventName) => {
      if (!addEventHandlers[eventName]) {
        addEventHandlers[eventName] = log.addEvent.bind(log);
      } else {
        console.warn(`Duplicate event handler for event '${eventName}'`);
      }
    });
  },

  append(eventName, eventBody, sendNow) {
    if (addEventHandlers[eventName]) {
      addEventHandlers[eventName](eventName, eventBody, sendNow);
    } else {
      console.warn(`No event handler for event '${eventName}'`);
    }
  },

  end(log) {
    // log.setAttribute('duration', new Date().getTime() - log.startAt);
    this.send(log);
    log.setAttribute('events', {}); // flush logs for this instance

    log.eventNames.forEach((eventName) => {
      if (addEventHandlers[eventName] && addEventHandlers[eventName] === log.addEvent) {
        delete addEventHandlers[eventName];
      }
    });
  },

  send(log) {
    log.setAttribute('duration', new Date().getTime() - log.startAt);
    const { impressionId, source, sourceId, events, startAt, duration } = log;
    const requestPrams = [];

    switch (source) {
      case 'dashboard':
        requestPrams.push(`dashboard_id=${sourceId}`);
        break;
      case 'slice':
        requestPrams.push(`slice_id=${sourceId}`);
        break;
      default:
        break;
    }
    let url = '/superset/log/';
    if (requestPrams.length) {
      url += `?${requestPrams.join('&')}`;
    }

    const eventData = [];
    for (const eventName in events) {
      events[eventName].forEach((event) => {
        eventData.push({ event_name: eventName, impression_id: impressionId, ...event });
      });
    }

    $.ajax({
      url,
      method: 'POST',
      dataType: 'json',
      data: {
        source,
        impression_id: impressionId,
        started_time: startAt,
        duration,
        events: JSON.stringify(eventData),
      },
    });

    console.log('send events', {
      source,
      impression_id: impressionId,
      started_time: startAt,
      duration,
      events: eventData,
    });

    // flush events for this logger
    // note that if you call log.setAttribute() it would incorrectly
    log.events = {};
  },

  getTimestamp() {
    return Math.round(window.performance.now());
  },
};

export class ActionLog {
  constructor({ impressionId, source, sourceId, sendNow, eventNames }) {
    this.impressionId = impressionId;
    this.source = source;
    this.sourceId = sourceId;
    // this.actionType = actionType;
    this.eventNames = eventNames;
    this.sendNow = sendNow || false;
    this.startAt = 0;
    this.duration = 0;
    this.events = {};

    this.addEvent = this.addEvent.bind(this);
    this.sendOneEvent = this.sendOneEvent.bind(this);
  }

  setAttribute(name, value) {
    this[name] = value;
  }

  addEvent(eventName, eventBody, sendNow) {
    if (sendNow) {
      this.sendOneEvent(eventName, eventBody);
    } else {
      this.events[eventName] = this.events[eventName] || [];
      this.events[eventName].push(eventBody);

      if (this.sendNow) {
        this.setAttribute('duration', new Date().getTime() - this.startAt);
        Logger.send(this);
      }
    }
  }

  sendOneEvent(eventName, eventBody) {
    this.setAttribute('duration', new Date().getTime() - this.startAt);
    Logger.send({ ...this, events: { [eventName]: [eventBody] } });
  }
}
