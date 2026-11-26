# Phase 4.7 performance and capacity

## Configuration defaults

| Setting                   | Default |
| ------------------------- | ------: |
| Maximum original          | 500 MiB |
| Multipart threshold       |  32 MiB |
| Part size                 |  16 MiB |
| Concurrent parts per file |       3 |
| Concurrent files          |       2 |
| ZIP input limit           |  10 GiB |
| ZIP photo limit           |     250 |

Originals are uploaded directly to object storage. Browser memory is bounded by hashing/part slices.
Derivative generation streams the original to an isolated temporary file, then produces thumbnail,
preview, and AI derivatives once. Redis jobs contain IDs and object keys, not image bytes. AI
processing reads only the bounded derivative.

## Local verification evidence — 2026-11-20

These measurements were captured against the local Docker Compose stack on Windows using the
repository smoke scripts and local loopback storage. They prove the transport path; they are not
production capacity claims.

| Scenario                        |                                  Result |
| ------------------------------- | --------------------------------------: |
| 34 MiB multipart original       |            3 parts, 1.29 s, 26.39 MiB/s |
| 500 MiB multipart original      |           32 parts, 5.45 s, 91.80 MiB/s |
| 500 MiB client process peak RSS |                               176.4 MiB |
| Real face match + selected ZIP  | 1 authorized match; ZIP ready in 0.56 s |

The 500 MiB test used a valid JPEG prefix with generated padding to exercise hashing, presigned
multipart PUTs, server-side part verification, completion, and photo persistence without requiring
a 500 MiB fixture in source control. It does not measure image decoding. Peak RSS is the Node smoke
client only; browser, API worker, storage, CPU, and disk metrics were not captured.

## Evidence and benchmark policy

Automated tests validate limits, authorization, multipart state, checksum signing, selection, and
streaming behavior. A sparse or generated 500 MiB file is suitable for transport testing but not
decoder benchmarking. Record storage provider, machine, network, file set, elapsed time, peak
browser/worker memory, CPU, queue time, and failure count for every real benchmark.

Before production, repeat the benchmark on production-equivalent hardware and networking. Test 100,
1,000, and 5,000 JPEG imports; supported and unsupported RAW samples from each camera family; one
and multiple 500 MiB originals; 10/100-photo ZIPs; interruption/resume; expiration; and
range-capable individual downloads against the chosen production provider.
