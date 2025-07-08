class MemoryBenchmark {
    constructor() {
        this.wasmModule = null;
        this.memory = null;
        this.results = {};
        this.charts = {};
        
        this.init();
    }

    async init() {
        try {
            // Load the WebAssembly module
            const response = await fetch('../dist/main.wasm');
            const wasmBuffer = await response.arrayBuffer();
            const wasmModule = await WebAssembly.instantiate(wasmBuffer);
            
            this.wasmModule = wasmModule.instance;
            this.memory = this.wasmModule.exports.memory;
            
            console.log('WebAssembly module loaded successfully');
        } catch (error) {
            console.error('Failed to load WebAssembly module:', error);
            alert('Failed to load WebAssembly module. Make sure the WASM file is available.');
        }
    }

    // JavaScript implementations for comparison
    jsReverseCopy(data) {
        const result = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            result[i] = data[data.length - 1 - i];
        }
        return result;
    }

    jsReverseInPlace(data) {
        const arr = new Uint8Array(data);
        for (let i = 0; i < Math.floor(arr.length / 2); i++) {
            const temp = arr[i];
            arr[i] = arr[arr.length - 1 - i];
            arr[arr.length - 1 - i] = temp;
        }
        return arr;
    }

    jsXorBlocks(a, b) {
        const result = new Uint8Array(a.length);
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i] ^ b[i];
        }
        return result;
    }

    // WebAssembly function wrappers
    wasmReverseCopy(data) {
        const inputPtr = 0;
        const outputPtr = data.length + 16; // Add some padding
        
        // Copy input data to WASM memory
        const inputView = new Uint8Array(this.memory.buffer, inputPtr, data.length);
        inputView.set(data);
        
        // Call WASM function
        this.wasmModule.exports.reverse_mem_block_bytes_copy(inputPtr, data.length, outputPtr);
        
        // Copy result from WASM memory
        const outputView = new Uint8Array(this.memory.buffer, outputPtr, data.length);
        return new Uint8Array(outputView);
    }

    wasmReverseInPlace(data) {
        const ptr = 0;
        
        // Copy input data to WASM memory
        const view = new Uint8Array(this.memory.buffer, ptr, data.length);
        view.set(data);
        
        // Call WASM function
        this.wasmModule.exports.reverse_mem_block_in_place_simd(ptr, data.length);
        
        // Copy result from WASM memory
        return new Uint8Array(view);
    }

    wasmXorBlocks(a, b) {
        const aPtr = 0;
        const bPtr = a.length + 16; // Add padding
        const outputPtr = a.length + b.length + 32; // Add more padding
        
        // Copy input data to WASM memory
        const aView = new Uint8Array(this.memory.buffer, aPtr, a.length);
        const bView = new Uint8Array(this.memory.buffer, bPtr, b.length);
        aView.set(a);
        bView.set(b);
        
        // Call WASM function
        this.wasmModule.exports.xor_mem_blocks(aPtr, bPtr, a.length, outputPtr);
        
        // Copy result from WASM memory
        const outputView = new Uint8Array(this.memory.buffer, outputPtr, a.length);
        return new Uint8Array(outputView);
    }

    // Accuracy testing
    testAccuracy(dataSize = 1000) {
        const testData = new Uint8Array(dataSize);
        for (let i = 0; i < dataSize; i++) {
            testData[i] = Math.floor(Math.random() * 256);
        }

        const results = {};

        // Test reverse copy
        const jsReverseResult = this.jsReverseCopy(testData);
        const wasmReverseResult = this.wasmReverseCopy(testData);
        results.reverseCopy = this.arraysEqual(jsReverseResult, wasmReverseResult);

        // Test reverse in place
        const jsReverseInPlaceResult = this.jsReverseInPlace(testData);
        const wasmReverseInPlaceResult = this.wasmReverseInPlace(testData);
        results.reverseInPlace = this.arraysEqual(jsReverseInPlaceResult, wasmReverseInPlaceResult);

        // Test XOR
        const testData2 = new Uint8Array(dataSize);
        for (let i = 0; i < dataSize; i++) {
            testData2[i] = Math.floor(Math.random() * 256);
        }
        const jsXorResult = this.jsXorBlocks(testData, testData2);
        const wasmXorResult = this.wasmXorBlocks(testData, testData2);
        results.xor = this.arraysEqual(jsXorResult, wasmXorResult);

        return results;
    }

    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    // Performance benchmarking
    async benchmark(dataSize, iterations, warmupRuns) {
        const results = {
            reverseCopy: { js: [], wasm: [] },
            reverseInPlace: { js: [], wasm: [] },
            xor: { js: [], wasm: [] }
        };

        // Generate test data
        const testData = new Uint8Array(dataSize);
        for (let i = 0; i < dataSize; i++) {
            testData[i] = Math.floor(Math.random() * 256);
        }

        const testData2 = new Uint8Array(dataSize);
        for (let i = 0; i < dataSize; i++) {
            testData2[i] = Math.floor(Math.random() * 256);
        }

        // Warmup runs
        for (let i = 0; i < warmupRuns; i++) {
            this.jsReverseCopy(testData);
            this.wasmReverseCopy(testData);
            this.jsReverseInPlace(testData);
            this.wasmReverseInPlace(testData);
            this.jsXorBlocks(testData, testData2);
            this.wasmXorBlocks(testData, testData2);
        }

        // Actual benchmark runs
        const totalRuns = Object.keys(results).length * 2 * iterations;
        let currentRun = 0;

        // Reverse Copy benchmark
        for (let i = 0; i < iterations; i++) {
            const jsStart = performance.now();
            this.jsReverseCopy(testData);
            const jsEnd = performance.now();
            results.reverseCopy.js.push(jsEnd - jsStart);

            const wasmStart = performance.now();
            this.wasmReverseCopy(testData);
            const wasmEnd = performance.now();
            results.reverseCopy.wasm.push(wasmEnd - wasmStart);

            currentRun += 2;
            this.updateProgress(currentRun, totalRuns);
        }

        // Reverse In Place benchmark
        for (let i = 0; i < iterations; i++) {
            const jsStart = performance.now();
            this.jsReverseInPlace(testData);
            const jsEnd = performance.now();
            results.reverseInPlace.js.push(jsEnd - jsStart);

            const wasmStart = performance.now();
            this.wasmReverseInPlace(testData);
            const wasmEnd = performance.now();
            results.reverseInPlace.wasm.push(wasmEnd - wasmStart);

            currentRun += 2;
            this.updateProgress(currentRun, totalRuns);
        }

        // XOR benchmark
        for (let i = 0; i < iterations; i++) {
            const jsStart = performance.now();
            this.jsXorBlocks(testData, testData2);
            const jsEnd = performance.now();
            results.xor.js.push(jsEnd - jsStart);

            const wasmStart = performance.now();
            this.wasmXorBlocks(testData, testData2);
            const wasmEnd = performance.now();
            results.xor.wasm.push(wasmEnd - wasmStart);

            currentRun += 2;
            this.updateProgress(currentRun, totalRuns);
        }

        return this.calculateStats(results);
    }

    calculateStats(results) {
        const stats = {};
        
        for (const [functionName, data] of Object.entries(results)) {
            stats[functionName] = {
                js: this.calculateArrayStats(data.js),
                wasm: this.calculateArrayStats(data.wasm)
            };
        }
        
        return stats;
    }

    calculateArrayStats(array) {
        const sorted = array.slice().sort((a, b) => a - b);
        const mean = array.reduce((a, b) => a + b, 0) / array.length;
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        
        // Calculate standard deviation
        const variance = array.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / array.length;
        const stdDev = Math.sqrt(variance);
        
        return { mean, median, min, max, stdDev };
    }

    updateProgress(current, total) {
        const progress = (current / total) * 100;
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        if (progressFill && progressText) {
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `Running benchmark... ${Math.round(progress)}%`;
        }
    }

    displayResults(accuracyResults, performanceResults) {
        const resultsContainer = document.getElementById('results');
        resultsContainer.innerHTML = '';

        const functions = [
            { name: 'reverseCopy', title: 'Reverse Memory Block (Copy)', description: 'Reverses memory block using SIMD, not in-place' },
            { name: 'reverseInPlace', title: 'Reverse Memory Block (In-Place)', description: 'Reverses memory block in-place using SIMD' },
            { name: 'xor', title: 'XOR Memory Blocks', description: 'XORs two memory blocks using SIMD' }
        ];

        functions.forEach(func => {
            const card = document.createElement('div');
            card.className = 'function-card';
            
            const accuracy = accuracyResults[func.name];
            const perf = performanceResults[func.name];
            
            const jsSpeedup = perf.js.mean / perf.wasm.mean;
            const wasmSpeedup = perf.wasm.mean / perf.js.mean;
            
            card.innerHTML = `
                <h3 class="function-title">${func.title}</h3>
                <p style="color: #CFD6EA; opacity: 0.8; margin-bottom: 1rem;">${func.description}</p>
                
                <div class="metric">
                    <span class="metric-label">
                        <span class="accuracy-indicator ${accuracy ? 'accuracy-correct' : 'accuracy-incorrect'}"></span>
                        Accuracy
                    </span>
                    <span class="metric-value">${accuracy ? 'Correct' : 'Incorrect'}</span>
                </div>
                
                <div class="metric">
                    <span class="metric-label">JavaScript Mean (ms)</span>
                    <span class="metric-value">${perf.js.mean.toFixed(3)}</span>
                </div>
                
                <div class="metric">
                    <span class="metric-label">WebAssembly Mean (ms)</span>
                    <span class="metric-value">${perf.wasm.mean.toFixed(3)}</span>
                </div>
                
                <div class="metric">
                    <span class="metric-label">Speedup Factor</span>
                    <span class="metric-value">${jsSpeedup.toFixed(2)}x faster</span>
                </div>
                
                <div class="metric">
                    <span class="metric-label">JavaScript Std Dev</span>
                    <span class="metric-value">${perf.js.stdDev.toFixed(3)}</span>
                </div>
                
                <div class="metric">
                    <span class="metric-label">WebAssembly Std Dev</span>
                    <span class="metric-value">${perf.wasm.stdDev.toFixed(3)}</span>
                </div>
            `;
            
            resultsContainer.appendChild(card);
        });
    }

    createCharts(performanceResults) {
        // Destroy existing charts if they exist
        if (this.charts.performance) {
            this.charts.performance.destroy();
        }
        if (this.charts.speedup) {
            this.charts.speedup.destroy();
        }

        const functions = ['reverseCopy', 'reverseInPlace', 'xor'];
        const labels = ['Reverse Copy', 'Reverse In-Place', 'XOR'];
        
        // Performance comparison chart
        const performanceCtx = document.getElementById('performanceChart').getContext('2d');
        this.charts.performance = new Chart(performanceCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'JavaScript (ms)',
                        data: functions.map(f => performanceResults[f].js.mean),
                        backgroundColor: 'rgba(93, 93, 129, 0.8)',
                        borderColor: '#5D5D81',
                        borderWidth: 1
                    },
                    {
                        label: 'WebAssembly (ms)',
                        data: functions.map(f => performanceResults[f].wasm.mean),
                        backgroundColor: 'rgba(163, 196, 188, 0.8)',
                        borderColor: '#A3C4BC',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(93, 93, 129, 0.3)'
                        },
                        ticks: {
                            color: '#CFD6EA'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(93, 93, 129, 0.3)'
                        },
                        ticks: {
                            color: '#CFD6EA'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#CFD6EA'
                        }
                    }
                }
            }
        });

        // Speedup chart
        const speedupCtx = document.getElementById('speedupChart').getContext('2d');
        this.charts.speedup = new Chart(speedupCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Speedup Factor (JS/WASM)',
                    data: functions.map(f => performanceResults[f].js.mean / performanceResults[f].wasm.mean),
                    backgroundColor: 'rgba(163, 196, 188, 0.8)',
                    borderColor: '#A3C4BC',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(93, 93, 129, 0.3)'
                        },
                        ticks: {
                            color: '#CFD6EA'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(93, 93, 129, 0.3)'
                        },
                        ticks: {
                            color: '#CFD6EA'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#CFD6EA'
                        }
                    }
                }
            }
        });
    }

    async runBenchmark() {
        if (!this.wasmModule) {
            alert('WebAssembly module not loaded. Please wait and try again.');
            return;
        }

        const dataSize = parseInt(document.getElementById('dataSize').value);
        const iterations = parseInt(document.getElementById('iterations').value);
        const warmupRuns = parseInt(document.getElementById('warmupRuns').value);

        // Show progress
        document.querySelector('.progress-container').style.display = 'block';
        document.getElementById('runBenchmark').disabled = true;

        try {
            // Test accuracy first
            console.log('Testing accuracy...');
            const accuracyResults = this.testAccuracy(Math.min(dataSize, 10000));
            
            // Run performance benchmark
            console.log('Running performance benchmark...');
            const performanceResults = await this.benchmark(dataSize, iterations, warmupRuns);

            // Display results
            this.displayResults(accuracyResults, performanceResults);
            
            // Show and create charts
            document.getElementById('charts').style.display = 'grid';
            this.createCharts(performanceResults);

            console.log('Benchmark completed successfully');
        } catch (error) {
            console.error('Benchmark failed:', error);
            alert('Benchmark failed: ' + error.message);
        } finally {
            // Hide progress
            document.querySelector('.progress-container').style.display = 'none';
            document.getElementById('runBenchmark').disabled = false;
        }
    }
}

// Initialize benchmark when page loads
let benchmark;
document.addEventListener('DOMContentLoaded', async () => {
    benchmark = new MemoryBenchmark();
    
    // Set up event listener for run button
    document.getElementById('runBenchmark').addEventListener('click', () => {
        benchmark.runBenchmark();
    });
});
