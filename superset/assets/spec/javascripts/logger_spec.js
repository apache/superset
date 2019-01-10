import $ from 'jquery';
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

    it("should flush the log's events", () => {
      const log = setup();
      Logger.start(log);
      Logger.append(eventNames[0], { test: 'event' });
      const event = log.events[eventNames[0]][0];
      expect(event).to.deep.include({ test: 'event' });
      Logger.end(log);
      expect(log.events).to.deep.equal({});
    });

    it('should include ts, start_offset, event_name, impression_id, source, and source_id in every event', () => {
      const config = {
        eventNames: ['event1', 'event2'],
        impressionId: 'impress_me',
        source: 'superset',
        sourceId: 'lolz',
      };
      const log = setup(config);

      Logger.start(log);
      Logger.append('event1', { key: 'value' });
      Logger.append('event2', { foo: 'bar' });
      Logger.end(log);

      const args = $.ajax.getCall(0).args[0];
      const events = JSON.parse(args.data.events);

      expect(events).to.have.length(2);
      expect(events[0]).to.deep.include({
        key: 'value',
        event_name: 'event1',
        impression_id: config.impressionId,
        source: config.source,
        source_id: config.sourceId,
      });
      expect(events[1]).to.deep.include({
        foo: 'bar',
        event_name: 'event2',
        impression_id: config.impressionId,
        source: config.source,
        source_id: config.sourceId,
      });
      expect(typeof events[0].ts).to.equal('number');
      expect(typeof events[1].ts).to.equal('number');
      expect(typeof events[0].start_offset).to.equal('number');
      expect(typeof events[1].start_offset).to.equal('number');
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
