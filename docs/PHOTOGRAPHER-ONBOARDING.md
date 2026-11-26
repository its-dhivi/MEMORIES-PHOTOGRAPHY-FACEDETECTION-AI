# Photographer onboarding

This guide covers the current Memories workflow. Before onboarding customers, configure a production host, privacy notice, retention policy, and support contact. Owners and administrators can privately search an event immediately. Public guest face matching requires system-level model validation plus the event's Enable Face Matching toggle; no event-level evaluation upload or approval procedure is required.

## Before the event

1. Sign in to the photographer workspace and create an event with the correct title, date, public slug, and access settings.
2. Set the guest PIN if the event requires one. Review individual-download and download-all settings. Share the privacy notice and retention details with the client.
3. Upload the event photos from a selected folder, card-reader folder, drag-and-drop, or file picker. The browser does not detect SD cards automatically; select the `DCIM` folder yourself.
4. JPEG, PNG, and WebP receive previews and indexing. Supported RAW originals can be stored, but preview/indexing depends on the server decoder. Do not promise RAW preview support unless tested on that host.
5. Keep the upload page open while the batch starts. For resumable files, use the displayed pause/resume controls. After a browser restart, reselect the same file if prompted so the client can verify its size and checksum and resume the server-side upload.

## Review processing

- Upload completion and face indexing are separate. Wait for the event processing counts to settle and review failed or unsupported files.
- Open a photo's diagnostics from the event photo workspace to inspect detections, quality reasons, and indexing state. Use only consented reference selfies for diagnostic comparisons.
- Correct source files or reindex after a model/pipeline change. Keep existing original images and the previous model configuration until the new version has been checked and rollback is available.
- Test guest access and downloads with an isolated test event before sharing a live event link.

## Share with guests

Download the event QR code after the slug and public URL are final. Check the QR code on a phone, confirm the PIN/privacy text, and explain that face matching can miss photos or return incorrect results. Guest matching becomes available only when system validation is enabled and the event-level toggle is on.

## After the event

Review download and processing activity, respond to privacy/deletion requests using the approved retention procedure, then remove guest biometric data according to the event policy. Back up database metadata and original objects independently; see [Backup and recovery](BACKUP-AND-RECOVERY.md). Record customer support contact, retention date, and deletion completion in the studio's operational records.

For camera, upload, unsupported-file, or no-result issues, use [Troubleshooting](TROUBLESHOOTING-OPERATIONS.md). Replace `[studio support contact]` and event-specific retention language before sharing customer-facing instructions.
