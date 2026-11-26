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

## System-level guest release

There is no event-level evaluation upload, signature, or technical approval step. Event owners and admins can use private search immediately. Public guest matching is a separate system-level feature and remains disabled unless both `PUBLIC_FACE_MATCHING_MODEL_VALIDATED=true` and `PUBLIC_FACE_MATCHING_ENABLED=true` are configured. Set the validation flag only after an authorized operator reviews real, consented, manually labeled, gallery-level results on independent evaluation data, quality failure analysis, confidence intervals, and legal/privacy controls. Never infer the validation flag from synthetic benchmark metrics or invent evaluation results. Event owners then opt in or out with the event's simple face-matching toggle.

## Limitations and release gate

The current deliverable is a local CLI, not a hosted annotation workflow. No consented event set was supplied, so real-world accuracy remains unvalidated. Query-level Wilson intervals do not model correlation by person/event; use event/identity cluster bootstrap for a final large evaluation. Report sample sizes and uncertainty for every subgroup. Public matching remains disabled until system-level validation and appropriate privacy/legal review are complete.
