#!/usr/bin/env node
/* eslint-disable no-console */

const { execSync } = require('child_process');

function runBenchmark(command, label) {
  console.log(`\n🔄 Running ${label}...`);
  const start = performance.now();

  try {
    execSync(command, {
      stdio: 'pipe',
      maxBuffer: 1024 * 1024 * 10,
    });

    const end = performance.now();
    const duration = ((end - start) / 1000).toFixed(2);
    console.log(`✅ ${label} completed in ${duration}s`);
    return parseFloat(duration);
  } catch (error) {
    console.error(`❌ ${label} failed:`, error.message);
    return null;
  }
}

function calculateSpeedup(npmTime, bunTime) {
  const speedup = (npmTime / bunTime).toFixed(2);
  const percentFaster = (((npmTime - bunTime) / npmTime) * 100).toFixed(1);
  return { speedup, percentFaster };
}

console.log('🏁 Package Build Performance Benchmark');
console.log('='.repeat(50));

// Warm-up run (to ensure fair comparison)
console.log('\n📊 Warm-up run...');
execSync('npm run plugins:build', { stdio: 'ignore' });

// Run benchmarks
const runs = 3;
const npmTimes = [];
const bunTimes = [];

console.log(`\n📈 Running ${runs} benchmarks for each approach...\n`);

for (let i = 1; i <= runs; i += 1) {
  console.log(`\n--- Run ${i}/${runs} ---`);

  // Clean build directories first
  console.log('🧹 Cleaning build directories...');
  execSync('npm run plugins:clean', { stdio: 'ignore' });

  // NPM/Lerna build
  const npmTime = runBenchmark('npm run plugins:build-npm', 'NPM/Lerna build');
  if (npmTime) npmTimes.push(npmTime);

  // Clean again for fair comparison
  execSync('npm run plugins:clean', { stdio: 'ignore' });

  // Bun build
  const bunTime = runBenchmark('npm run plugins:build', 'Bun build');
  if (bunTime) bunTimes.push(bunTime);
}

// Calculate averages
const avgNpmTime = npmTimes.reduce((a, b) => a + b, 0) / npmTimes.length;
const avgBunTime = bunTimes.reduce((a, b) => a + b, 0) / bunTimes.length;

console.log(`\n${'='.repeat(60)}`);
console.log('📊 BENCHMARK RESULTS');
console.log('='.repeat(60));
console.log(`\n📦 NPM/Lerna Build:`);
console.log(`  Individual runs: ${npmTimes.map(t => `${t}s`).join(', ')}`);
console.log(`  Average time: ${avgNpmTime.toFixed(2)}s`);

console.log(`\n🚀 Bun Build:`);
console.log(`  Individual runs: ${bunTimes.map(t => `${t}s`).join(', ')}`);
console.log(`  Average time: ${avgBunTime.toFixed(2)}s`);

const { speedup, percentFaster } = calculateSpeedup(avgNpmTime, avgBunTime);
console.log(`\n⚡ Performance Improvement:`);
console.log(`  Speedup: ${speedup}x faster`);
console.log(`  Time saved: ${percentFaster}% faster`);
console.log(
  `  Absolute time saved: ${(avgNpmTime - avgBunTime).toFixed(2)}s per build`,
);

// Estimate daily/weekly/monthly time savings
const buildsPerDay = 10; // Estimated builds per developer per day
const workDaysPerMonth = 22;
const dailySaved = (((avgNpmTime - avgBunTime) * buildsPerDay) / 60).toFixed(1);
const monthlySaved = (
  ((avgNpmTime - avgBunTime) * buildsPerDay * workDaysPerMonth) /
  60
).toFixed(1);

console.log(`\n💰 Estimated Time Savings:`);
console.log(`  Per day (${buildsPerDay} builds): ${dailySaved} minutes`);
console.log(
  `  Per month (${workDaysPerMonth} work days): ${monthlySaved} minutes`,
);

// Check for optimization opportunities
console.log(`\n${'='.repeat(60)}`);
console.log('🔧 OPTIMIZATION RECOMMENDATIONS');
console.log('='.repeat(60));

// Check CPU cores
const cpus = require('os').cpus().length;

console.log(`\n💻 System Information:`);
console.log(`  Available CPU cores: ${cpus}`);

// Bun-specific optimizations
console.log(`\n🐰 Bun Optimization Options:`);
console.log(`  1. Increase parallelism: Currently using batches of 5`);
console.log(
  `     Try: Increase BATCH_SIZE in build-with-bun.js to ${Math.min(10, cpus)}`,
);
console.log(`  2. Use Bun's native TypeScript support instead of tsc`);
console.log(`  3. Consider using Bun's bundler for production builds`);
console.log(`  4. Enable Bun's built-in minification for smaller outputs`);

// General optimizations
console.log(`\n📦 General Build Optimizations:`);
console.log(`  1. Enable persistent caching between builds`);
console.log(`  2. Use incremental TypeScript compilation`);
console.log(`  3. Skip type checking in development builds`);
console.log(`  4. Consider using SWC or esbuild for transpilation`);
