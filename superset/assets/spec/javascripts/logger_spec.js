import $ from 'jquery';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import { Logger, ActionLog } from '../../src/logger';

describe('ActionLog', () => {
  it('should be a constructor', () => {
    const newLogger = new ActionLog({});
    expect(newLogger instanceof ActionLog).to.equal(true);
  });

  it('should set the eventNames, impressionId, source, sourceId, and sendNow init parameters', () => {
    const eventNames = [];
    const impressionId = 'impressionId';
    const source = 'source';
    const sourceId = 'sourceId';
    const sendNow = true;

    const log = new ActionLog({ eventNames, impressionId, source, sourceId, sendNow });
    expect(log.eventNames).to.equal(eventNames);
    expect(log.impressionId).to.equal(impressionId);
    expect(log.source).to.equal(source);
    expect(log.sourceId).to.equal(sourceId);
    expect(log.sendNow).to.equal(sendNow);
  });

  it('should set attributes with the setAttribute method', () => {
    const log = new ActionLog({});
    expect(log.test).to.equal(undefined);
    log.setAttribute('test', 'testValue');
    expect(log.test).to.equal('testValue');
  });

  it('should track added events', () => {
    const log = new ActionLog({});
    const eventName = 'myEventName';
    const eventBody = { test: 'event' };
    expect(log.events[eventName]).to.equal(undefined);

    log.addEvent(eventName, eventBody);
    expect(log.events[eventName]).to.have.length(1);
    expect(log.events[eventName][0]).to.deep.include(eventBody);
  });
});

describe('Logger', () => {
  it('should set a startAt on the passed ActionLog when start is called', () => {
    const log = new ActionLog({ eventNames: [] });
    sinon.spy(log, 'setAttribute');
    Logger.start(log);
    expect(log.setAttribute.calledOnce).to.equal(true);
    Logger.end(log);
  });

  it('should add events when .append(eventName, eventBody) is called', () => {
    const eventName = 'testEvent';
    const eventBody = { test: 'event' };
    const log = new ActionLog({ eventNames: [eventName] });
    Logger.start(log);
    Logger.append(eventName, eventBody);
    expect(log.events[eventName]).to.have.length(1);
    expect(log.events[eventName][0]).to.deep.include(eventBody);
    Logger.end(log);
  });

  describe('.send()', () => {
    beforeEach(() => {
      sinon.spy($, 'ajax');
    });
    afterEach(() => {
      $.ajax.restore();
    });

    const eventNames = ['test'];

    function setup(overrides = {}) {
      const log = new ActionLog({ eventNames, ...overrides });
      return log;
    }

    it('should POST an event to /superset/log/ when called', () => {
      const log = setup();
      Logger.start(log);
      Logger.append(eventNames[0], { test: 'event' });
      expect(log.events[eventNames[0]]).to.have.length(1);
      Logger.end(log);
      expect($.ajax.calledOnce).to.equal(true);
      const args = $.ajax.getCall(0).args[0];
      expect(args.url).to.equal('/superset/log/');
      expect(args.method).to.equal('POST');
    });

    it('should include the logger source, sourceId, impressionId, and events in the POST', () => {
      const params = { source: 'source', impressionId: 'impression', sourceId: 'sourceId' };
      const log = setup(params);
      Logger.start(log);
      Logger.append(eventNames[0], { test: 'event' });
      Logger.end(log);
      const args = $.ajax.getCall(0).args[0];
      expect(args.data.source).to.equal(params.source);
      expect(args.data.source_id).to.equal(params.sourceId);
      expect(args.data.impression_id).to.equal(params.impressionId);
      expect(typeof args.data.events).to.equal('string');
    });

    it("should flush the log's events", () => {
      const log = setup();
      Logger.start(log);
      Logger.append(eventNames[0], { test: 'event' });
      const event = log.events[eventNames[0]][0];
      expect(event).to.deep.include({ test: 'event' });
      Logger.end(log);
      expect(log.events).to.deep.equal({});
    });

    it('should include event_name and impression_id in every event', () => {
      const log = setup({ eventNames: ['test1', 'test2'], impressionId: 'id' });
      Logger.start(log);
      Logger.append('test1', { test1: 'event' });
      Logger.append('test2', { test2: 'event' });
      Logger.end(log);
      const args = $.ajax.getCall(0).args[0];
      const events = JSON.parse(args.data.events);
      expect(events).to.have.length(2);
      expect(events[0]).to.deep.include({
        test1: 'event',
        event_name: 'test1',
        impression_id: 'id',
      });
      expect(events[1]).to.deep.include({
        test2: 'event',
        event_name: 'test2',
        impression_id: 'id',
      });
    });

    it('should send() a log immediately if .append() is called with sendNow=true', () => {
      const log = setup();
      Logger.start(log);
      Logger.append(eventNames[0], { test: 'event' }, true);
      expect($.ajax.calledOnce).to.equal(true);
      Logger.end(log);
    });
  });
});
