# Performance benchmark status

## Measured model inference

Phase 5.2A measured embedding-only CPU performance on the development face-ai container: AuraFace mean 77.01 ms / P95 88.54 ms / 12.98 faces/s; SFace mean 8.46 ms / P95 10.63 ms / 118.19 faces/s. These are not full image indexing rates and do not include decode, detection, alignment, database, or storage. The environment's approximate 7.685 GiB available memory is not the target server's 24 GB configuration.

## Not measured

No application-level load test has established upload, indexing, concurrent search, gallery, ZIP, database, disk or network throughput for 1k/5k/10k photos or 25k faces. Do not claim these capacities.

## Bounded web smoke load

Added `scripts/load-test-http.mjs`, a repeatable GET-only runner with bounded request count, concurrency (maximum 100), timeout and response size. It reports P50/P95/P99, throughput, successes and errors. It refuses missing/non-HTTP targets and never sends mutation requests.

Ran sequentially against an isolated production web image container limited to 1 CPU and 768 MiB; the only target was `GET /`, with 200 requests in each stage. No application data volumes were mounted.

| Concurrency | Success / errors | Throughput (req/s) | P50 (ms) | P95 (ms) | P99 (ms) |
| ----------: | ---------------: | -----------------: | -------: | -------: | -------: |
|           1 |          200 / 0 |             292.04 |     3.02 |     4.72 |     5.88 |
|          10 |          200 / 0 |             375.37 |    13.94 |    73.58 |    86.12 |
|          50 |          200 / 0 |             430.70 |    65.54 |   451.42 |   460.12 |
|         100 |          200 / 0 |             462.52 |   115.26 |   378.53 |   387.38 |

This is a single local web-root smoke run, not a guest journey or service-capacity result. It gives no evidence for search, uploads, indexing, gallery pagination, ZIP generation, database latency, queue backlog, or image/object delivery. There are no verified claims for 10/50/100 concurrent guests or the specified photo/face counts. Docker ran on this development machine's WSL2 engine with 7.685 GiB available memory; production hardware performance cannot be inferred.
