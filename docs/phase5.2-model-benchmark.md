# Phase 5.2A: AuraFace vs SFace benchmark

## Scope and method

Compared the existing AuraFace v1 ONNX model with OpenCV Zoo SFace 2021dec using the frozen 300-image ControlFace10K manifest and its identity-disjoint calibration/evaluation splits. The standalone script is [benchmark_recognition_models.py](../services/face-ai/scripts/benchmark_recognition_models.py). A 20-image smoke run passed for both models before the complete run. The full inference ran in the existing face-ai container using CPUExecutionProvider for AuraFace and OpenCV CPU DNN for SFace.

AuraFace used the application's YuNet selection and ArcFace 112 template alignment, followed by RGB `(pixel-127.5)/127.5` and ONNX Runtime. SFace used the same detected face row but its documented OpenCV Zoo `FaceRecognizerSF.alignCrop` and `feature` API. Embeddings were L2 normalized for comparable cosine scoring. Each model independently selected the calibration threshold maximizing pairwise F1, then applied it unchanged to evaluation.

## Measured results

Full machine-readable per-image embeddings and measurements are in [model-comparison.json](../.run/phase5.2/model-comparison.json); summary is in [model-comparison.csv](../.run/phase5.2/model-comparison.csv).

| Model | Calibration threshold | Eval ROC-AUC | EER | Precision | Recall | F1 | FAR | FRR | TP/FP/TN/FN | Embedding failures | Mean / P95 embedding latency | Measured embedding throughput |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| AuraFace | 0.5821 | 0.9694 | 7.91% | 24.91% | 46.00% | 0.3232 | 1.89% | 54.00% | 69/208/10,817/81 | 0 | 77.01 / 88.54 ms | 12.98 faces/s |
| SFace | 0.6013 | 0.9766 | 6.00% | 25.87% | 69.33% | 0.3768 | 2.70% | 30.67% | 104/298/10,727/46 | 0 | 8.46 / 10.63 ms | 118.19 faces/s |

These are synthetic dataset measurements, not production accuracy. Independent calibration on 50 identities and evaluation on 50 identities is a limited sample; numerous pair scores share images. Thresholds maximize F1, not an event safety target. The benchmark uses pairwise scores and does not report low-FAR operating points with sufficient statistical confidence.

## Performance

Measured timing is embedding inference only (AuraFace's application embedding call; SFace feature inference). It excludes decode, YuNet, alignment, image I/O, DB, and storage. Throughput is successful embedding count divided by summed inference seconds in this run, not a whole-pipeline indexing benchmark. Both models had zero embedding failures on the 300 selected images. Peak memory and CPU utilization were not captured, so performance comparison is limited to measured latency/throughput. Estimated indexing durations are omitted because full pipeline throughput was not measured.

## Licensing and recommendation

The [AuraFace ONNX model card](https://huggingface.co/imagent/auraface-onnx) identifies the export as Apache-2.0 and gives its upstream provenance. The [OpenCV Zoo SFace directory](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface) publishes its model documentation and Apache-2.0 license. These source licenses are positive eligibility evidence, but do not replace organization legal review of model training data and intended use.

SFace is the stronger next candidate for controlled validation: it had higher ROC-AUC, lower EER, higher recall and F1 at its own calibration threshold, and roughly 9.1x the measured embedding throughput. Its false acceptance rate was also higher and pair precision remained only 25.87%; neither candidate meets an acceptable production criterion. Do not replace AuraFace based on this synthetic benchmark. Before any selection, obtain legal review and repeat evaluation on consented, manually labeled wedding/event images with event/person-separated holdouts and explicit false matches per guest search. Keep the production model, threshold, and approval gate unchanged.
