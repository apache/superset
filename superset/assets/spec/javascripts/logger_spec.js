import fetchMock from 'fetch-mock';

import { Logger, ActionLog } from '../../src/logger';

describe('ActionLog', () => {
  it('should be a constructor', () => {
    const newLogger = new ActionLog({});
    expect(newLogger instanceof ActionLog).toBe(true);
  });

  it(
    'should set the eventNames, impressionId, source, sourceId, and sendNow init parameters',
    () => {
      const eventNames = [];
      const impressionId = 'impressionId';
      const source = 'source';
      const sourceId = 'sourceId';
      const sendNow = true;

      const log = new ActionLog({ eventNames, impressionId, source, sourceId, sendNow });
      expect(log.eventNames).toBe(eventNames);
      expect(log.impressionId).toBe(impressionId);
      expect(log.source).toBe(source);
      expect(log.sourceId).toBe(sourceId);
      expect(log.sendNow).toBe(sendNow);
    },
  );

  it('should set attributes with the setAttribute method', () => {
    const log = new ActionLog({});
    expect(log.test).toBeUndefined();
    log.setAttribute('test', 'testValue');
    expect(log.test).toBe('testValue');
  });

  it('should track added events', () => {
    const log = new ActionLog({});
    const eventName = 'myEventName';
    const eventBody = { test: 'event' };
    expect(log.events[eventName]).toBeUndefined();

    log.addEvent(eventName, eventBody);
    expect(log.events[eventName]).toHaveLength(1);
    expect(log.events[eventName][0]).toMatchObject(eventBody);
    Logger.end(log);
  });
});

describe('Logger', () => {
  const logEndpoint = 'glob:*/superset/log/*';
  fetchMock.post(logEndpoint, 'success');
  afterEach(fetchMock.resetHistory);

  it('should add events when .append(eventName, eventBody) is called', () => {
    const eventName = 'testEvent';
    const eventBody = { test: 'event' };
    const log = new ActionLog({ eventNames: [eventName] });
    Logger.start(log);
    Logger.append(eventName, eventBody);
    expect(log.events[eventName]).toHaveLength(1);
    expect(log.events[eventName][0]).toMatchObject(eventBody);
    Logger.end(log);
  });

  describe('.send()', () => {
    const eventNames = ['test'];

    function setup(overrides = {}) {
      const log = new ActionLog({ eventNames, ...overrides });
      return log;
    }

    it('should POST an event to /superset/log/ when called', (done) => {
      const log = setup();
      Logger.start(log);
      Logger.append(eventNames[0], { test: 'event' });
      expect(log.events[eventNames[0]]).toHaveLength(1);
      Logger.end(log);

      setTimeout(() => {
        expect(fetchMock.calls(logEndpoint)).toHaveLength(1);
        done();
      }, 0);
    });

    it("should flush the log's events", () => {
      const log = setup();
      Logger.start(log);
      Logger.append(eventNames[0], { test: 'event' });
      const event = log.events[eventNames[0]][0];
      expect(event).toMatchObject({ test: 'event' });
      Logger.end(log);
      expect(log.events).toEqual({});
    });

    it(
      'should include ts, start_offset, event_name, impression_id, source, and source_id in every event',
      (done) => {
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

        setTimeout(() => {
          const calls = fetchMock.calls(logEndpoint);
          expect(calls).toHaveLength(1);
          const options = calls[0][1];
          const events = JSON.parse(options.body.get('events'));

          expect(events).toHaveLength(2);

          expect(events[0]).toMatchObject({
            key: 'value',
            event_name: 'event1',
            impression_id: config.impressionId,
            source: config.source,
            source_id: config.sourceId,
          });

          expect(events[1]).toMatchObject({
            foo: 'bar',
            event_name: 'event2',
            impression_id: config.impressionId,
            source: config.source,
            source_id: config.sourceId,
          });

          expect(typeof events[0].ts).toBe('number');
          expect(typeof events[1].ts).toBe('number');
          expect(typeof events[0].start_offset).toBe('number');
          expect(typeof events[1].start_offset).toBe('number');

          done();
        }, 0);
      },
    );

    it(
      'should send() a log immediately if .append() is called with sendNow=true',
      (done) => {
        const log = setup();
        Logger.start(log);
        Logger.append(eventNames[0], { test: 'event' }, true);

        setTimeout(() => {
          expect(fetchMock.calls(logEndpoint)).toHaveLength(1);
          Logger.end(log); // flush logs
          done();
        }, 0);
      },
    );
  });
});
