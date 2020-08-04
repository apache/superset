import {read, responseType} from 'vega-loader';
import {truthy} from 'vega-util';

export function parse(data, format) {
  const locale = this.locale();
  return read(data, format, locale.timeParse, locale.utcParse);
}

/**
 * Ingests new data into the dataflow. First parses the data using the
 * vega-loader read method, then pulses a changeset to the target operator.
 * @param {Operator} target - The Operator to target with ingested data,
 *   typically a Collect transform instance.
 * @param {*} data - The input data, prior to parsing. For JSON this may
 *   be a string or an object. For CSV, TSV, etc should be a string.
 * @param {object} format - The data format description for parsing
 *   loaded data. This object is passed to the vega-loader read method.
 * @returns {Dataflow}
 */
export function ingest(target, data, format) {
  data = this.parse(data, format);
  return this.pulse(target, this.changeset().insert(data));
}

/**
 * Request data from an external source, parse it, and return a Promise.
 * @param {string} url - The URL from which to load the data. This string
 *   is passed to the vega-loader load method.
 * @param {object} [format] - The data format description for parsing
 *   loaded data. This object is passed to the vega-loader read method.
 * @return {Promise} A Promise that resolves upon completion of the request.
 *   The resolved object contains the following properties:
 *   - data: an array of parsed data (or null upon error)
 *   - status: a code for success (0), load fail (-1), or parse fail (-2)
 */
export async function request(url, format) {
  const df = this;
  let status = 0, data;

  try {
    data = await df.loader().load(url, {
      context: 'dataflow',
      response: responseType(format && format.type)
    });
    try {
      data = df.parse(data, format);
    } catch (err) {
      status = -2;
      df.warn('Data ingestion failed', url, err);
    }
  } catch (err) {
    status = -1;
    df.warn('Loading failed', url, err);
  }

  return {data, status};
}

export async function preload(target, url, format) {
  const df = this,
        pending = df._pending || loadPending(df);

  pending.requests += 1;

  const res = await df.request(url, format);
  df.pulse(target, df.changeset().remove(truthy).insert(res.data || []));

  pending.done();
  return res;
}

function loadPending(df) {
  var pending = new Promise(function(a) { accept = a; }),
      accept;

  pending.requests = 0;

  pending.done = function() {
    if (--pending.requests === 0) {
      df._pending = null;
      accept(df);
    }
  };

  return (df._pending = pending);
}
