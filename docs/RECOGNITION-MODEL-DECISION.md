# Recognition model decision

## Status: no production model selection

## Exact SFace artifact and rights check

The benchmark names `models/face_recognition_sface/face_recognition_sface_2021dec.onnx` from OpenCV Zoo. OpenCV's model directory states that all files in the directory are under Apache License 2.0, which grants commercial use subject to its notice and redistribution conditions. This is the **model artifact's stated license**, distinct from the OpenCV Zoo source-code repository license. It is positive commercial-use permission for this file as distributed by that directory; it is not a separate warranty about the training data, upstream model authorization, biometric use, or jurisdictional requirements. Those items still need counsel's review. The model docs identify MobileFaceNet with the SFace loss and credit Yaoyao Zhong and conversion by Chengrui Wang. The cited upstream documentation does not establish training-data provenance sufficiently for this deployment's use.

| Property                | Verified record                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Artifact                | `face_recognition_sface_2021dec.onnx`                                                                                 |
| Source                  | OpenCV Zoo `models/face_recognition_sface`; published by OpenCV / Open Source Vision Foundation                       |
| Model version           | `2021dec` artifact name; not a claim of a newer architecture release                                                  |
| License                 | Apache-2.0 stated for all files in the model directory                                                                |
| Expected size           | 38,696,353 bytes (38.7 MB as displayed by the model host)                                                             |
| Published SHA-256       | `0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79`                                                    |
| Input/alignment         | OpenCV `FaceRecognizerSF.alignCrop` on BGR source image and YuNet-style row with five landmarks; aligned 112x112 crop |
| Feature                 | 128-dimensional model feature; benchmark L2-normalized it for cosine comparisons                                      |
| Runtime                 | OpenCV DNN `FaceRecognizerSF`, with documented OpenCV CPU backend/target; compatible with CPU-only deployment         |
| Actual local hash check | Verified inside the persistent Docker model volume: 38,696,353 bytes and SHA-256 matches the published value          |

The checksum verifier passed against the exact file in the persistent model volume. A fresh face-AI image loaded the configured SFace provider with `OpenCV-DNN-CPU`; model and YuNet detector initialization succeeded with a 128-dimensional feature and 512-dimensional padded storage configuration. This proves artifact identity and runtime load, not identity accuracy on real event photos, trained weights provenance, or suitability of a public threshold. The benchmark's optimized synthetic calibration threshold (`0.6013`) is not the OpenCV sample threshold (`0.363`) and neither is approved for production.

Sources: [OpenCV Zoo SFace model documentation](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/README.md), [OpenCV Zoo SFace source wrapper](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/sface.py), [published model artifact and SHA-256](https://huggingface.co/opencv/opencv_zoo/blob/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx), and [OpenCV FaceRecognizerSF API](https://docs.opencv.org/4.10.0/da/d09/classcv_1_1FaceRecognizerSF.html).

Phase 5.2A compared AuraFace v1 with OpenCV Zoo SFace 2021dec on 300 synthetic ControlFace10K images. SFace scored ROC-AUC 0.9766, EER 6.00%, precision 25.87%, recall 69.33%, F1 0.3768 and 118.19 embedding faces/s. AuraFace scored 0.9694, 7.91%, 24.91%, 46.00%, 0.3232 and 12.98 faces/s. Both had zero embedding failures.

SFace is the provisional candidate for further evaluation, not selected for production. Neither precision result is acceptable evidence for public guest matching. Its OpenCV Zoo model directory publishes Apache-2.0 terms for the artifact; repository code licensing and training-data rights are separate questions. Preserve exact artifact checksum/provenance and obtain legal review before commercial deployment. Compare on consented event imagery with event/person holdouts and gallery-level false matches before migration.

Production AuraFace, thresholds and event approval gates remain unchanged. See [Phase 5.2 benchmark](phase5.2-model-benchmark.md) and [Phase 5.1 validation](phase5.1-recognition-validation.md).
