/*

An Interview with Dust 
Code By: Aous Hamoud 23.06.202

Code programme as a performance intiation tool for an on-going artistic research on noticing dust and develping research methodologies. It is used to explore abstract investigations with dust, to communicate with available and not available dust, and to create a space for noticing and being with dust.

Credits:
Orginal code: This code has been adapted and modified from Rebbeca Atson's code examples in week 6. I've added the original code "Sound_Camera_Theremin" in this bundle. 
Refining code: with assistance of Gemini (google AI), which aided in optimising pixel array process, mathmatical mapping, audio engagment. 

*/

//!__________________________________________________________Global Variables

// storing sensors data for interface and audio logic
let liveZ3Percent = 0;
let liveZ4Percent = 0;
let liveZ2Spread = 0;

// Zones animation
let plusSizes = [0, 0, 0, 0]; // One for each of the 4 zones
let plusTarget = [0, 0, 0, 0]; // Where the size wants to be

// Audio
let audioContextOn = false;
let tracks = [];
let numTracks = 44;

// Webcam resolution feed
const VID_WIDTH = 320;
const VID_HEIGHT = 240;
const PIXEL_JUMP = 10; //scans the amount of pixels to save processing power.

let video;
let prevFrame = []; // For motion detection
let motion = 0;

let brightX = 0,
  brightY = 0,
  avgBrightness = 0;

// State Managment
let appState = "START"; // change to "START" "WAITING" "RUNNING"
let waitStartTime = 0;

// Stillness & motion perecentage
let isStill = false;
let motionThreshold = 28; // Restart logic when motion detects above 10

// Pools
let activeA = -1;
let activeB = -1;
let activeC = -1; // Noise
let activeD = -1; // Words

// Colour sensing
let timeoutA, timeoutB, timeoutC, timeoutD;
let lastTriggerA = 0;
let lastTriggerB = 0;
let lastTriggerC = 0;
let lastTriggerD = 0;

let stateA = "dimmed"; // Tracks which zone is active (dimmed / bright)
let stateB = "decay"; // Tracks which zone is active (decay / vibrant)

let lastZ1 = { r: 0, g: 0, b: 0 };
let lastZ2 = { r: 0, g: 0, b: 0 };

//Zone dimensions and positions
const Z1_X = 0,
  Z1_Y = 0,
  Z1_W = 160,
  Z1_H = 120; // Zone 1: Decay - left top

const Z2_X = 160,
  Z2_Y = 0,
  Z2_W = 160,
  Z2_H = 120; // Zone 2: Vibrant - right top

const Z3_CX = 80,
  Z3_CY = 180,
  Z3_R = 50; // Zone 3: Dimmed - bottom left

const Z4_CX = 240,
  Z4_CY = 180,
  Z4_R = 50; // Zone 4: Bright - bottom right

//!__________________________________________________________ Preload
function preload() {
  for (let i = 0; i < numTracks; i++) {
    tracks[i] = loadSound("audio-assets/" + nf(i, 2) + ".mp3");
  }
}

//!__________________________________________________________ Window Resize
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
//!__________________________________________________________ Setup
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Courier");

  video = createCapture(VIDEO);
  video.size(VID_WIDTH, VID_HEIGHT);
  video.hide();
}

//!__________________________________________________________ Draw
function draw() {
  clear();

  // Video bakcground shown always
  push();
  let scaleFactor = max(width / VID_WIDTH, height / VID_HEIGHT);
  translate(width / 2, height / 2);
  // AI refinement - Added negative scaleFactor to create a mirror-flip effect, so the endoscope movement feels intuitive to the performer.
  scale(-scaleFactor, scaleFactor);
  translate(-VID_WIDTH / 2, -VID_HEIGHT / 2);
  image(video, 0, 0);
  pop();

  //Browser Screen fun - how dust see us!
  filter(INVERT);
  filter(POSTERIZE, 15);

  // State Management
  if (appState === "RUNNING") {
    video.loadPixels();
    // AI refinement - CPU Optimization.
    if (frameCount % 5 === 0) {
      calculateSensing();
    }

    // Stillness logic
    // Stop audio when there is motion >= 10
    if (motion >= motionThreshold && !isStill) {
      console.log("High Motion (" + nfc(motion, 1) + ") -> Pausing Audio");
      // stopAllAudio();
      // clearTrackA();
      // clearTrackB();
      // clearTrackC();
      clearTrackD();
      isStill = true;
    }
    // Play audio when there is stillness < than the given number in global variable
    else if (motion < motionThreshold && isStill) {
      console.log("Stillness (" + nfc(motion, 1) + ") -> resuming Audio");
      isStill = false;
      // playNextA();
      // playNextB();
      // playNextC();
      playNextD();
    }

    applyTrackVolumes(); // double check correct tracs are audible
    drawInterface(); // Comment out to hide zone outlines
    drawSidebar(); // Comment out to hide sidebar data
  } else if (appState === "WAITING") {
    let elapsed = millis() - waitStartTime;
    if (elapsed >= 1800) {
      // edit the value of waiting time
      appState = "RUNNING";
      playNextA();
      playNextB();
      playNextC();
      playNextD();
    }
  } else {
    // Start Screen
    fill(0, 0, 255);
    noStroke();
    textAlign(CENTER);
    textSize(20);
    text("start\n\An Interview with Dust", width / 2, height / 2);
  }

  // mapping animation to interface zone drawings
  // If motion is detected, set target to 20; if not, target is 0
  let activeSize = motion > motionThreshold ? 50 : 0;

  for (let i = 0; i < 4; i++) {
    plusTarget[i] = activeSize;
    plusSizes[i] = lerp(plusSizes[i], plusTarget[i], 0.05); // Smooth animation
  }
}

//!__________________________________________________________ Calculate Sensing
// The brain or the translator - this function transfrom pixels into numbers
function calculateSensing() {
  //empty local variables to hold data that is going to be collected z1 = Zone 1
  let z1R = 0,
    z1G = 0,
    z1B = 0,
    z1Count = 0;
  let z2R = 0,
    z2G = 0,
    z2B = 0,
    z2Count = 0;
  let z3Bri = 0,
    z3Count = 0;
  let z4Bri = 0,
    z4Count = 0;
  let moveSum = 0,
    totalCount = 0;

  //extarcting light
  for (let x = 0; x < VID_WIDTH; x += PIXEL_JUMP) {
    for (let y = 0; y < VID_HEIGHT; y += PIXEL_JUMP) {
      let i = (y * VID_WIDTH + x) * 4; //math formula to find the systemised pixels
      let r = video.pixels[i],
        g = video.pixels[i + 1],
        b = video.pixels[i + 2];
      let bri = (r + g + b) / 3; // calculates brihgtness bby averaging RGB values

      //calculating motion
      // AI refinement - Inverts the X-coordinate mathematically
      if (prevFrame[i] !== undefined) moveSum += abs(r - prevFrame[i]);
      prevFrame[i] = r;
      totalCount++;

      //Filling empty local variables with pixels to imply decay and vibrant dust by using RGB pixels
      // Zone 1 & 2 - colours
      if (x > Z1_X && x < Z1_X + Z1_W && y > Z1_Y && y < Z1_Y + Z1_H) {
        z1R += r;
        z1G += g;
        z1B += b;
        z1Count++;
      }
      if (x > Z2_X && x < Z2_X + Z2_W && y > Z2_Y && y < Z2_Y + Z2_H) {
        z2R += r;
        z2G += g;
        z2B += b;
        z2Count++;
      }
      //dimmed and brihgt - Zone 3 & 4 Brihgtness
      if (dist(x, y, Z3_CX, Z3_CY) < Z3_R) {
        z3Bri += bri;
        z3Count++;
      }
      if (dist(x, y, Z4_CX, Z4_CY) < Z4_R) {
        z4Bri += bri;
        z4Count++;
      }
    }
  }

  // Averaging the data
  motion = moveSum / totalCount;
  let now = millis();

  // Pool A - dimmed and brihgt
  // turning avergage brihgtness into percentage - math
  let percent3 = z3Count > 0 ? (z3Bri / z3Count / 255) * 100 : 0;
  let percent4 = z4Count > 0 ? (z4Bri / z4Count / 255) * 100 : 0;
  // AI refinement - Added buffer logic
  // system for relating control with video input
  //if zone 3 les and equal 35% and is not playing dimmed track, trigger startLoopA
  if (percent3 <= 35 && stateA !== "dimmed") {
    console.log("Dimmed - Brightness dropped <= 35%");
    stateA = "dimmed";
    startLoopA();
  } else if (percent4 > 45 && stateA !== "bright") {
    console.log("Bright - Brightness rose > 45%");
    stateA = "bright";
    startLoopA();
  }

  // Pool B - Decay and Vibrant
  // AI refinement - Cooldown timer (millis) forces the system to wait 1.5 seconds between triggers to prevent overlapping audio triggers.
  //cooldown system - without waiting the loop will overload and crash
  if (now - lastTriggerB > 1500) {
    let avgR1 = z1R / z1Count, //calculating average for zone 1 and 2
      avgG1 = z1G / z1Count,
      avgB1 = z1B / z1Count;
    let avgR2 = z2R / z2Count,
      avgG2 = z2G / z2Count,
      avgB2 = z2B / z2Count;
    let shift1 = dist(avgR1, avgG1, avgB1, lastZ1.r, lastZ1.g, lastZ1.b);
    let shift2 = dist(avgR2, avgG2, avgB2, lastZ2.r, lastZ2.g, lastZ2.b);

    // Using 15/25 for shift and 20/40 for spread as buffer zones
    if (
      shift1 > 15 &&
      max(avgR1, avgG1, avgB1) - min(avgR1, avgG1, avgB1) < 20 &&
      stateB !== "decay"
    ) {
      console.log(" Decay - Grey shift detected)");
      stateB = "decay";
      startLoopB();
      lastTriggerB = now;
    } else if (
      shift2 > 15 &&
      max(avgR2, avgG2, avgB2) - min(avgR2, avgG2, avgB2) > 45 &&
      stateB !== "vibrant"
    ) {
      console.log("vibrant - colourful shift detected)");
      stateB = "vibrant";
      startLoopB();
      lastTriggerB = now;
    }
  }

  // Pool c and D - Motion Audio
  // Pool C
  if (!isStill) {
    if (activeC === -1 && motion > 1.9) {
      startLoopC();
    } else if (activeC !== -1 && motion < 1) {
      tracks[activeC].stop();
      activeC = -1;
    }
    // Pool D
    if (activeD === -1 && motion > 1.6) {
      startLoopD();
    } else if (activeD !== -1 && motion < 1.3) {
      tracks[activeD].stop();
      activeD = -1;
    }
  }

  //
  lastZ1 = {
    r: z1Count > 0 ? z1R / z1Count : 0,
    g: z1Count > 0 ? z1G / z1Count : 0,
    b: z1Count > 0 ? z1B / z1Count : 0,
  };
  lastZ2 = {
    r: z2Count > 0 ? z2R / z2Count : 0,
    g: z2Count > 0 ? z2G / z2Count : 0,
    b: z2Count > 0 ? z2B / z2Count : 0,
  };

  // data saved for side bar
  liveZ3Percent = z3Count > 0 ? (z3Bri / z3Count / 255) * 100 : 0;
  liveZ4Percent = z4Count > 0 ? (z4Bri / z4Count / 255) * 100 : 0;

  let avgR2 = z2R / z2Count,
    avgG2 = z2G / z2Count,
    avgB2 = z2B / z2Count;
  liveZ2Spread = max(avgR2, avgG2, avgB2) - min(avgR2, avgG2, avgB2);
}

//!__________________________________________________________ Draw Interface
function drawInterface() {
  push();
  let scaleFactor = max(width / VID_WIDTH, height / VID_HEIGHT);
  translate(width / 2, height / 2);
  scale(scaleFactor);
  translate(-VID_WIDTH / 2, -VID_HEIGHT / 2);

  // Defining centers for the 4 zones
  let centers = [
    { x: 80, y: 60 }, // Zone 1
    { x: 240, y: 60 }, // Zone 2
    { x: 80, y: 180 }, // Zone 3
    { x: 240, y: 180 }, // Zone 4
  ];

  // Boxes and Pluses animation
  for (let i = 0; i < 4; i++) {
    // 1. Draw the box
    stroke(0, 0, 255);
    strokeWeight(0.02);
    noFill();
    if (i === 0) rect(Z1_X, Z1_Y, Z1_W, Z1_H);
    if (i === 1) rect(Z2_X, Z2_Y, Z2_W, Z2_H);
    if (i === 2) rect(0, 120, 160, 120);
    if (i === 3) rect(160, 120, 160, 120);

    // math the Plus - if size > 0
    if (plusSizes[i] > 0.5) {
      stroke(0, 0, 255); // Blue plus
      strokeWeight(0.05);
      let s = plusSizes[i];
      let cx = centers[i].x;
      let cy = centers[i].y;

      line(cx - s, cy, cx + s, cy); // Horizontal
      line(cx, cy - s, cx, cy + s); // Vertical
    }
  }
  pop();
}

//!__________________________________________________________ Draw Sidebar
function drawSidebar() {
  push();
  fill(0, 0, 255);
  textAlign(LEFT);
  let x = 20;
  let bottomY = height - 160;
  let spacing = 12;

  textSize(9);

  // calculates text position
  text("Measuring Translator", x, bottomY);
  text(
    "Bright/Dimmeed_ " + (activeA === -1 ? "X" : activeA),
    x,
    bottomY + spacing * 1,
  );
  text(
    "Vibrant/Decay_ " + (activeB === -1 ? "X" : activeB),
    x,
    bottomY + spacing * 2,
  );
  text("Noise_ " + (activeC === -1 ? "X" : activeC), x, bottomY + spacing * 3);
  text("Words_ " + (activeD === -1 ? "X" : activeD), x, bottomY + spacing * 4);

  text("Endoscope Data", x, bottomY + spacing * 6);
  text("Motion_ " + nfc(motion, 1), x, bottomY + spacing * 7);
  fill(0, 0, 255);

  text("Vibrant Sensor_ " + nfc(liveZ2Spread, 1), x, bottomY + spacing * 9);
  text("Dim Sensor_ " + nfc(liveZ3Percent, 1) + "%", x, bottomY + spacing * 10);
  text(
    "Bright Sensor_ " + nfc(liveZ4Percent, 1) + "%",
    x,
    bottomY + spacing * 11,
  );
  pop();

  // Motion bar
  let barWidth = 100;
  let motionMap = map(motion, 0, 10, 0, barWidth); // Map motion to bar width
  // Change bar colour to red if it hits the threshold
  if (motion >= motionThreshold) fill(0, 255, 0);
  else fill(0, 0, 255);
  rect(x, bottomY + spacing * 7.3, motionMap, 1.5);
}

//!__________________________________________________________ Clear Track A B C D
// Audio Helpers and Gap Logic
function clearTrackA() {
  if (activeA !== -1) {
    tracks[activeA].onended(function () {}); //erase memeory
    tracks[activeA].stop(); // stop audio
    clearTimeout(timeoutA); // eliminate stop aduio
  }
}
function clearTrackB() {
  if (activeB !== -1) {
    tracks[activeB].onended(function () {});
    tracks[activeB].stop();
    clearTimeout(timeoutB);
  }
}
function clearTrackC() {
  if (activeC !== -1) {
    tracks[activeC].onended(function () {});
    tracks[activeC].stop();
    clearTimeout(timeoutC);
  }
}
function clearTrackD() {
  if (activeD !== -1) {
    tracks[activeD].onended(function () {});
    tracks[activeD].stop();
    clearTimeout(timeoutD);
  }
}

//!__________________________________________________________ Play next A B C D
// planner function - logic calculation - Audio mixer/DJ - applying random to decision making in choosing the audio, this part is important becuas it memics how the dust is deciding communicating back.
function playNextA() {
  clearTrackA(); //This helps avoiding track playing overlap.
  if (stateA === "dimmed") {
    activeA = floor(random(0, 9)); //random picking from 0-9 floor takes decimel out
  } else {
    activeA = floor(random(9, 18));
  }
  tracks[activeA].setLoop(true); // When it gets dark, repeat continuesly until the system decides to swithc to next track
}
function playNextB() {
  clearTrackB();
  if (stateB === "decay") {
    activeB = floor(random(18, 24));
  } else {
    activeB = floor(random(24, 28));
  }
  tracks[activeB].play();
  tracks[activeB].onended(function () {
    timeoutB = setTimeout(function () {
      playNextB();
    }, 5000);
  });
}
function playNextC() {
  clearTrackC();
  activeC = floor(random(28, 36)); // Tracks 28 to 35
  tracks[activeC].play();
  tracks[activeC].onended(function () {
    timeoutC = setTimeout(function () {
      playNextC();
    }, 2000);
  });
}
function playNextD() {
  clearTrackD();
  activeD = floor(random(36, 44)); // Tracks 36 to 43
  tracks[activeD].play();
  tracks[activeD].onended(function () {
    timeoutD = setTimeout(function () {
      playNextD();
    }, 2000);
  });
}

//!__________________________________________________________ Apply track volume
function applyTrackVolumes() {
  for (let i = 0; i < numTracks; i++) {
    if (i === activeA || i === activeB || i === activeC || i === activeD) {
      tracks[i].amp(7);
    } else {
      tracks[i].amp(0);
    }
  }
}

//!__________________________________________________________ Stop all audio
function stopAllAudio() {
  clearTrackA();
  clearTrackB();
  clearTrackC();
  clearTrackD();
  activeA = -1;
  activeB = -1;
  activeC = -1;
  activeD = -1;
}

//!__________________________________________________________ Start loop A B C D
// excutor function -  media interaction - track changer in relation to claculate sensing and play next
function startLoopA() {
  if (activeA !== -1) tracks[activeA].stop(); // stop previous track
  activeA = stateA === "dimmed" ? floor(random(0, 9)) : floor(random(9, 18));
  tracks[activeA].setLoop(true); // endless loop
  tracks[activeA].play(); // play track
}
function startLoopB() {
  if (activeB !== -1) tracks[activeB].stop();
  activeB = stateB === "decay" ? floor(random(18, 24)) : floor(random(24, 28));
  tracks[activeB].setLoop(true);
  tracks[activeB].play();
}
function startLoopC() {
  if (activeC !== -1) tracks[activeC].stop();
  activeC = floor(random(28, 36));
  tracks[activeC].setLoop(true);
  tracks[activeC].play();
}
function startLoopD() {
  if (activeD !== -1) tracks[activeD].stop();
  activeD = floor(random(36, 44));
  tracks[activeD].setLoop(true);
  tracks[activeD].play();
}

//!__________________________________________________________ Mouse Pressed master button
//click screen to give permission for interview to start, click again to stop.
function mousePressed() {
  if (appState === "START") {
    userStartAudio(); // permission
    appState = "WAITING";
    waitStartTime = millis();
  } else if (appState === "RUNNING" || appState === "WAITING") {
    appState = "START";
    stopAllAudio();
  }
}
