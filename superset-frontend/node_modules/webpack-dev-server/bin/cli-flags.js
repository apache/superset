'use strict';

const ADVANCED_GROUP = 'Advanced options:';
const DISPLAY_GROUP = 'Stats options:';
const SSL_GROUP = 'SSL options:';
const CONNECTION_GROUP = 'Connection options:';
const RESPONSE_GROUP = 'Response options:';
const BASIC_GROUP = 'Basic options:';

module.exports = {
  devServer: [
    {
      name: 'bonjour',
      type: Boolean,
      describe: 'Broadcasts the server via ZeroConf networking on start',
    },
    {
      name: 'lazy',
      type: Boolean,
      describe: 'Lazy',
    },
    {
      name: 'liveReload',
      type: Boolean,
      defaultValue: true,
      describe: 'Enables/Disables live reloading on changing files',
    },
    {
      name: 'serveIndex',
      type: Boolean,
      describe: 'Enables/Disables serveIndex middleware',
      defaultValue: true,
    },
    {
      name: 'inline',
      type: Boolean,
      defaultValue: true,
      describe:
        'Inline mode (set to false to disable including client scripts like livereload)',
    },
    {
      name: 'profile',
      type: Boolean,
      describe: 'Print compilation profile data for progress steps',
    },
    {
      name: 'progress',
      type: Boolean,
      describe: 'Print compilation progress in percentage',
      group: BASIC_GROUP,
    },
    {
      name: 'hot-only',
      type: Boolean,
      describe: 'Do not refresh page if HMR fails',
      group: ADVANCED_GROUP,
    },
    {
      name: 'stdin',
      type: Boolean,
      describe: 'close when stdin ends',
    },
    {
      name: 'open',
      type: String,
      describe:
        'Open the default browser, or optionally specify a browser name',
    },
    {
      name: 'useLocalIp',
      type: Boolean,
      describe: 'Open default browser with local IP',
    },
    {
      name: 'open-page',
      type: String,
      describe: 'Open default browser with the specified page',
    },
    {
      name: 'client-log-level',
      type: String,
      group: DISPLAY_GROUP,
      defaultValue: 'info',
      describe:
        'Log level in the browser (trace, debug, info, warn, error or silent)',
    },
    {
      name: 'https',
      type: Boolean,
      group: SSL_GROUP,
      describe: 'HTTPS',
    },
    {
      name: 'http2',
      type: Boolean,
      group: SSL_GROUP,
      describe: 'HTTP/2, must be used with HTTPS',
    },
    {
      name: 'key',
      type: String,
      describe: 'Path to a SSL key.',
      group: SSL_GROUP,
    },
    {
      name: 'cert',
      type: String,
      describe: 'Path to a SSL certificate.',
      group: SSL_GROUP,
    },
    {
      name: 'cacert',
      type: String,
      describe: 'Path to a SSL CA certificate.',
      group: SSL_GROUP,
    },
    {
      name: 'pfx',
      type: String,
      describe: 'Path to a SSL pfx file.',
      group: SSL_GROUP,
    },
    {
      name: 'pfx-passphrase',
      type: String,
      describe: 'Passphrase for pfx file.',
      group: SSL_GROUP,
    },
    {
      name: 'content-base',
      type: String,
      describe: 'A directory or URL to serve HTML content from.',
      group: RESPONSE_GROUP,
    },
    {
      name: 'watch-content-base',
      type: Boolean,
      describe: 'Enable live-reloading of the content-base.',
      group: RESPONSE_GROUP,
    },
    {
      name: 'history-api-fallback',
      type: Boolean,
      describe: 'Fallback to /index.html for Single Page Applications.',
      group: RESPONSE_GROUP,
    },
    {
      name: 'compress',
      type: Boolean,
      describe: 'Enable gzip compression',
      group: RESPONSE_GROUP,
    },
    // findPort is currently not set up
    {
      name: 'port',
      type: Number,
      describe: 'The port',
      group: CONNECTION_GROUP,
    },
    {
      name: 'disable-host-check',
      type: Boolean,
      describe: 'Will not check the host',
      group: CONNECTION_GROUP,
    },
    {
      name: 'socket',
      type: String,
      describe: 'Socket to listen',
      group: CONNECTION_GROUP,
    },
    {
      name: 'public',
      type: String,
      describe: 'The public hostname/ip address of the server',
      group: CONNECTION_GROUP,
    },
    {
      name: 'host',
      type: String,
      describe: 'The hostname/ip address the server will bind to',
      group: CONNECTION_GROUP,
    },
    // use command-line-args "multiple" option, allowing the usage: --allowed-hosts host1 host2 host3
    // instead of the old, comma-separated syntax: --allowed-hosts host1,host2,host3
    {
      name: 'allowed-hosts',
      type: String,
      describe:
        'A list of hosts that are allowed to access the dev server, separated by spaces',
      group: CONNECTION_GROUP,
      multiple: true,
    },
  ],
};
