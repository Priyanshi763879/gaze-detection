const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false,
  });
  video.srcObject = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => resolve(video);
  });
}

function calculateMidpoint(p1, p2) {
  return [(p1.x + p2.x) / 2, (p1.y + p2.y) / 2];
}

function calculateDistance(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function detectGazeAndScreenFocus(faceLandmarks) {
  // Key points for left and right eyes
  const leftEyeTop = faceLandmarks[159];
  const leftEyeBottom = faceLandmarks[145];
  const leftEyeInner = faceLandmarks[133];
  const leftEyeOuter = faceLandmarks[33];
  const leftPupil = calculateMidpoint(leftEyeTop, leftEyeBottom);

  const rightEyeTop = faceLandmarks[386];
  const rightEyeBottom = faceLandmarks[374];
  const rightEyeInner = faceLandmarks[362];
  const rightEyeOuter = faceLandmarks[263];
  const rightPupil = calculateMidpoint(rightEyeTop, rightEyeBottom);

  // Eye Aspect Ratio (EAR) for blink detection and eye openness
  const leftEAR =
    calculateDistance(leftEyeTop, leftEyeBottom) /
    calculateDistance(leftEyeInner, leftEyeOuter);
  const rightEAR =
    calculateDistance(rightEyeTop, rightEyeBottom) /
    calculateDistance(rightEyeInner, rightEyeOuter);

  const averageEAR = (leftEAR + rightEAR) / 2;

  // Thresholds for eye openness and blink detection
  const EAR_THRESHOLD = 0.2;

  // Gaze direction ratios
  const leftGazeRatio =
    Math.abs(leftPupil[0] - leftEyeInner.x) /
    Math.abs(leftEyeOuter.x - leftEyeInner.x);
  const rightGazeRatio =
    Math.abs(rightPupil[0] - rightEyeInner.x) /
    Math.abs(rightEyeOuter.x - rightEyeInner.x);

  const averageGazeRatio = (leftGazeRatio + rightGazeRatio) / 2;

  // Screen focus detection logic
  if (averageEAR < EAR_THRESHOLD) {
    return "Not looking at screen (Blink or Eyes Closed)";
  } else if (averageGazeRatio < 0.4) {
    return "Looking left";
  } else if (averageGazeRatio > 0.6) {
    return "Looking right";
  } else {
    return "Looking at screen";
  }
}

async function startDetection() {
  const faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.8, // Higher confidence
    minTrackingConfidence: 0.8, // Higher confidence
  });

  faceMesh.onResults((results) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const faceLandmarks = results.multiFaceLandmarks[0];
      const gazeStatus = detectGazeAndScreenFocus(faceLandmarks);
      status.textContent = `Status: ${gazeStatus}`;

      // Draw landmarks for visualization
      for (const landmark of faceLandmarks) {
        ctx.beginPath();
        ctx.arc(
          landmark.x * canvas.width,
          landmark.y * canvas.height,
          2,
          0,
          2 * Math.PI
        );
        ctx.fillStyle = "red";
        ctx.fill();
      }
    } else {
      status.textContent = "Status: No face detected";
    }
  });

  await setupCamera();
  video.play();

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const processFrame = async () => {
    await faceMesh.send({ image: video });
    requestAnimationFrame(processFrame);
  };
  processFrame();
}

startDetection();
