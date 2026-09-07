/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more agreed to in writing, software
 * distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Timezone-aware strings carry an explicit UTC offset (`Z` or `±hh:mm`).
 * Rewriting them to a bare `Z` would relabel the wall-clock time as UTC,
 * shifting the instant; they are returned untouched. Timezone names
 * (`UTC`, `Europe/Helsinki`) are not valid ISO offsets and are still
 * stripped the historic way.
 */
const TS_REGEX_TZ_AWARE =
  /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}:\d{2}\.?\d*)(?:Z|[+-]\d{2}:?\d{2})$/;
export const TS_REGEX = /(\d{4}-\d{2}-\d{2})[\sT](\d{2}:\d{2}:\d{2}\.?\d*).*/;

export default function normalizeTimestamp(value: string): string {
  if (TS_REGEX_TZ_AWARE.test(value)) {
    return value;
  }
  const match = value.match(TS_REGEX);
  if (match) {
    return `${match[1]}T${match[2]}Z`;
  }
  return value;
}
