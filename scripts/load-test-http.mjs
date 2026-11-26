#!/usr/bin/env node

/** Bounded GET-only load runner. Never targets a mutating endpoint. */

const target = process.env.LOAD_TEST_URL;
if (!target) {
  console.error('Set LOAD_TEST_URL to an isolated, approved HTTP GET endpoint.');
  process.exit(2);
}

const requestCount = Number.parseInt(process.env.LOAD_TEST_REQUESTS ?? '200', 10);
const stages = (process.env.LOAD_TEST_CONCURRENCY ?? '1,10,50,100')
  .split(',')
  .map((value) => Number.parseInt(value.trim(), 10));
const timeoutMs = Number.parseInt(process.env.LOAD_TEST_TIMEOUT_MS ?? '10000', 10);
const maxResponseBytes = Number.parseInt(process.env.LOAD_TEST_MAX_RESPONSE_BYTES ?? '1048576', 10);

if (
  !Number.isSafeInteger(requestCount) ||
  requestCount < 1 ||
  requestCount > 10000 ||
  stages.some((value) => !Number.isSafeInteger(value) || value < 1 || value > 100) ||
  !Number.isSafeInteger(timeoutMs) ||
  timeoutMs < 100 ||
  timeoutMs > 60000 ||
  !Number.isSafeInteger(maxResponseBytes) ||
  maxResponseBytes < 1 ||
  maxResponseBytes > 10485760
) {
  console.error(
    'Invalid bounds: requests 1..10000, concurrency 1..100, timeout 100..60000ms, body 1..10MiB.',
  );
  process.exit(2);
}

const url = new URL(target);
if (!new Set(['http:', 'https:']).has(url.protocol)) {
  console.error('LOAD_TEST_URL must use HTTP or HTTPS.');
  process.exit(2);
}

async function runStage(concurrency) {
  const latencies = [];
  const failures = [];
  let next = 0;
  const started = performance.now();

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= requestCount) return;
      const requestStarted = performance.now();
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { accept: 'text/html,application/json', 'cache-control': 'no-cache' },
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'manual',
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`HTTP ${response.status}`);
        }
        const reader = response.body?.getReader();
        let bytes = 0;
        if (reader) {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > maxResponseBytes) {
              await reader.cancel();
              throw new Error(`response exceeded ${maxResponseBytes} bytes`);
            }
          }
        }
        latencies.push(performance.now() - requestStarted);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, worker));
  const elapsedSeconds = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  const percentile = (p) =>
    latencies.length ? latencies[Math.ceil(p * latencies.length) - 1] : null;

  return {
    concurrency,
    requests: requestCount,
    successes: latencies.length,
    failures: failures.length,
    elapsedSeconds: Number(elapsedSeconds.toFixed(3)),
    requestsPerSecond: Number((latencies.length / elapsedSeconds).toFixed(2)),
    latencyMs: {
      p50: percentile(0.5) === null ? null : Number(percentile(0.5).toFixed(2)),
      p95: percentile(0.95) === null ? null : Number(percentile(0.95).toFixed(2)),
      p99: percentile(0.99) === null ? null : Number(percentile(0.99).toFixed(2)),
    },
    failureSamples: failures.slice(0, 5),
  };
}

const results = [];
for (const concurrency of stages) {
  results.push(await runStage(concurrency));
}

console.log(
  JSON.stringify(
    {
      target: `${url.origin}${url.pathname}`,
      method: 'GET',
      stages: results,
    },
    null,
    2,
  ),
);
