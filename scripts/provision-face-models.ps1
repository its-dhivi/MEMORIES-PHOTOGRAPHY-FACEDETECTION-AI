$ErrorActionPreference = 'Stop'

$volume = 'memories-photo-finder_face_models'
$curlImage = 'curlimages/curl:8.17.0'
$alpineImage = 'alpine:3.22'
$detector = 'face_detection_yunet_2023mar.onnx'
$recognizer = 'face_recognition_sface_2021dec.onnx'
$detectorSha256 = '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4'
$recognizerSha256 = '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79'
$baseUrl = 'https://github.com/opencv/opencv_zoo/raw/main/models'

docker info *> $null
docker volume create $volume | Out-Null
docker run --rm --user 0 -v "${volume}:/models" $curlImage -fL --retry 3 `
  -o "/models/$detector" "$baseUrl/face_detection_yunet/$detector"
docker run --rm --user 0 -v "${volume}:/models" $curlImage -fL --retry 3 `
  -o "/models/$recognizer" "$baseUrl/face_recognition_sface/$recognizer"

$verification = docker run --rm -v "${volume}:/models" $alpineImage sh -lc `
  "echo '$detectorSha256  /models/$detector' | sha256sum -c - && echo '$recognizerSha256  /models/$recognizer' | sha256sum -c -"
if ($LASTEXITCODE -ne 0) {
  throw 'Face-model checksum verification failed.'
}

$verification
Write-Host 'Face models are provisioned in the Docker volume.'
