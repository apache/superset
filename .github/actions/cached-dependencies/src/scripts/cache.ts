/**
 * Runner script to store/save caches by predefined configs.
 * Used in `scripts/bashlib.sh`.
 */
import { EnvVariable } from '../constants';

// To import `@actions/cache` modules safely, we must set GitHub event name to
// a invalid value, so actual runner code doesn't execute.
const originalEvent = process.env[EnvVariable.GitHubEventName];
process.env[EnvVariable.GitHubEventName] = 'CACHE_HACK';

import { run } from '../cache';

// then we restore the event name before the job actually runs
process.env[EnvVariable.GitHubEventName] = originalEvent;

// @ts-ignore
run(...process.argv.slice(2));
