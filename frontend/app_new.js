// Test log to verify script is loading
console.log('🚀 PostureApp (New): JavaScript file loaded successfully!');
console.log('🔧 Debug mode: Enabled - Client-side MediaPipe processing');

let config = {}; // Initialize as empty object, will be populated in getInitialConfig
let pose = null; // MediaPipe Pose instance
let camera = null; // MediaPipe Camera instance

function loadConfig() {
    const storedConfig = localStorage.getItem('postureConfig');
    if (storedConfig) {
        try {
            return JSON.parse(storedConfig);
        } catch (e) {
            console.error('Error loading stored config:', e);
            return null;
        }
    }
    return null;
}

function saveConfigToStorage() {
    try {
        console.log('Attempting to save config:', config);
        
        // Test localStorage first
        localStorage.setItem('test', 'test');
        const test = localStorage.getItem('test');
        console.log('localStorage test:', test);
        localStorage.removeItem('test');
        
        localStorage.setItem('postureConfig', JSON.stringify(config));
        console.log('Configuration saved to storage');
        
        // Verify immediately
        const verification = localStorage.getItem('postureConfig');
        console.log('Verification - saved data:', verification);
        console.log('Verification - parsed data:', JSON.parse(verification));
    } catch (e) {
        console.error('Error saving config to storage:', e);
    }
}

let badPostureStartTime = null;
let lastAlertTime = null;
const ALERT_THRESHOLD = 10000; // 10 seconds in milliseconds
const cameraOverlay = document.querySelector('.camera-overlay');
let alertsEnabled = true;
let isProcessing = false;
let frameCount = 0;
let lastFrameTime = Date.now();

// MediaPipe setup
async function initializeMediaPipe() {
    try {
        console.log('🤖 Initializing MediaPipe...');
        
        // Initialize MediaPipe Pose
        pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });

        pose.setOptions({
            modelComplexity: 1, // 0, 1, or 2. Higher = more accurate but slower
            smoothLandmarks: true,
            enableSegmentation: false, // We don't need segmentation for posture
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults(onPoseResults);
        
        console.log('✅ MediaPipe initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Error initializing MediaPipe:', error);
        return false;
    }
}

function onPoseResults(results) {
    if (isProcessing) return; // Skip if still processing previous frame
    isProcessing = true;
    
    try {
        frameCount++;
        const currentTime = Date.now();
        const fps = frameCount / ((currentTime - lastFrameTime) / 1000);
        
        // Log performance info every 30 frames
        if (frameCount % 30 === 0) {
            console.log('📊 Performance Stats:', {
                fps: fps.toFixed(1),
                frameCount: frameCount,
                processingTime: (currentTime - lastFrameTime).toFixed(2) + 'ms'
            });
        }
        
        const canvas = document.getElementById('pose-canvas');
        const ctx = canvas.getContext('2d');
        const video = document.getElementById('video');
        
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Clear previous drawings
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.poseLandmarks) {
            // Log landmark info
            console.log('🎯 Pose detected:', {
                landmarksCount: results.poseLandmarks.length,
                visibility: results.poseLandmarks.map(l => l.visibility).slice(0, 5) // First 5 for brevity
            });
            
            // Calculate neck angles
            const angles = calculateNeckAngles(results.poseLandmarks);
            
            // Draw pose markers
            drawPoseMarkers(results.poseLandmarks, ctx, canvas.width, canvas.height);
            
            // Update UI with pose data
            updateUI({ angles: angles, landmarks: results.poseLandmarks });
        } else {
            console.log('❌ No pose detected');
            updateUI({ error: "No pose detected" });
        }
    } catch (error) {
        console.error('Error processing pose results:', error);
        updateUI({ error: error.message });
    } finally {
        isProcessing = false;
    }
}

function calculateNeckAngles(landmarks) {
    // MediaPipe landmark indices
    const RIGHT_SHOULDER = 12;
    const LEFT_SHOULDER = 11;
    const RIGHT_EAR = 8;
    const LEFT_EAR = 7;
    
    // Get landmark positions
    const rightShoulder = landmarks[RIGHT_SHOULDER];
    const rightEar = landmarks[RIGHT_EAR];
    const leftShoulder = landmarks[LEFT_SHOULDER];
    const leftEar = landmarks[LEFT_EAR];
    
    console.log('📐 Landmark positions:', {
        rightShoulder: { x: rightShoulder.x, y: rightShoulder.y, visibility: rightShoulder.visibility },
        rightEar: { x: rightEar.x, y: rightEar.y, visibility: rightEar.visibility },
        leftShoulder: { x: leftShoulder.x, y: leftShoulder.y, visibility: leftShoulder.visibility },
        leftEar: { x: leftEar.x, y: leftEar.y, visibility: leftEar.visibility }
    });
    
    // Calculate head forward angles from vertical
    // Positive angle = head forward (bad posture)
    // 0° = head directly above shoulders (perfect posture)
    
    // For right side: measure how far forward the ear is from shoulder
    const rightDx = rightEar.x - rightShoulder.x; // horizontal distance
    const rightDy = rightShoulder.y - rightEar.y; // vertical distance (inverted y-axis)
    const rightAngle = Math.abs(Math.atan2(Math.abs(rightDx), Math.max(rightDy, 0.001))) * (180 / Math.PI);
    
    // For left side: same calculation
    const leftDx = leftEar.x - leftShoulder.x; // horizontal distance  
    const leftDy = leftShoulder.y - leftEar.y; // vertical distance (inverted y-axis)
    const leftAngle = Math.abs(Math.atan2(Math.abs(leftDx), Math.max(leftDy, 0.001))) * (180 / Math.PI);
    
    // Calculate visibility scores
    const rightVisibility = Math.min(rightEar.visibility, rightShoulder.visibility);
    const leftVisibility = Math.min(leftEar.visibility, leftShoulder.visibility);
    
    const angles = {};
    if (rightVisibility > 0.5) {
        angles.right = rightAngle;
    }
    if (leftVisibility > 0.5) {
        angles.left = leftAngle;
    }
    
    console.log('📏 Calculated angles:', {
        right: angles.right?.toFixed(1) + '°',
        left: angles.left?.toFixed(1) + '°',
        rightVisibility: rightVisibility.toFixed(2),
        leftVisibility: leftVisibility.toFixed(2)
    });
    
    if (Object.keys(angles).length === 0) {
        throw new Error("No clear view of neck angle");
    }
    
    return angles;
}

async function startWebcam() {
    const video = document.getElementById('video');
    try {
        console.log('📹 Starting webcam...');
        
        // Request webcam with specific constraints for better performance
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 15, max: 30 }
            } 
        });
        
        video.srcObject = stream;
        
        video.onloadedmetadata = async () => {
            console.log('📹 Video metadata loaded:', {
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                duration: video.duration
            });
            
            cameraOverlay.classList.add('hidden');
            
            // Initialize camera for MediaPipe
            camera = new Camera(video, {
                onFrame: async () => {
                    if (pose) {
                        await pose.send({ image: video });
                    }
                },
                width: video.videoWidth,
                height: video.videoHeight
            });
            
            await camera.start();
            console.log('📹 Camera started successfully');
        };
    } catch (error) {
        console.error('❌ Error accessing webcam:', error);
        cameraOverlay.textContent = 'Error accessing camera';
    }
}

function updateUI(data) {
    const statusElement = document.getElementById('status');
    const angleElement = document.getElementById('angle');
    const timerElement = document.getElementById('timer');
    const videoContainer = document.querySelector('.video-container');
    
    if (data.error) {
        statusElement.textContent = `Status: ${data.error}`;
        statusElement.className = 'status-message';
        videoContainer.className = 'video-container';  // Reset shadow
        return;
    }
    
    // Frontend posture evaluation based on angles and local config
    const angles = data.angles;
    let isGood = true;
    let statusText = '';
    
    // Determine if posture is good or bad based on frontend config
    for (const side in angles) {
        if (angles[side] > config.maxGoodAngle) {
            isGood = false;
            break;
        }
    }
    
    // Create status message
    if (isGood) {
        if (angles.right !== undefined && angles.left !== undefined) {
            // Both sides visible
            const avgAngle = (angles.right + angles.left) / 2;
            if (avgAngle <= 5) {
                statusText = "Excellent Posture!";
            } else {
                statusText = `Good Posture - ${avgAngle.toFixed(1)}° forward`;
            }
        } else {
            // Only one side visible
            const angle = angles.right || angles.left;
            if (angle <= 5) {
                statusText = "Excellent Posture!";
            } else {
                statusText = `Good Posture - ${angle.toFixed(1)}° forward`;
            }
        }
    } else {
        if (angles.right !== undefined && angles.left !== undefined) {
            const avgAngle = (angles.right + angles.left) / 2;
            statusText = `Bad Posture - ${avgAngle.toFixed(1)}° forward. Pull your head back!`;
        } else {
            const angle = angles.right || angles.left;
            statusText = `Bad Posture - ${angle.toFixed(1)}° forward. Straighten your neck!`;
        }
    }
    
    // Update status with appropriate styling
    statusElement.textContent = statusText;
    statusElement.className = 'status-message ' + (isGood ? 'good-posture' : 'bad-posture');
    
    // Update video container shadow
    videoContainer.className = 'video-container ' + 
        (isGood ? 'good-posture-shadow' : 'bad-posture-shadow');

    // Display head forward angles with simple good/bad classification
    let angleText = 'Head Position: ';
    
    if (angles.right !== undefined && angles.left !== undefined) {
        // Both sides visible - show average and individual
        const avgAngle = (angles.right + angles.left) / 2;
        const angleIsGood = avgAngle <= config.maxGoodAngle;
        
        if (avgAngle <= 5) {
            angleText += `Perfect (${avgAngle.toFixed(1)}° forward)`;
        } else if (angleIsGood) {
            angleText += `${avgAngle.toFixed(1)}° forward (Good)`;
        } else {
            angleText += `${avgAngle.toFixed(1)}° forward (Bad)`;
        }
        
        // Add individual side details
        angleText += ` | R: ${angles.right.toFixed(1)}°, L: ${angles.left.toFixed(1)}°`;
    } else if (angles.right !== undefined) {
        // Only right side visible
        const angle = angles.right;
        const angleIsGood = angle <= config.maxGoodAngle;
        
        if (angle <= 5) {
            angleText += `Perfect (${angle.toFixed(1)}° forward)`;
        } else if (angleIsGood) {
            angleText += `${angle.toFixed(1)}° forward (Good)`;
        } else {
            angleText += `${angle.toFixed(1)}° forward (Bad)`;
        }
        angleText += ' (Right side)';
    } else if (angles.left !== undefined) {
        // Only left side visible
        const angle = angles.left;
        const angleIsGood = angle <= config.maxGoodAngle;
        
        if (angle <= 5) {
            angleText += `Perfect (${angle.toFixed(1)}° forward)`;
        } else if (angleIsGood) {
            angleText += `${angle.toFixed(1)}° forward (Good)`;
        } else {
            angleText += `${angle.toFixed(1)}° forward (Bad)`;
        }
        angleText += ' (Left side)';
    }
    
    angleElement.textContent = angleText;
    angleElement.className = 'metric angle-display';
    
    // Timer and alert logic
    if (!isGood) {
        if (!badPostureStartTime) {
            badPostureStartTime = Date.now();
        }
        
        const duration = Math.floor((Date.now() - badPostureStartTime) / 1000);
        timerElement.textContent = `Bad Posture Time: ${duration}s`;
        timerElement.classList.remove('hidden');
        
        if (duration >= config.alertInterval / 1000) {
            if (!lastAlertTime || (Date.now() - lastAlertTime) >= config.alertInterval) {
                playAlert();
                lastAlertTime = Date.now();
            }
        }
    } else {
        badPostureStartTime = null;
        timerElement.classList.add('hidden');
    }
}

function playAlert() {
    if (!alertsEnabled) return;
    const audio = new Audio('sounds/soft-alert.mp3');
    audio.play().catch(e => console.log('Error playing sound:', e));
}

function drawPoseMarkers(landmarks, ctx, width, height) {
    // Draw landmarks
    landmarks.forEach((landmark, index) => {
        if (landmark.visibility > 0.5) {
            ctx.beginPath();
            ctx.arc(
                landmark.x * width,
                landmark.y * height,
                3,
                0,
                2 * Math.PI
            );
            ctx.fillStyle = '#00FF00';
            ctx.fill();
        }
    });
    
    // Draw connections
    drawConnections(ctx, landmarks, width, height);
}

function drawConnections(ctx, landmarks, width, height) {
    // Define some basic connections
    const connections = [
        // Shoulders
        [11, 12],
        // Right arm
        [11, 13],
        [13, 15],
        // Left arm
        [12, 14],
        [14, 16],
        // Right ear to shoulder
        [8, 12],
        // Left ear to shoulder
        [7, 11]
    ];
    
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    
    connections.forEach(([i, j]) => {
        const start = landmarks[i];
        const end = landmarks[j];
        
        if (start.visibility > 0.5 && end.visibility > 0.5) {
            ctx.beginPath();
            ctx.moveTo(start.x * width, start.y * height);
            ctx.lineTo(end.x * width, end.y * height);
            ctx.stroke();
        }
    });
}

function getInitialConfig() {
    console.log('Loading initial config...');
    
    // Load stored config if it exists
    const storedConfig = loadConfig();
    console.log('Stored config:', storedConfig);
    
    // Use stored config or default values
    config = storedConfig || {
        maxGoodAngle: 25,      // Good posture threshold
        alertInterval: 10000   // Alert interval in milliseconds
    };
    
    console.log('Final config after loading:', config);
}

function updateConfigInputs() {
    // Update input fields with current config (only if elements exist)
    try {
        const maxGoodAngleElement = document.getElementById('maxGoodAngle');
        const alertIntervalElement = document.getElementById('alertInterval');
        
        console.log('Input elements found:', {
            maxGoodAngle: !!maxGoodAngleElement,
            alertInterval: !!alertIntervalElement
        });
        
        if (maxGoodAngleElement) {
            console.log('Setting maxGoodAngle to:', config.maxGoodAngle);
            maxGoodAngleElement.value = config.maxGoodAngle;
        } else {
            console.warn('maxGoodAngle element not found');
        }
        
        if (alertIntervalElement) {
            console.log('Setting alertInterval to:', config.alertInterval / 1000);
            alertIntervalElement.value = config.alertInterval / 1000;
        } else {
            console.warn('alertInterval element not found');
        }
    } catch (inputError) {
        console.warn('Could not update input fields:', inputError);
    }
}

// Move all DOM-dependent code into DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded');
    
    // Debug: Check if key elements exist
    const saveBtn = document.getElementById('saveConfig');
    const resetBtn = document.getElementById('resetConfig');
    const maxGoodAngle = document.getElementById('maxGoodAngle');
    const alertInterval = document.getElementById('alertInterval');
    
    console.log('Elements found:', {
        saveBtn: !!saveBtn,
        resetBtn: !!resetBtn,
        maxGoodAngle: !!maxGoodAngle,
        alertInterval: !!alertInterval
    });
    
    getInitialConfig();
    updateConfigInputs();
    
    // Initialize MediaPipe
    const mediaPipeReady = await initializeMediaPipe();
    if (!mediaPipeReady) {
        console.error('❌ Failed to initialize MediaPipe');
        return;
    }
    
    // Small delay to ensure DOM is fully ready, then try to update fields again if they weren't set
    setTimeout(() => {
        if (config.maxGoodAngle !== undefined) {
            const maxGoodAngleElement = document.getElementById('maxGoodAngle');
            const alertIntervalElement = document.getElementById('alertInterval');
            
            if (maxGoodAngleElement && !maxGoodAngleElement.value) {
                maxGoodAngleElement.value = config.maxGoodAngle;
                console.log('Delayed update: set maxGoodAngle to', config.maxGoodAngle);
            }
            
            if (alertIntervalElement && !alertIntervalElement.value) {
                alertIntervalElement.value = config.alertInterval / 1000;
                console.log('Delayed update: set alertInterval to', config.alertInterval / 1000);
            }
        }
    }, 100);
    
    // Save configuration event listener
    document.getElementById('saveConfig').addEventListener('click', function() {
        console.log('Save button clicked');
        
        // Debug: Check if elements exist
        var maxGoodAngleElement = document.getElementById('maxGoodAngle');
        var alertIntervalElement = document.getElementById('alertInterval');
        
        console.log('maxGoodAngleElement:', maxGoodAngleElement);
        console.log('alertIntervalElement:', alertIntervalElement);
        
        if (!maxGoodAngleElement) {
            alert('Error: maxGoodAngle element not found');
            return;
        }
        
        if (!alertIntervalElement) {
            alert('Error: alertInterval element not found');
            return;
        }
        
        var maxGoodAngle = parseInt(maxGoodAngleElement.value);
        var alertInterval = parseInt(alertIntervalElement.value) * 1000;

        console.log('maxGoodAngle:', maxGoodAngle);
        console.log('alertInterval:', alertInterval);

        // Validate input
        if (maxGoodAngle < 5 || maxGoodAngle > 40) {
            alert('Posture threshold must be between 5 and 40 degrees');
            return;
        }

        if (alertInterval < 1000) {
            alert('Alert interval must be at least 1 second');
            return;
        }

        // Update config with new values
        config.maxGoodAngle = maxGoodAngle;
        config.alertInterval = alertInterval;
        
        console.log('Config before saving:', config);
        
        // Save to local storage
        saveConfigToStorage();
        
        // Verify it was saved
        var savedConfig = localStorage.getItem('postureConfig');
        console.log('Saved config in localStorage:', savedConfig);
        
        console.log('Configuration updated:', config);
        alert('Settings saved successfully!');
    });

    // Start button event listener
    document.getElementById('startBtn').addEventListener('click', async () => {
        const button = document.getElementById('startBtn');
        button.disabled = true;
        button.textContent = 'Starting...';
        
        try {
            await startWebcam();
            button.textContent = 'Detection Active';
            console.log('✅ Client-side processing started successfully');
        } catch (error) {
            console.error('❌ Error starting detection:', error);
            button.disabled = false;
            button.textContent = 'Start Detection';
        }
    });

    // Reset configuration event listener
    document.getElementById('resetConfig').addEventListener('click', () => {
        try {
            // Reset to default configuration values
            config = {
                maxGoodAngle: 25,      // Good posture threshold
                alertInterval: 10000   // Alert interval in milliseconds
            };
            
            // Update UI
            const maxGoodAngleElement = document.getElementById('maxGoodAngle');
            const alertIntervalElement = document.getElementById('alertInterval');
            
            if (maxGoodAngleElement) {
                maxGoodAngleElement.value = config.maxGoodAngle;
            }
            if (alertIntervalElement) {
                alertIntervalElement.value = config.alertInterval / 1000;
            }
            
            // Clear stored config
            localStorage.removeItem('postureConfig');
            
            console.log('Reset to default configuration');
            alert('Settings reset to default values!');
        } catch (error) {
            console.error('Error resetting configuration:', error);
        }
    });

    // Toggle alert event listener
    const toggleAlertBtn = document.getElementById('toggleAlert');
    toggleAlertBtn.addEventListener('click', () => {
        alertsEnabled = !alertsEnabled;
        if (alertsEnabled) {
            toggleAlertBtn.innerHTML = '<span class="alert-icon">🔔</span> Alerts Enabled';
            toggleAlertBtn.classList.remove('disabled');
        } else {
            toggleAlertBtn.innerHTML = '<span class="alert-icon">🔕</span> Alerts Disabled';
            toggleAlertBtn.classList.add('disabled');
        }
    });
});

// Immediate test when script loads
console.log('📋 Script execution complete');
console.log('📄 Document ready state:', document.readyState);
console.log('🌐 Location:', window.location.href);

// Test if we can access basic DOM elements
setTimeout(() => {
    console.log('⏰ Delayed DOM test (after 500ms):');
    console.log('🎯 Save button exists:', !!document.getElementById('saveConfig'));
    console.log('🎯 Input field exists:', !!document.getElementById('maxGoodAngle'));
    console.log('📊 Total input elements:', document.querySelectorAll('input').length);
}, 500); 