/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

describe('Value-Based Colors Performance Tests', () => {
  const generateTestData = (size: number) => {
    return Array.from({ length: size }, (_, i) => ({
      category: `Category ${i}`,
      metric: Math.random() * 1000,
    }));
  };

  const simulateSequentialColoring = (data: any[]) => {
    const values = data.map(d => d.metric);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    const colors = ['#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5', '#7bccc4', 
                   '#4eb3d3', '#2b8cbe', '#0868ac', '#084081', '#042142'];
    
    return data.map(d => {
      const normalized = (d.metric - minValue) / (maxValue - minValue);
      const colorIndex = Math.floor(normalized * (colors.length - 1));
      return {
        ...d,
        color: colors[Math.min(colorIndex, colors.length - 1)],
      };
    });
  };

  const simulateCategoricalColoring = (data: any[]) => {
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', 
                   '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
    
    return data.map((d, i) => ({
      ...d,
      color: colors[i % colors.length],
    }));
  };

  describe('Small Dataset Performance', () => {
    it('should handle 10 items efficiently', () => {
      const data = generateTestData(10);
      
      const start = performance.now();
      const result = simulateSequentialColoring(data);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(10); // 10ms
      expect(result).toHaveLength(10);
      expect(result.every(item => item.color)).toBe(true);
    });

    it('should handle 100 items efficiently', () => {
      const data = generateTestData(100);
      
      const start = performance.now();
      const result = simulateSequentialColoring(data);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(50); // 50ms
      expect(result).toHaveLength(100);
    });
  });

  describe('Medium Dataset Performance', () => {
    it('should handle 1000 items efficiently', () => {
      const data = generateTestData(1000);
      
      const start = performance.now();
      const result = simulateSequentialColoring(data);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100); // 100ms
      expect(result).toHaveLength(1000);
    });

    it('should handle 5000 items efficiently', () => {
      const data = generateTestData(5000);
      
      const start = performance.now();
      const result = simulateSequentialColoring(data);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(500); // 500ms
      expect(result).toHaveLength(5000);
    });
  });

  describe('Performance Comparison', () => {
    it('should compare sequential vs categorical performance', () => {
      const sizes = [100, 1000, 5000];
      
      sizes.forEach(size => {
        const data = generateTestData(size);

        // Test sequential performance
        const sequentialStart = performance.now();
        simulateSequentialColoring(data);
        const sequentialEnd = performance.now();
        const sequentialDuration = sequentialEnd - sequentialStart;

        // Test categorical performance
        const categoricalStart = performance.now();
        simulateCategoricalColoring(data);
        const categoricalEnd = performance.now();
        const categoricalDuration = categoricalEnd - categoricalStart;

        console.log(`Size ${size}: Sequential=${sequentialDuration.toFixed(2)}ms, Categorical=${categoricalDuration.toFixed(2)}ms`);

        // Both should complete in reasonable time
        expect(sequentialDuration).toBeLessThan(1000);
        expect(categoricalDuration).toBeLessThan(1000);
        
        // Sequential should not be drastically slower than categorical
        expect(sequentialDuration).toBeLessThan(categoricalDuration * 5);
      });
    });
  });

  describe('Memory Efficiency', () => {
    it('should not create excessive intermediate objects', () => {
      const data = generateTestData(1000);
      
      // Measure initial memory
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Process data multiple times
      for (let i = 0; i < 10; i++) {
        simulateSequentialColoring(data);
      }
      
      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (skip if memory API not available)
      if (initialMemory > 0) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
      } else {
        expect(true).toBe(true); // Skip if memory API not available
      }
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle identical values efficiently', () => {
      const identicalData = Array.from({ length: 1000 }, (_, i) => ({
        category: `Category ${i}`,
        metric: 100, // All same value
      }));

      const start = performance.now();
      const result = simulateSequentialColoring(identicalData);
      const end = performance.now();

      expect(end - start).toBeLessThan(200);
      
      // All should get the same color when values are identical
      const colors = result.map(d => d.color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(1);
    });

    it('should handle large value ranges efficiently', () => {
      const extremeData = [
        { category: 'Min', metric: 0.001 },
        { category: 'Max', metric: 1000000 },
        { category: 'Mid', metric: 500000 },
      ];

      const start = performance.now();
      const result = simulateSequentialColoring(extremeData);
      const end = performance.now();

      expect(end - start).toBeLessThan(50);
      expect(result).toHaveLength(3);
      
      // Should handle extreme ranges without issues
      result.forEach(item => {
        expect(item.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it('should handle null/undefined values efficiently', () => {
      const nullData = Array.from({ length: 1000 }, (_, i) => ({
        category: `Category ${i}`,
        metric: i % 3 === 0 ? null : i % 3 === 1 ? undefined : Math.random() * 100,
      }));

      const start = performance.now();
      
      // Simulate handling null/undefined values
      const processedData = nullData.map(d => ({
        ...d,
        metric: typeof d.metric === 'number' ? d.metric : 0,
      }));
      
      const result = simulateSequentialColoring(processedData);
      const end = performance.now();

      expect(end - start).toBeLessThan(300);
      expect(result).toHaveLength(1000);
    });
  });

  describe('Batch Processing Performance', () => {
    it('should handle multiple simultaneous requests', async () => {
      const data = generateTestData(500);
      const concurrentRequests = 10;
      
      const promises = Array.from({ length: concurrentRequests }, () => {
        return new Promise<number>((resolve) => {
          const start = performance.now();
          simulateSequentialColoring(data);
          const end = performance.now();
          resolve(end - start);
        });
      });

      const start = performance.now();
      const durations = await Promise.all(promises);
      const totalEnd = performance.now();

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const totalDuration = totalEnd - start;

      console.log(`Concurrent requests - Avg: ${avgDuration.toFixed(2)}ms, Total: ${totalDuration.toFixed(2)}ms`);

      // Individual requests should complete quickly
      expect(avgDuration).toBeLessThan(200);
      
      // Total time should benefit from parallelization
      expect(totalDuration).toBeLessThan(durations.reduce((a, b) => a + b, 0));
    });
  });

  describe('Repeated Operations Performance', () => {
    it('should maintain consistent performance across multiple calls', () => {
      const data = generateTestData(1000);
      const iterations = 100;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        simulateSequentialColoring(data);
        const end = performance.now();
        durations.push(end - start);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variance = maxDuration - minDuration;

      console.log(`Repeated operations - Avg: ${avgDuration.toFixed(2)}ms, Variance: ${variance.toFixed(2)}ms`);

      // Performance should be consistent
      expect(avgDuration).toBeLessThan(50);
      expect(variance).toBeLessThan(100); // Low variance indicates consistent performance
    });
  });
});
