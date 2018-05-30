import $ from 'jquery';

export const LOG_ACTIONS_PAGE_LOAD = 'page_load_perf';
export const LOG_ACTIONS_LOAD_EVENT = 'load_events';
export const LOG_ACTIONS_RENDER_EVENT = 'render_events';

const handlers = {};

export const Logger = {
  start(log) {
    log.setAttribute('startAt', new Date().getTime() - this.getTimestamp());
    log.eventNames.forEach((eventName) => {
      if (!handlers[eventName]) {
        handlers[eventName] = [];
      }
      handlers[eventName].push(log.addEvent.bind(log));
    });
  },

  append(eventName, eventBody) {
    return handlers[eventName].length &&
      handlers[eventName].forEach(handler => (handler(eventName, eventBody)));
  },

  end(log) {
    log.setAttribute('duration', new Date().getTime() - log.startAt);
    this.send(log);

    log.eventNames.forEach((eventName) => {
      if (handlers[eventName].length) {
        const index = handlers[eventName]
          .findIndex(handler => (handler === log.addEvent));
        handlers[eventName].splice(index, 1);
      }
    });
  },

  send(log) {
    const { impressionId, actionType, source, sourceId, events, startAt, duration } = log;
    const requestPrams = [];
    requestPrams.push(['impression_id', impressionId]);
    switch (source) {
      case 'dashboard':
        requestPrams.push(['dashboard_id', sourceId]);
        break;
      case 'slice':
        requestPrams.push(['slice_id', sourceId]);
        break;
      default:
        break;
    }
    let url = '/superset/log/';
    if (requestPrams.length) {
      url += '?' + requestPrams.map(([k, v]) => (k + '=' + v)).join('&');
    }
    const eventData = {};
    for (const eventName in events) {
      eventData[eventName] = [];
      events[eventName].forEach((event) => {
        eventData[eventName].push(event);
      });
    }

    $.ajax({
      url,
      method: 'POST',
      dataType: 'json',
      data: {
        source: 'client',
        type: actionType,
        started_time: startAt,
        duration,
        events: JSON.stringify(eventData),
      },
    });
  },

  getTimestamp() {
    return Math.round(window.performance.now());
  },
};

export class ActionLog {
  constructor({ impressionId, actionType, source, sourceId, eventNames, sendNow }) {
    this.impressionId = impressionId;
    this.source = source;
    this.sourceId = sourceId;
    this.actionType = actionType;
    this.eventNames = eventNames;
    this.sendNow = sendNow || false;
    this.startAt = 0;
    this.duration = 0;
    this.events = {};

    this.addEvent = this.addEvent.bind(this);
  }

  setAttribute(name, value) {
    this[name] = value;
  }

  addEvent(eventName, eventBody) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(eventBody);

    if (this.sendNow) {
      this.setAttribute('duration', new Date().getTime() - this.startAt);
      Logger.send(this);
      this.events = {};
    }
  }
}
