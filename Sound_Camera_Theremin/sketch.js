/*
 This sketch uses the average color of the camera to create a theremin-like effect where 
 the distance of your hand from the webcam / the blocking of all light will affect sound.

 Average Brightness drives the amplitude and saturation the frequency of the oscillator. 

 For finer control, try and use a physical computing distance sensor or light sensor instead.

 Try and make this sound more interesting by using some additivie synthesis.
*/

let audioContextOn = false;

let oscillate, fft;

//const means a contstant value, you cannot reset the value later in the sketch
const VID_WIDTH = 320;
const VID_HEIGHT = 240;
const PIXEL_JUMP = 5;

let video;

let numSampledPix;

let avgHue;
let avgBrightness;
let avgSat;

function setup() {
  createCanvas(600, 600);
  textAlign(CENTER);

  //creates a DOM <video> element that streams the camera. 
  //changing this function to find the endsciope inpute function
  // video = createCapture(VIDEO);
  video = createCapture(VIDEO, function (stream) {
    findEndoscope();
  });

  video.size(VID_WIDTH, VID_HEIGHT);
  // The above function actually makes a separate video
  // element on the page.  The line below would hide it
  //hides that DOM video element so it doesn't appear on the page — you still have access to its pixels via video.pixels.
  // video.hide();

  //we don't sample all the pixels in our incoming video
  numSampledPix = (VID_WIDTH / PIXEL_JUMP) * (VID_HEIGHT / PIXEL_JUMP);

  //user must start audio context.
  //you’re grabbing that single global AudioContext and telling it to pause (so no sound starts playing yet).
  //hides that DOM video element so it doesn't appear on the page — you still have access to its pixels via video.pixels.
  getAudioContext().suspend();

  //Wave types: "sine", "triangle", "sawtooth", "square"
  //creates a sine wave oscillator that you later .start() and control with .freq() and .amp().
  oscillate = new p5.Oscillator("sine");

  //do fft analysis on all sound in the sketch
  //prepares FFT analysis to get waveform data (fft.waveform() returns an array of floats in [-1, 1]).
  fft = new p5.FFT();
}

// Function to switch the feed to the Endoscope - GEMINI code
function findEndoscope() {
  navigator.mediaDevices.enumerateDevices()
    .then(devices => {
      let videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      // Look for a device that isn't the built-in FaceTime/Webcam
      // Most endoscopes appear as "USB Camera"
      let endoscope = videoDevices.find(d => d.label.includes("HP HD camera"));
      
      if (endoscope) {
        console.log("Endoscope found: " + endoscope.label);
        let constraints = {
          video: { deviceId: { exact: endoscope.deviceId } }
        };
        // Stop the old stream and start the endoscope stream
        video.stop();
        video = createCapture(constraints);
        video.size(VID_WIDTH, VID_HEIGHT);
        video.hide();
      } else {
        console.log("Endoscope not found, using default camera.");
      }
    });
}

function draw() {
  background(220);
  fill(0);
  text(round(frameRate(), 2), width - 20, 20);

  if (audioContextOn) {
    //copies the current camera frame into video.pixels[]. You must call this before reading video.pixels.
    video.loadPixels();

    count = 0;
    avgHue = 0;
    avgBrightness = 0;
    avgSat = 0;

    noStroke();

    //The nested loops sample pixels at a stride of PIXEL_JUMP.
    //This draws a grid of colored rectangles showing the sampled blocks and also accumulates HSB values.
    for (let x = 0; x < VID_WIDTH; x += PIXEL_JUMP) {
      for (let y = 0; y < VID_HEIGHT; y += PIXEL_JUMP) {
        let pixIndex = (y * VID_WIDTH + x) * 4;

        //read the values out of the pixel array
        let r = video.pixels[pixIndex];
        let g = video.pixels[pixIndex + 1];
        let b = video.pixels[pixIndex + 2];

        //we switch between color modes to work with HSB versus RGB
        colorMode(RGB, 255);
        let c = color(r, g, b);

        fill(r, g, b);
        rect(x, y, PIXEL_JUMP, PIXEL_JUMP);

        //Add Hue Saturation and brightness
        colorMode(HSB, 100);
        avgHue += hue(c);
        avgBrightness += brightness(c);
        avgSat += saturation(c);
      }
    }

    //average of pixels sampled in nested for loop
    //After accumulation you divide by numSampledPix to get averages.
    avgHue /= numSampledPix;
    avgBrightness /= numSampledPix;
    avgSat /= numSampledPix;

    // console.log(avgBrightness);

    fill(avgHue, avgSat, avgBrightness);
    rect(width * 0.75, 100, 40, 40);

    // change oscillator frequency based on avgBrightness
    //map() converts avg brightness/saturation into frequency and amplitude ranges.
    //oscillate.freq(value, 0.1) and .amp(value, 0.1) change the oscillator smoothly over 0.1 seconds.
    let frequency = map(avgBrightness, 0, 100, 40, 880, true);
    oscillate.freq(frequency, 0.1); //smooth the transitions by 0.1 seconds

    //change oscillator amplitude based on average Saturation
    let amplitude = map(avgSat, 0, 100, 0.01, 1, true);
    oscillate.amp(amplitude, 0.1); //smooth the transitions by 0.1 seconds

    //fft.waveform() returns an array of length usually 1024 (or 512) with values between -1 and 1 representing the instantaneous waveform. You pass that to drawWaveForm.
    let waveform = fft.waveform(); // analyze the waveform

    //x and y position to translate to, and third param is the waveform array
    drawWaveForm(width * 0.25, height * 0.75, waveform);
  } else {
    text("Click to Start", width / 2, height / 2);
  }
}

function mousePressed() {
  //start audio context on mouse press
  if (!audioContextOn) {
    audioContextOn = true;
    userStartAudio();

    //start all of your audio processes
    oscillate.start();
  } else {
    audioContextOn = false;
    oscillate.stop();
  }
}

//Using curveVertex for a smooth wave
function drawWaveForm(ox, oy, waveform) {
  let spacingX = (width * 0.5) / waveform.length;
  let waveAmplitude = 100;

  push();

  translate(ox, oy);

  fill(0);
  circle(0, 0, 10); //origin after translate at 0,0
  fill(0);
  text("0,0", -20, -5);

  stroke(0);
  strokeWeight(2);

  noFill();
  beginShape();

  for (let i = 0; i < waveform.length; i++) {
    let vX = spacingX * i;
    let vY = waveform[i] * waveAmplitude; //value between -1 to 1 multiplied by height

    //curve vertex in shape
    curveVertex(vX, vY);
  }
  endShape();

  pop();
}
