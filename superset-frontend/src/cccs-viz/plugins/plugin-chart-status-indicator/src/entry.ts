/**
 * The entry point where the chart is registered.
 * This file shouldn't need to change unless you're adding more charts.
 */

import Chart from './chart';

// configure the chart with the package name from package.json
new Chart().configure({ key: process.env.PACKAGE_NAME }).register();
