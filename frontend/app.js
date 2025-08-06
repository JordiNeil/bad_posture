// Test log to verify script is loading
console.log('🚀 PostureApp: JavaScript file loaded successfully!');
console.log('🔧 Debug mode: Enabled');

let config = {}; // Initialize as empty object, will be populated in getInitialConfig

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

async function startWebcam() {
    const video = document.getElementById('video');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            cameraOverlay.classList.add('hidden');
        };
    } catch (error) {
        console.error('Error accessing webcam:', error);
        cameraOverlay.textContent = 'Error accessing camera';
    }
}

async function sendFrame() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Log image size information
    console.log('📸 Frame Info:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        totalPixels: canvas.width * canvas.height,
        aspectRatio: (canvas.width / canvas.height).toFixed(2)
    });
    
    const frame = canvas.toDataURL('image/jpeg');
    const blob = await (await fetch(frame)).blob();
    
    // Log image file size
    console.log('💾 Image Data:', {
        blobSize: blob.size,
        blobSizeKB: (blob.size / 1024).toFixed(2),
        blobType: blob.type,
        dataURLLength: frame.length,
        dataURLSizeKB: (frame.length / 1024).toFixed(2)
    });
    
    const formData = new FormData();
    formData.append('file', blob, 'frame.jpg');
    
    try {
        const startTime = performance.now();
        const response = await fetch('/api/process-image', {
            method: 'POST',
            body: formData
        });
        const endTime = performance.now();
        const data = await response.json();
        
        // Log processing timing
        console.log('⚡ Processing Time:', {
            requestDuration: (endTime - startTime).toFixed(2) + 'ms',
            responseSize: JSON.stringify(data).length,
            landmarksCount: data.landmarks ? data.landmarks.length : 0
        });
        
        updateUI(data);
    } catch (error) {
        console.error('Error sending frame:', error);
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
    
    // Draw pose markers if landmarks are available
    if (data.landmarks) {
        drawPoseMarkers(data.landmarks);
    }
    
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

function drawPoseMarkers(landmarks) {
    const canvas = document.getElementById('pose-canvas');
    const ctx = canvas.getContext('2d');
    const video = document.getElementById('video');
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw landmarks
    landmarks.forEach((landmark, index) => {
        if (landmark.visibility > 0.5) {
            ctx.beginPath();
            ctx.arc(
                landmark.x * canvas.width,
                landmark.y * canvas.height,
                3,
                0,
                2 * Math.PI
            );
            ctx.fillStyle = '#00FF00';
            ctx.fill();
        }
    });
    
    // Draw connections (simplified version - you can add more connections as needed)
    drawConnections(ctx, landmarks, canvas.width, canvas.height);
}

function drawConnections(ctx, landmarks, width, height) {
    // Define some basic connections (you can add more)
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
        maxGoodAngle: 15,      // Good posture threshold
        alertInterval: 10000   // Alert interval in milliseconds
    };
    
    console.log('Final config after loading:', config);
    
    // Update input fields with current config (optional - don't fail if elements missing)
    try {
        const maxGoodAngleElement = document.getElementById('maxGoodAngle');
        const alertIntervalElement = document.getElementById('alertInterval');
        
        console.log('Input elements found:', {
            maxGoodAngle: !!maxGoodAngleElement,
            alertInterval: !!alertIntervalElement
        });
        
        if (maxGoodAngleElement) {
            try {
                console.log('Setting maxGoodAngle to:', config.maxGoodAngle);
                maxGoodAngleElement.value = config.maxGoodAngle;
            } catch (e) {
                console.warn('Could not set maxGoodAngle value:', e);
            }
        } else {
            console.warn('maxGoodAngle element not found - will retry later');
        }
        
        if (alertIntervalElement) {
            try {
                console.log('Setting alertInterval to:', config.alertInterval / 1000);
                alertIntervalElement.value = config.alertInterval / 1000;
            } catch (e) {
                console.warn('Could not set alertInterval value:', e);
            }
        } else {
            console.warn('alertInterval element not found - will retry later');
        }
    } catch (inputError) {
        console.warn('Could not update input fields (will retry later):', inputError);
        console.log('DOM state - document.readyState:', document.readyState);
        console.log('DOM state - all input elements:', document.querySelectorAll('input').length);
    }
}

// Move all DOM-dependent code into DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
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
    
    // Small delay to ensure DOM is fully ready, then try to update fields again
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
            setInterval(sendFrame, 200); // Send frame every second
            button.textContent = 'Detection Active';
        } catch (error) {
            console.error('Error starting detection:', error);
            button.disabled = false;
            button.textContent = 'Start Detection';
        }
    });

    // Reset configuration event listener
    document.getElementById('resetConfig').addEventListener('click', () => {
        try {
            // Reset to default configuration values
            config = {
                maxGoodAngle: 15,      // Good posture threshold
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