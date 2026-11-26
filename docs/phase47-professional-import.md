# Phase 4.7 professional import

## Workflow

The event upload workspace accepts ordinary file selection, drag and drop, and user-authorized
folder selection. `showDirectoryPicker()` is preferred; a `webkitdirectory` input is used as the
fallback. Browsers cannot detect an SD card automatically, so the interface asks the photographer
to connect a reader and select `DCIM` or another folder.

Files are scanned incrementally. SHA-256 is computed with a streaming WebAssembly hash over 16 MiB
slices; original bytes are never stored in React state or localStorage. Files at or above 32 MiB use
multipart upload with 16 MiB parts, three concurrent parts, and two concurrent files. Part state is
read back from object storage before resume. Pause aborts active requests without aborting the
multipart upload; cancel explicitly aborts it.

## Limits and formats

`MAX_ORIGINAL_PHOTO_BYTES` defaults to 524,288,000 bytes (500 MiB). JPEG, PNG, and WebP generate
display, thumbnail, and AI derivatives. CR2, CR3, NEF, ARW, DNG, and RAF originals are accepted only
after signature validation. Decoding depends on the deployed libvips build: an undecodable RAW
original is preserved, while derivative and face-indexing status becomes `UNSUPPORTED`/failed. The
system does not claim universal RAW support.

| Format                        | Original storage | Signature validation | Default container preview |
| ----------------------------- | ---------------- | -------------------- | ------------------------- |
| JPEG/PNG/WebP                 | Yes              | Yes                  | Yes                       |
| CR2/NEF/ARW/DNG (TIFF family) | Yes              | TIFF header          | Deployment-dependent      |
| CR3                           | Yes              | ISO BMFF CRX brand   | Deployment-dependent      |
| RAF                           | Yes              | Fujifilm RAW header  | Deployment-dependent      |

## Recovery

The API persists upload ID, part size, expiry, content hash, and object key. A refresh can recover
server-side part state, but browsers usually require the user to reselect the same file unless a
retained File System Access handle remains authorized. Recovery verifies size and SHA-256 before
reusing the upload session.
