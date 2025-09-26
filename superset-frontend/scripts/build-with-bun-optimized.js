#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Get optimization settings from environment or use smart defaults
const CPU_CORES = os.cpus().length;
const BATCH_SIZE = parseInt(process.env.BUN_BATCH_SIZE, 10) || 8; // Default to 8 for stability
const USE_BUN_TSC = process.env.USE_BUN_TSC === 'true';
const PARALLEL_BABEL = process.env.PARALLEL_BABEL !== 'false'; // Default true

console.log('🚀 Using Bun for faster builds (OPTIMIZED)!');
console.log(
  `⚙️  Settings: ${CPU_CORES} CPU cores, batch size: ${BATCH_SIZE}, Bun TSC: ${USE_BUN_TSC}`,
);

// Get all packages and plugins (excluding demo and generator packages)
const packagesDir = path.join(__dirname, '../packages');
const pluginsDir = path.join(__dirname, '../plugins');

function getPackagesFromDir(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter(name => {
      const fullPath = path.join(dir, name);
      // Skip demo and generator packages, and packages without src directory
      return (
        fs.statSync(fullPath).isDirectory() &&
        fs.existsSync(path.join(fullPath, 'package.json')) &&
        fs.existsSync(path.join(fullPath, 'src')) &&
        !name.includes('demo') &&
        !name.includes('generator')
      );
    })
    .map(name => ({
      name,
      path: path.join(dir, name),
    }));
}

const packages = [
  ...getPackagesFromDir(packagesDir),
  ...getPackagesFromDir(pluginsDir),
];

// Function to run babel with bun
async function runBabelWithBun(packageName, packagePath, outputDir) {
  return new Promise((resolve, reject) => {
    const args = [
      '--config-file=../../babel.config.js',
      'src',
      '--extensions',
      '.ts,.tsx,.js,.jsx',
      '--copy-files',
      '--out-dir',
      outputDir,
    ];

    const child = spawn('bunx', ['babel', ...args], {
      cwd: packagePath,
      stdio: 'pipe',
    });

    let output = '';
    child.stdout.on('data', data => {
      output += data;
    });
    child.stderr.on('data', data => {
      output += data;
    });

    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Babel failed for ${packageName}: ${output}`));
      } else {
        // Extract timing from babel output if available
        const timeMatch = output.match(/\((\d+)ms\)/);
        const time = timeMatch ? timeMatch[1] : 'N/A';
        resolve({ packageName, outputDir, time });
      }
    });
  });
}

// Function to run TypeScript with bun (experimental)
async function runTypeScriptWithBun(packageName, packagePath) {
  if (!USE_BUN_TSC) {
    // Fall back to standard tsc
    return new Promise(resolve => {
      try {
        execSync('../../scripts/tsc.sh --build', {
          cwd: packagePath,
          stdio: 'pipe',
        });
      } catch (error) {
        // Continue despite TypeScript errors
        console.warn(
          `  ⚠️  TypeScript had errors in ${packageName} (continuing anyway)`,
        );
      }
      resolve({ packageName });
    });
  }

  // Experimental: Use bun's TypeScript capabilities
  return new Promise((resolve, reject) => {
    const child = spawn('bunx', ['tsc', '--build'], {
      cwd: packagePath,
      stdio: 'pipe',
    });

    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`TypeScript failed for ${packageName}`));
      } else {
        resolve({ packageName });
      }
    });
  });
}

// Process packages in optimized batches
async function buildPackages() {
  const startTime = Date.now();

  console.log(
    `🏗️  Building ${packages.length} packages with batch size ${BATCH_SIZE}...\\n`,
  );

  // Build all packages
  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    const batch = packages.slice(i, i + BATCH_SIZE);

    console.log(
      `\\n📦 Building batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(packages.length / BATCH_SIZE)}: ${batch.map(p => p.name).join(', ')}...`,
    );

    // Process each package in the batch concurrently
    const batchPromises = batch.map(async pkg => {
      const packageName = pkg.name;
      const packagePath = pkg.path;

      // Run babel builds in parallel if enabled
      const babelPromises = [];

      console.log(`Building ${packageName}...`);

      if (PARALLEL_BABEL) {
        // Run lib and esm builds in parallel
        babelPromises.push(
          runBabelWithBun(packageName, packagePath, 'lib'),
          runBabelWithBun(packageName, packagePath, 'esm'),
        );
      } else {
        // Run sequentially
        await runBabelWithBun(packageName, packagePath, 'lib');
        await runBabelWithBun(packageName, packagePath, 'esm');
      }

      if (PARALLEL_BABEL) {
        const results = await Promise.all(babelPromises);
        results.forEach(r => {
          if (r.time !== 'N/A') {
            process.stdout.write(`  ${r.outputDir}: ${r.time}ms `);
          }
        });
      }

      // Run TypeScript
      await runTypeScriptWithBun(packageName, packagePath);

      console.log(`✅ ${packageName} built successfully`);
      return packageName;
    });

    try {
      await Promise.all(batchPromises);
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      process.exit(1);
    }
  }
  /* eslint-enable no-await-in-loop */

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(1);

  console.log(`\\n✨ All packages built successfully in ${totalTime}s`);
  console.log(
    `📊 Performance: ${(packages.length / totalTime).toFixed(2)} packages/second`,
  );

  // Show optimization tips if build is slow
  if (totalTime > 20) {
    console.log(`\\n💡 Optimization Tips:`);
    console.log(
      `   - Increase batch size: BUN_BATCH_SIZE=${BATCH_SIZE * 2} npm run plugins:build`,
    );
    if (!USE_BUN_TSC) {
      console.log(
        `   - Try Bun's TypeScript: USE_BUN_TSC=true npm run plugins:build`,
      );
    }
    if (BATCH_SIZE < CPU_CORES) {
      console.log(
        `   - You have ${CPU_CORES} cores but batch size is ${BATCH_SIZE}`,
      );
    }
  }
}

// Check if bun is installed
try {
  execSync('bun --version', { stdio: 'pipe' });
} catch {
  console.error(
    '❌ Bun is not installed. Please install it first: https://bun.sh',
  );
  process.exit(1);
}

// Run the build
buildPackages().catch(error => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
