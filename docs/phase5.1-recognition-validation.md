# Phase 5.1A: independent AuraFace embedding validation

## Scope

This phase validates AuraFace tensor preprocessing and ONNX inference only. It does not recalibrate thresholds, audit dataset labels or duplicates, change the model, or alter the production approval gate.

## Method

`services/face-ai/scripts/compare_reference_embeddings.py` selected 20 images from distinct ControlFace10K identity folders and ran inside the existing `memories-photo-finder-face-ai-1` container with `CPUExecutionProvider`.

Both paths used the same decoded image, YuNet detection, five landmarks, and application affine alignment/crop. The application path called `ModelManager._embedding`. The independent path separately converted the aligned crop from BGR to RGB, applied the documented AuraFace transform `(pixel - 127.5) / 127.5`, converted HWC to NCHW float32, invoked the ONNX Runtime session directly, and L2-normalized its output. The documented contract comes from Imagent's AuraFace ONNX export script and model card: `[N,3,112,112]` RGB input, normalized to `[-1,1]`, and 512 raw output values.

## Results

Results are saved in [embedding-comparison.json](../.run/phase5.1/embedding-comparison.json).

| Measure | Result |
|---|---:|
| Images processed | 20 |
| Mean embedding cosine similarity | 1.000000048 (rounding above 1 from float32 dot product) |
| Minimum cosine similarity | 1.000000000 |
| Maximum absolute component difference | 0.0 |
| Maximum L2 difference | 0.0 |
| Application normalized embedding L2 norm | 1.0 for all images |
| Reference normalized embedding L2 norm | 1.0 for all images |

All 20 application and reference output vectors were element-wise identical. This confirms the application’s RGB channel conversion, 112×112 NCHW float32 tensor, AuraFace normalization, direct ONNX output handling, and L2 normalization agree with the documented reference for these inputs. No defect in this recognition stage is supported by the measurements.

## Interpretation and limits

The comparison intentionally shares detection and affine alignment between paths. It therefore does not independently validate YuNet landmark ordering, the affine transform, crop selection, or source image decoding. It also samples only 20 images and does not establish population-wide equivalence or recognition accuracy.

This result makes an AuraFace tensor preprocessing/inference defect unlikely as the cause of the previously reported low pair precision. It does not distinguish dataset label quality from model suitability, alignment/detection quality, pair sampling effects, or gallery-level operating characteristics. Previously supplied saved-score metrics remain: ROC-AUC 0.9725, EER 7.17%, and at threshold 0.64, TP 38, FP 136, FN 112, TN 10,889, precision 21.84%. Those metrics were not recomputed in this phase.

## Files changed

- Added `services/face-ai/scripts/compare_reference_embeddings.py`.
- Added `.run/phase5.1/embedding-comparison.json` as a local evaluation artifact; it contains image paths and embedding comparison measurements, not biometric vectors.
- Added this report.

No production code, threshold, or approval setting was changed. Public matching remains subject to the existing approval gate.

## Next steps

Validate detection and alignment independently against a documented five-point reference on labeled face crops. Then audit benchmark label structure and duplicate identities, and run an end-to-end evaluation on consented, representative event data before making any production accuracy claim.

## Phase 5.1B: threshold and evaluation methodology validation

This analysis used the saved `.run/phase5-after-pairs.json` scores only; no model inference, threshold change, or production code change was made. Detailed results are in [threshold-sweep.json](../.run/phase5.1/threshold-sweep.json) and [threshold-sweep.csv](../.run/phase5.1/threshold-sweep.csv). The CSV contains all 60 thresholds from 0.40 through 0.99 at 0.01 increments, with confusion counts, precision, recall, F1, FAR, and FRR.

### Pair population reconciliation

The score artifact has 22,350 pair rows: 21,757 scored rows and 593 rows with no score. The calibration split has 11,175 total rows (10,731 scored: 145 genuine, 10,586 impostor; 444 unscored). Evaluation has 11,175 total rows (11,026 scored: 148 genuine, 10,878 impostor; 149 unscored). The previously reported threshold-specific evaluation confusion matrix (TP 38, FP 136, TN 10,889, FN 112) sums to 11,175 and counts unscored pairs as non-matches: genuine unscored pairs contribute FN and impostor unscored pairs contribute TN. Pair-score metrics such as ROC-AUC exclude null-score pairs; fixed-threshold evaluation metrics include them as rejection outcomes. This accounts for the different scored population and threshold confusion population.

Saved pair rows do not include identity IDs. Therefore disjoint calibration/evaluation identities cannot be independently verified from this file alone. The Phase 5 evaluator source assigns selected identities to splits before generating within-split pairs, and the earlier report documents identity-level split separation, but the saved artifact does not preserve the evidence needed to verify it. Marking direct identity separation as **not independently verified from saved scores**.

### Threshold targets and uncertainty

Calibration results at 0.64 were TP 36, FP 61, TN 10,525, FN 109 among scored pairs: precision 37.11%, recall 24.83%, F1 29.75%, FAR 0.576%, and FRR 75.17%. The saved score population at threshold 0.64 differs from the earlier full-row fixed-threshold figures because missing embeddings are excluded in score-only calibration statistics but counted as rejected in the report’s fixed-threshold confusion matrix.

No threshold in the requested 0.40–0.99 sweep achieved even 95% empirical calibration precision while retaining a true positive. Thus 95%, 99%, 99.5%, and 99.9% target operating points are all **unverified**; there is no candidate to evaluate on the untouched split. At 0.67, the best observed calibration precision in the sweep was only 39.66% (TP 23, FP 35; recall 15.86%). At 0.80 and above there were no true positives, so zero observed false accepts there does not establish a useful operating point or a zero population FAR.

The JSON includes naive 95% Wilson intervals for precision only when a target candidate exists; none exists here. Pair-level interval estimates would in any case overstate certainty because many pairs share the same images and identities. The artifacts have no per-image/pair identity mapping for a cluster bootstrap. With zero false accepts, the simple rule-of-three 95% upper bound is about `3 / n_impostor`; this is not a substitute for clustered, representative data. No target precision is statistically established by this synthetic sample.

### pgvector conversion and gallery estimates

For normalized vectors, pgvector cosine distance is `embedding <=> query`; cosine similarity is `1 - distance`. Therefore `similarity >= t` is algebraically equivalent to `distance <= 1 - t`. This confirms the conversion documented in Phase 5, but this phase did not execute a live PostgreSQL query. Existing search SQL should continue to be checked against a populated DB if query semantics change.

Expected false matches for galleries of 1,000, 5,000, 10,000, and 25,000 faces are included in JSON as conditional estimates using calibration FAR at each available target candidate. Since no target candidate exists, the report intentionally emits no numeric gallery estimate. Extrapolation would require selecting an unqualified threshold. Under an explicitly hypothetical independent-comparison model, expected false matches would be `(N-1) × FAR` and probability of at least one would be `1 - (1-FAR)^(N-1)`. Real face comparisons are not independent: repeated people, near-duplicates, demographic composition, image quality, and event gallery structure alter the tail. Do not interpret such extrapolation as event accuracy.

### Current conclusions

The 20-image Phase 5.1A result found exact equality between the application embedding output and direct reference inference. The 5.1B sweep finds poor operating characteristics at useful recall and cannot support the requested high precision targets. These results do not identify whether the remaining limitation is AuraFace model suitability, shared detection/alignment, synthetic dataset properties, or label quality. The saved score file cannot validate identity disjointness or duplicate identities. The production approval gate remains enabled, and this synthetic evaluation does not support public production matching approval.

## Phase 5.1C: dataset identity and exact-duplicate integrity

Executed `services/face-ai/scripts/audit_controlface_integrity.py` against the existing ZIP and `.run/phase5-after-pairs.json`. Machine-readable findings and the reconstructed image manifest are in [dataset-audit.json](../.run/phase5.1/dataset-audit.json) and [identity-manifest.csv](../.run/phase5.1/identity-manifest.csv).

- ZIP contents: 10,008 images in 3,336 identity folders. The evaluator's deterministic selection reconstructed 300 benchmark images across 100 identities, with 50 identities per split. Saved pair rows match expected within-split pair counts.
- Calibration/evaluation identity overlap: **0**. The reconstructed sample is identity-disjoint.
- SHA-256 was computed for all 10,008 images. Exact duplicate groups: **0**; cross-identity exact duplicate groups: **0**.
- All 593 null-score pairs were mapped to image pairs by reproducing `pair_scores` ordering: 586 different-label and 7 same-label. The evaluator emits null when either image has no accepted embedding. Pair artifacts omit per-image detection counts, quality status, and failure reasons, so the failed endpoint and exact cause cannot be identified. The prior aggregate report lists only three calibration and one evaluation image not accepted, without image IDs; this does not explain the observed number of null pairs. Per-image benchmark output or logs are needed to resolve that discrepancy.
- The evaluator reads the `identity-*` folder as the label, chooses the first three sorted image paths, and assigns pair truth by folder-label equality. This is structurally consistent with the dataset hierarchy, but does not verify individual labels visually. No model-score-based relabeling was performed.

No byte-identical cross-label files were found. This does not rule out visually similar synthetic identities or incorrect labels. ControlFace10K can provide a controlled synthetic recognition comparison, but these checks do not establish wedding/event performance: labels were not manually reviewed, null-score provenance is incomplete, and the images are not representative consented event photographs. The production approval gate remains enabled.

## Phase 5.1D: detection and alignment validation

Ran `services/face-ai/scripts/audit_detection_alignment.py` in the existing face-ai container using CPU inference on the reconstructed 300-image manifest. Per-image results are in [detection-audit.json](../.run/phase5.1/detection-audit.json); 20-image crop comparisons and matrices are in [alignment-comparison.json](../.run/phase5.1/alignment-comparison.json), with visual examples in [alignment-contact-sheet.html](../.run/phase5.1/alignment-contact-sheet.html).

- YuNet returned exactly one face for each of 300 images: zero missed detections and zero multiple detections in this small, single-face synthetic benchmark sample. Every selected face had confidence, bounding box, and five landmarks recorded.
- Alignment succeeded on all 300. Four images had a detection but no accepted embedding; the dataset audit previously mapped these to four affected manifest entries. The pair evaluator consequently produces null scores for any pair including one of these images: each contributes 149 pairs, totaling 596 potential affected pairs; the saved artifact contains 593 nulls, so its ordering/data generation has a small unresolved discrepancy. The four images are listed with detailed statuses in detection-audit.json. Detection itself was not the cause; acceptance/quality filtering or artifact provenance remains to be reconciled.
- YuNet emits five points in right eye, left eye, nose tip, right mouth corner, left mouth corner order. The app maps them in that order onto the ArcFace/InsightFace 112 template: `[38.2946,51.6963]`, `[73.5318,51.5014]`, `[56.0252,71.7366]`, `[41.5493,92.3655]`, `[70.7299,92.2041]`. This is the documented alignment convention.
- On 20 representative samples, an independent Umeyama/SVD similarity fit and the app OpenCV LMEDS partial-affine fit had mean pixel MAE **0.852/255**, maximum per-image MAE **12.099/255**, and maximum component difference **210/255**. Most samples are very close; the maximum is a localized interpolation/border or fit outlier worth visual review. Pixel differences alone do not establish an identity-relevant defect. The contact sheet provides side-by-side inspection.

No confirmed YuNet landmark-order or app affine-alignment defect was demonstrated. Proposed follow-up, before changing recognition behavior: review the high-difference contact-sheet sample and the four quality-rejected crops; if the high-difference result reflects unstable LMEDS fitting, test a deterministic least-squares similarity fit against labeled landmark annotations, then rerun the same benchmark. Do not change production code based on the current synthetic evidence.

## Phase 5.1E: similarity and remaining pipeline consistency

Results are saved in [similarity-validation.json](../.run/phase5.1/similarity-validation.json). The saved pair artifact contains 21,757 scored rows (293 genuine, 21,464 impostor) and 593 null rows. The offline evaluator uses the dot product of float32 L2-normalized vectors, which is mathematically cosine similarity. The API serializes embedding values as a PostgreSQL vector literal and computes `1 - (embedding <=> query)`, filters with `similarity >= threshold`, and returns double precision without rounding. Its SQL is event-scoped on both face embedding and photo, and also filters exact model/preprocessing versions, accepted quality, ready status, and non-deleted photos.

No arithmetic-direction defect is evident: for unit vectors, cosine distance is `1 - dot/cosine`, so `similarity >= t` is equivalent to `distance <= 1-t`. However, a direct numeric comparison of NumPy cosine, NumPy dot, live pgvector distance, and API scores on 100 identical pairs could not be performed: individual embeddings and benchmark rows in the API database were not retained in available artifacts. The JSON records this limitation; equivalence is mathematical and source-inspected, not live-database verified. The offline scores are stored from float32 dot products; database-side accumulation and serialization tolerance have not been measured on these benchmark pairs.

Four images were detected but had zero accepted embeddings, with YuNet confidences around 0.930–0.939. The audit outputs retained neither the quality sub-reason nor the exact original evaluator image IDs in the prior pair artifact. Thus size/blur/exposure rejection is plausible but unconfirmed. Four failed images would touch 596 pair comparisons (149 each among 300 images), while the saved artifact has 593 null rows, leaving three pairs unexplained. Pair order alone cannot reliably resolve absent per-image embedding states from the original run. Exact root causes require rerunning diagnostic inference on the four images or recovering per-image evaluator logs.

The alignment comparison's largest pixel MAE was 12.099/255 (maximum component difference 210/255). No reference-path embedding was recorded for both crops, so the effect on embedding cosine remains unmeasured. Pixel error alone does not prove a recognition-impacting alignment defect.

### Final Phase 5.1 assessment

Confirmed: AuraFace preprocessing/inference matched direct ONNX inference exactly on 20 samples; YuNet detected one face and alignment completed for all 300 selected synthetic images; no exact duplicate image hashes or calibration/evaluation identity overlap were found; saved score metrics show score overlap and poor useful-threshold precision. No confirmed defect in cosine arithmetic, threshold direction, detection, or alignment has been demonstrated. The four rejected embeddings and three-pair null discrepancy remain unresolved. The run's low precision is not explained by a proven implementation arithmetic defect; model suitability, data-label correctness, quality filtering and alignment effects remain competing hypotheses.

For practical wedding evaluation, use consented, manually identity-labeled events from multiple venues/cameras, include group photos and difficult pose/lighting/occlusion, split calibration and evaluation by event and person, keep pair construction and missing-image accounting explicit, and report event-level false matches per guest search alongside pair metrics. Review detections and ambiguous labels manually; retain per-image diagnostics and vector hashes in a controlled local artifact so null scores can be traced. Do not approve public matching from synthetic data.

Comparative model benchmarking is justified as a next research step because the current model has no qualifying calibration operating point and no demonstrated arithmetic defect explains the score overlap. Benchmark alternatives only on the same consented, representative event set, CPU constraints, licensing terms, and frozen split; do not replace or integrate a model based on this synthetic benchmark alone. The production threshold and approval gate were not changed.
