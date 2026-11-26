# Representative event-photo evaluation workflow

This workflow is an offline administrator/operator tool. Keep the evaluation directory on an encrypted, access-controlled volume, restrict it to named operators, and exclude it from Git, normal application logs, and routine backups unless those backups have equivalent access controls and retention. No labels are inferred from model scores.

## Prepare consented ground truth

1. Obtain written permission covering the specific evaluation purpose, operators, storage location, retention period, and deletion contact. Exclude people without the required permission; get guardian authorization where appropriate and obtain legal advice for children and other sensitive circumstances.
2. Include multiple events, photographers/camera families, venues, individual portraits and group photos. Label each visible face and identity manually. Include small/distant faces, profiles, lighting variation, blur, glasses, occlusion, expressions, high-resolution and downsampled captures, similar-looking subjects, and multiple photos of each subject.
3. Assign independent events to calibration or evaluation. Never tune a threshold on evaluation events. Have a second reviewer resolve ambiguous labels and retain unresolved cases as explicitly unknown rather than guessing.
4. Record per-image annotation evidence: event, consent record reference, image checksum, manually reviewed face boxes/person IDs, capture conditions, detection status/count, alignment status, and a human-reviewed quality rejection reason. Do not put names in filenames or logs; use random subject IDs.
5. Capture reference selfies only under separate explicit consent. Keep them in the restricted data folder. They must not be auto-labeled by the recognizer.

## Run gallery-level scoring

Create a UTF-8 JSONL score manifest with one row per `(query, gallery photo)` candidate:

```json
{"event_id":"event-cal-01","split":"calibration","query_id":"q-001","query_person_id":"subject-17","photo_id":"photo-001","person_ids":["subject-17","subject-23"],"score":0.71,"capture_tags":["group","indoor"]}
{"event_id":"event-cal-01","split":"calibration","query_id":"q-001","query_person_id":"subject-17","photo_id":"photo-002","person_ids":["subject-42"],"score":0.21,"capture_tags":["portrait"]}
```

`person_ids` must come from manual annotation. Include every gallery photo for each query, including below-threshold and missing (`null`) scores. The evaluator rejects events or query identities shared across calibration and evaluation. Its report includes photo precision/recall, false acceptance/rejection per query, Wilson intervals, zero-result searches, incorrect photographs exposed per query, per-query details, and capture-tag rates.

```powershell
python services/face-ai/scripts/evaluate_gallery.py private-eval/scores.jsonl `
  --threshold 0.60 --output private-eval/report.json
```

Choose the candidate threshold using calibration rows only and the documented business risk target; freeze it before evaluating. Evaluate every query against the full event gallery. Do not use pairwise metrics as a replacement for gallery-level results. `services/face-ai/scripts/evaluate_detection.py` separately measures face-box detection against manually labeled boxes. Retain all rejected images and tag failure reasons so detection, alignment, and quality filtering can be distinguished.

## Production approval artifact

Production approval requires a trusted HMAC signature bound to the event ID, threshold, model/preprocessing versions, source label, and evaluation result summary. It also requires at least three held-out events and 1,000 evaluation queries, photo-precision 95% Wilson lower bound of at least 99%, photo recall of at least 50%, and a query-level false-acceptance 95% Wilson upper bound no greater than 0.1%. These are conservative software gates, not a legal or safety guarantee; counsel and the operator must approve them before launch. The interval is query-level, so final evidence should also include event/person cluster uncertainty.

Create a private wrapper JSON containing `eventId`, `threshold`, `modelVersion`, `preprocessingVersion`, `source`, and `evaluationResults` (the evaluator's `reports.evaluation` summary). The trusted evaluation signer must hold the production `EVALUATION_SIGNING_SECRET` outside the browser and app logs:

```sh
node scripts/sign-evaluation-artifact.mjs private-eval/approval.json
```

The dashboard accepts the resulting `.signed.json`. API verification checks the signature in constant time and repeats the gallery-level acceptance checks, so direct unsigned API calls cannot set production approval. Keep the signing secret restricted to the trusted signer/host; rotate it after suspected exposure. Never fabricate labels or metrics to pass the gate.

## Limitations and release gate

The current deliverable is a local CLI, not a web upload or annotation screen. No consented event set was supplied, so it was not run against real wedding data. Operator access is enforced operationally by OS volume ACLs and an offline workspace; a multi-user hosted annotation workflow needs a separate authenticated feature with audit trails and deletion controls before being offered to customers. Query-level Wilson intervals do not model correlation by person/event; use event/identity cluster bootstrap for a final large evaluation. Report sample sizes and uncertainty for every subgroup. Keep public matching unapproved until counsel review, independent representative evaluation, event approval, and operational privacy controls are satisfied.
