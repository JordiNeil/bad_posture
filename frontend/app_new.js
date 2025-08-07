// Test log to verify script is loading
console.log('🚀 PostureApp (New): JavaScript file loaded successfully!');
console.log('🔧 Debug mode: Enabled - Client-side MediaPipe processing');

let config = {}; // Initialize as empty object, will be populated in getInitialConfig
let pose = null; // MediaPipe Pose instance
let camera = null; // MediaPipe Camera instance
let selectedCameraDeviceId = null; // Selected webcam deviceId

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

function loadDailyStats() {
    const today = new Date().toDateString();
    const allHistoricalStats = localStorage.getItem('postureHistoricalStats');
    let historicalData = {};
    
    // Load all historical data
    if (allHistoricalStats) {
        try {
            historicalData = JSON.parse(allHistoricalStats);
            console.log('📚 Loaded historical stats for', Object.keys(historicalData).length, 'days');
        } catch (e) {
            console.error('Error loading historical stats:', e);
            historicalData = {};
        }
    }
    
    // Check if we have stats for today
    if (historicalData[today]) {
        dailyPostureStats = historicalData[today];
        
        // Migrate old data structure if needed
        if (!dailyPostureStats.totalActiveTime) {
            dailyPostureStats.totalActiveTime = 0;
        }
        if (!dailyPostureStats.lastActiveTimestamp) {
            dailyPostureStats.lastActiveTimestamp = null;
        }
        
        console.log('📊 Loaded today\'s stats:', dailyPostureStats);
    } else {
        console.log('📅 Creating new stats for today');
        dailyPostureStats = {
            date: today,
            totalBadPostureTime: 0,
            totalActiveTime: 0,
            sessions: [],
            lastActiveTimestamp: null
        };
        saveDailyStats();
    }
}

function saveDailyStats() {
    try {
        // Load existing historical data
        const allHistoricalStats = localStorage.getItem('postureHistoricalStats');
        let historicalData = {};
        
        if (allHistoricalStats) {
            try {
                historicalData = JSON.parse(allHistoricalStats);
            } catch (e) {
                console.error('Error parsing historical data:', e);
                historicalData = {};
            }
        }
        
        // Update today's data in the historical record
        historicalData[dailyPostureStats.date] = dailyPostureStats;
        
        // Save updated historical data
        localStorage.setItem('postureHistoricalStats', JSON.stringify(historicalData));
        
        const badPosturePercentage = dailyPostureStats.totalActiveTime > 0 
            ? (dailyPostureStats.totalBadPostureTime / dailyPostureStats.totalActiveTime * 100).toFixed(1)
            : 0;
        
        console.log('📊 Daily stats saved:', {
            date: dailyPostureStats.date,
            badPostureTime: formatTime(dailyPostureStats.totalBadPostureTime),
            totalActiveTime: formatTime(dailyPostureStats.totalActiveTime),
            badPosturePercentage: badPosturePercentage + '%',
            sessions: dailyPostureStats.sessions.length,
            totalDaysTracked: Object.keys(historicalData).length
        });
    } catch (e) {
        console.error('Error saving daily stats:', e);
    }
}

function updateDailyStats(badPostureDuration) {
    // Only record sessions with meaningful duration (more than 1 second)
    if (badPostureDuration > 1000) {
        dailyPostureStats.totalBadPostureTime += badPostureDuration;
        dailyPostureStats.sessions.push({
            timestamp: new Date().toISOString(),
            duration: badPostureDuration
        });
        saveDailyStats();
        updateDailyStatsDisplay();
        console.log('📊 Session recorded:', formatTime(badPostureDuration));
    } else {
        console.log('📊 Session too short, not recorded:', formatTime(badPostureDuration));
    }
}

function updateActiveTime() {
    // Only track active time when detection is running
    if (!isDetectionActive) {
        return;
    }
    
    const now = Date.now();
    
    // If this is the first update or resuming after a break
    if (!dailyPostureStats.lastActiveTimestamp) {
        dailyPostureStats.lastActiveTimestamp = now;
        return;
    }
    
    // Calculate time since last update
    const timeDiff = now - dailyPostureStats.lastActiveTimestamp;
    
    // Only add time if it's reasonable (less than 5 seconds to handle normal processing gaps)
    // This prevents adding huge chunks if the app was paused
    if (timeDiff > 0 && timeDiff < 5000) {
        dailyPostureStats.totalActiveTime += timeDiff;
        
        // Debug logging every 30 seconds
        if (Math.floor(dailyPostureStats.totalActiveTime / 30000) !== Math.floor((dailyPostureStats.totalActiveTime - timeDiff) / 30000)) {
            console.log('🕐 Active time update:', {
                totalActive: formatTime(dailyPostureStats.totalActiveTime),
                totalBad: formatTime(dailyPostureStats.totalBadPostureTime),
                percentage: dailyPostureStats.totalActiveTime > 0 
                    ? (dailyPostureStats.totalBadPostureTime / dailyPostureStats.totalActiveTime * 100).toFixed(1) + '%'
                    : '0%'
            });
        }
    } else if (timeDiff >= 5000) {
        console.log('⏸️ Gap detected in tracking:', formatTime(timeDiff), '- not adding to active time');
    }
    
    dailyPostureStats.lastActiveTimestamp = now;
}

function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

function updateDailyStatsDisplay() {
    const dailyStatsElement = document.getElementById('dailyStats');
    if (dailyStatsElement) {
        const badPostureTime = formatTime(dailyPostureStats.totalBadPostureTime);
        const totalActiveTime = formatTime(dailyPostureStats.totalActiveTime);
        const sessionsCount = dailyPostureStats.sessions.length;
        
        // Calculate percentage with safety checks
        let percentage = 0;
        if (dailyPostureStats.totalActiveTime > 0) {
            percentage = (dailyPostureStats.totalBadPostureTime / dailyPostureStats.totalActiveTime * 100);
            
            // Cap percentage at 100% if there's somehow an error
            if (percentage > 100) {
                console.error('⚠️ Percentage over 100%:', {
                    badPosture: dailyPostureStats.totalBadPostureTime,
                    totalActive: dailyPostureStats.totalActiveTime,
                    calculated: percentage
                });
                percentage = 100;
            }
            
            percentage = percentage.toFixed(1);
        }
        
        // Get total days tracked for context
        const allHistoricalStats = localStorage.getItem('postureHistoricalStats');
        let totalDays = 0;
        if (allHistoricalStats) {
            try {
                const historicalData = JSON.parse(allHistoricalStats);
                totalDays = Object.keys(historicalData).length;
            } catch (e) {
                console.error('Error reading historical data for display:', e);
            }
        }
        
        dailyStatsElement.textContent = `Today: ${badPostureTime} (${percentage}%) of ${totalActiveTime} | ${sessionsCount} sessions`;
    }
}

function getHistoricalStats() {
    const allHistoricalStats = localStorage.getItem('postureHistoricalStats');
    if (allHistoricalStats) {
        try {
            return JSON.parse(allHistoricalStats);
        } catch (e) {
            console.error('Error loading historical stats:', e);
            return {};
        }
    }
    return {};
}

function printHistoricalSummary() {
    const historicalData = getHistoricalStats();
    const dates = Object.keys(historicalData).sort();
    
    console.log('📚 Historical Posture Data Summary:');
    console.log('=====================================');
    
    let totalBadPostureTime = 0;
    let totalActiveTime = 0;
    let totalSessions = 0;
    
    dates.forEach(date => {
        const dayData = historicalData[date];
        const badPostureTime = formatTime(dayData.totalBadPostureTime);
        const activeTime = formatTime(dayData.totalActiveTime || 0);
        const percentage = dayData.totalActiveTime > 0 
            ? (dayData.totalBadPostureTime / dayData.totalActiveTime * 100).toFixed(1)
            : 0;
        
        totalBadPostureTime += dayData.totalBadPostureTime;
        totalActiveTime += (dayData.totalActiveTime || 0);
        totalSessions += dayData.sessions.length;
        
        console.log(`${date}: ${badPostureTime} (${percentage}%) of ${activeTime} • ${dayData.sessions.length} sessions`);
    });
    
    const overallPercentage = totalActiveTime > 0 
        ? (totalBadPostureTime / totalActiveTime * 100).toFixed(1)
        : 0;
    
    console.log('=====================================');
    console.log(`Total days tracked: ${dates.length}`);
    console.log(`Total bad posture time: ${formatTime(totalBadPostureTime)}`);
    console.log(`Total active time: ${formatTime(totalActiveTime)}`);
    console.log(`Overall bad posture percentage: ${overallPercentage}%`);
    console.log(`Total sessions: ${totalSessions}`);
    console.log('=====================================');
    
    return {
        totalDays: dates.length,
        totalBadPostureTime,
        totalActiveTime,
        totalSessions,
        overallPercentage,
        dailyData: historicalData
    };
}

function showHistoryModal() {
    const modal = document.getElementById('historyModal');
    const summarySectionEl = document.getElementById('historySummary');
    const detailsSectionEl = document.getElementById('historyDetails');
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Calculate and display summary
    const summary = printHistoricalSummary();
    const historicalData = getHistoricalStats();
    const dates = Object.keys(historicalData).sort().reverse(); // Most recent first
    
    // Create summary HTML
    summarySectionEl.innerHTML = `
        <div class="summary-grid">
            <div class="summary-item">
                <span class="summary-value">${summary.totalDays}</span>
                <div class="summary-label">Days Tracked</div>
            </div>
            <div class="summary-item">
                <span class="summary-value">${formatTime(summary.totalBadPostureTime)}</span>
                <div class="summary-label">Total Bad Posture</div>
            </div>
            <div class="summary-item">
                <span class="summary-value">${formatTime(summary.totalActiveTime)}</span>
                <div class="summary-label">Total Active Time</div>
            </div>
            <div class="summary-item">
                <span class="summary-value">${summary.overallPercentage}%</span>
                <div class="summary-label">Bad Posture %</div>
            </div>
        </div>
    `;
    
    // Create details HTML
    let detailsHTML = '';
    if (dates.length === 0) {
        detailsHTML = '<div class="loading">No historical data available yet.</div>';
    } else {
        detailsHTML = dates.map(date => {
            const dayData = historicalData[date];
            const badPostureTime = formatTime(dayData.totalBadPostureTime);
            const totalActiveTime = formatTime(dayData.totalActiveTime || 0);
            const percentage = dayData.totalActiveTime > 0 
                ? (dayData.totalBadPostureTime / dayData.totalActiveTime * 100).toFixed(1)
                : 0;
            const isToday = date === new Date().toDateString();
            
            return `
                <div class="history-day">
                    <div class="day-date">${isToday ? '📅 ' : ''}${date}${isToday ? ' (Today)' : ''}</div>
                    <div class="day-stats">${badPostureTime} (${percentage}%) of ${totalActiveTime} • ${dayData.sessions.length} sessions</div>
                </div>
            `;
        }).join('');
    }
    
    detailsSectionEl.innerHTML = detailsHTML;
}

function hideHistoryModal() {
    const modal = document.getElementById('historyModal');
    modal.classList.add('hidden');
}

let badPostureStartTime = null;
let lastAlertTime = null;
const ALERT_THRESHOLD = 10000; // 10 seconds in milliseconds
const cameraOverlay = document.querySelector('.camera-overlay');
let alertsEnabled = true;
let isProcessing = false;
let frameCount = 0;
let lastFrameTime = Date.now();

// Daily posture tracking
let dailyPostureStats = {
    date: null,
    totalBadPostureTime: 0, // in milliseconds
    totalActiveTime: 0, // total time the app was actively monitoring
    sessions: [],
    lastActiveTimestamp: null
};
let currentSessionStartTime = null;
let appStartTime = null;
let isDetectionActive = false;
let currentStream = null;
let processingInterval = null;
let processingSpeed = 200; // Default: medium speed (200ms)
let useRealTimeProcessing = false;
let rafId = null; // requestAnimationFrame id for real-time loop

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

async function enumerateCameras() {
    try {
        // Ensure we have permission to get device labels if no active stream
        if (!currentStream) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(t => t.stop());
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');

        const select = document.getElementById('cameraSelect');
        if (!select) return;
        // Clear current options except placeholder
        select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select a camera';
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);

        videoInputs.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Camera (${device.deviceId.substring(0, 6)})`;
            select.appendChild(option);
        });

        console.log('🎥 Cameras loaded:', videoInputs.map(v => v.label || v.deviceId));
    } catch (err) {
        console.error('Failed to enumerate cameras:', err);
        alert('Unable to list cameras. Ensure camera permission is granted.');
    }
}

async function startWebcam() {
    const video = document.getElementById('video');
    try {
        console.log('📹 Starting webcam...');
        
        // Stop existing stream if switching cameras
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        // Build constraints: prefer selected device if available
        let videoConstraints = { frameRate: { ideal: 15 } };
        if (selectedCameraDeviceId) {
            videoConstraints.deviceId = { exact: selectedCameraDeviceId };
        }

        currentStream = await navigator.mediaDevices.getUserMedia({ 
            video: videoConstraints
        });
        
        video.srcObject = currentStream;
        
        video.onloadedmetadata = async () => {
            console.log('📹 Video metadata loaded:', {
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                duration: video.duration
            });
            
            cameraOverlay.classList.add('hidden');

            // Mark detection active and start our own processing loop
            isDetectionActive = true;
            startProcessing();

            // Auto-populate camera selector now that permission has been granted
            try {
                await enumerateCameras();
            } catch (e) {
                console.warn('Could not auto-enumerate cameras after permission:', e);
            }
            
            console.log('📹 Camera started successfully');
        };
    } catch (error) {
        console.error('❌ Error accessing webcam:', error);
        cameraOverlay.textContent = 'Error accessing camera';
    }
}

function stopDetection() {
    console.log('🛑 Stopping detection...');
    
    // Stop active time tracking
    isDetectionActive = false;
    
    // Close any ongoing bad posture session
    if (badPostureStartTime && currentSessionStartTime) {
        const sessionDuration = Date.now() - currentSessionStartTime;
        
        // Ensure bad posture time never exceeds total active time
        if (dailyPostureStats.totalBadPostureTime + sessionDuration > dailyPostureStats.totalActiveTime) {
            console.warn('⚠️ Bad posture session would exceed total active time, adjusting...');
            const adjustedDuration = Math.max(0, dailyPostureStats.totalActiveTime - dailyPostureStats.totalBadPostureTime);
            console.log('📊 Adjusted session duration:', formatTime(adjustedDuration), 'instead of', formatTime(sessionDuration));
            updateDailyStats(adjustedDuration);
        } else {
            updateDailyStats(sessionDuration);
            console.log('📊 Final bad posture session ended:', formatTime(sessionDuration));
        }
    }
    
    // Reset tracking variables
    badPostureStartTime = null;
    currentSessionStartTime = null;
    dailyPostureStats.lastActiveTimestamp = null;
    
    // Stop processing interval/raf
    if (processingInterval) {
        clearInterval(processingInterval);
        processingInterval = null;
    }
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    
    // Stop MediaPipe Camera if it was ever started (we now avoid using it)
    if (camera) {
        try { camera.stop(); } catch (_) {}
        camera = null;
    }
    
    // Stop video stream
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    // Reset video element
    const video = document.getElementById('video');
    video.srcObject = null;
    
    // Show camera overlay
    const cameraOverlay = document.querySelector('.camera-overlay');
    cameraOverlay.classList.remove('hidden');
    cameraOverlay.textContent = 'Camera stopped';
    
    // Clear pose canvas
    const canvas = document.getElementById('pose-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset UI status
    const statusElement = document.getElementById('status');
    const timerElement = document.getElementById('timer');
    statusElement.textContent = 'Status: Detection stopped';
    statusElement.className = 'status-message';
    timerElement.classList.add('hidden');
    
    // Reset video container shadow
    const videoContainer = document.querySelector('.video-container');
    videoContainer.className = 'video-container';
    
    console.log('🛑 Detection stopped successfully');
}

function updateUI(data) {
    const statusElement = document.getElementById('status');
    const angleElement = document.getElementById('angle');
    const timerElement = document.getElementById('timer');
    const videoContainer = document.querySelector('.video-container');
    
    // Update active time tracking
    updateActiveTime();
    
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
            currentSessionStartTime = Date.now();
        }
        
        const duration = Math.floor((Date.now() - badPostureStartTime) / 1000);
        timerElement.textContent = `Bad Posture Time: ${duration}s`;
        
        if (duration >= config.alertInterval / 1000) {
            if (!lastAlertTime || (Date.now() - lastAlertTime) >= config.alertInterval) {
                playAlert();
                lastAlertTime = Date.now();
            }
        }
    } else {
        // When transitioning from bad to good posture, record the session
        if (badPostureStartTime && currentSessionStartTime) {
            const sessionDuration = Date.now() - currentSessionStartTime;
            
            // Ensure bad posture time never exceeds total active time
            if (dailyPostureStats.totalBadPostureTime + sessionDuration > dailyPostureStats.totalActiveTime) {
                console.warn('⚠️ Bad posture session would exceed total active time, adjusting...');
                const adjustedDuration = Math.max(0, dailyPostureStats.totalActiveTime - dailyPostureStats.totalBadPostureTime);
                console.log('📊 Adjusted session duration:', formatTime(adjustedDuration), 'instead of', formatTime(sessionDuration));
                updateDailyStats(adjustedDuration);
            } else {
                updateDailyStats(sessionDuration);
                console.log('📊 Bad posture session ended:', formatTime(sessionDuration));
            }
        }
        
        badPostureStartTime = null;
        currentSessionStartTime = null;
        timerElement.textContent = 'Bad Posture Time: 0s';
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
        alertInterval: 10000,  // Alert interval in milliseconds
        processingSpeed: 'medium' // Processing speed setting
    };
    
    console.log('Final config after loading:', config);
}

function updateConfigInputs() {
    // Update input fields with current config (only if elements exist)
    try {
        const maxGoodAngleElement = document.getElementById('maxGoodAngle');
        const alertIntervalElement = document.getElementById('alertInterval');
        const processingSpeedElement = document.getElementById('processingSpeed');
        
        console.log('Input elements found:', {
            maxGoodAngle: !!maxGoodAngleElement,
            alertInterval: !!alertIntervalElement,
            processingSpeed: !!processingSpeedElement
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
        
        if (processingSpeedElement) {
            console.log('Setting processingSpeed to:', config.processingSpeed);
            processingSpeedElement.value = config.processingSpeed || 'medium';
            updateProcessingSpeed(config.processingSpeed || 'medium');
        } else {
            console.warn('processingSpeed element not found');
        }
    } catch (inputError) {
        console.warn('Could not update input fields:', inputError);
    }
}

function updateProcessingSpeed(speedSetting) {
    const speedMap = {
        'fast': 'realtime',
        'medium': 200,
        'slow': 500
    };
    
    if (speedSetting === 'fast') {
        useRealTimeProcessing = true;
        console.log('🚀 Processing speed updated: Real-time (original MediaPipe speed)');
    } else {
        useRealTimeProcessing = false;
        processingSpeed = speedMap[speedSetting] || 200;
        console.log('🚀 Processing speed updated:', speedSetting, '(' + processingSpeed + 'ms)');
    }
    
    // If detection is active, restart the processing
    if (isDetectionActive) {
        if (processingInterval) {
            clearInterval(processingInterval);
            processingInterval = null;
        }
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        startProcessing();
    }
}

function startProcessing() {
    // Ensure any previous loops are stopped
    if (processingInterval) {
        clearInterval(processingInterval);
        processingInterval = null;
    }
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    const video = document.getElementById('video');
    if (!video) return;

    if (useRealTimeProcessing) {
        const loop = async () => {
            if (pose && isDetectionActive && video.readyState === 4) {
                try {
                    await pose.send({ image: video });
                } catch (e) {
                    console.error('pose.send error in RAF loop:', e);
                }
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        console.log('⏱️ Real-time processing enabled via requestAnimationFrame');
    } else {
        processingInterval = setInterval(() => {
            if (pose && isDetectionActive && video.readyState === 4) {
                pose.send({ image: video }).catch(e => console.error('pose.send error in interval loop:', e));
            }
        }, processingSpeed);
        console.log('⏱️ Processing interval started at', processingSpeed + 'ms');
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
    
    // Load daily posture stats
    loadDailyStats();
    updateDailyStatsDisplay();
    
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
            
            const processingSpeedElement = document.getElementById('processingSpeed');
            if (processingSpeedElement && !processingSpeedElement.value) {
                processingSpeedElement.value = config.processingSpeed || 'medium';
                updateProcessingSpeed(config.processingSpeed || 'medium');
                console.log('Delayed update: set processingSpeed to', config.processingSpeed || 'medium');
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
        
        var processingSpeedElement = document.getElementById('processingSpeed');
        
        if (!processingSpeedElement) {
            alert('Error: processingSpeed element not found');
            return;
        }
        
        var maxGoodAngle = parseInt(maxGoodAngleElement.value);
        var alertInterval = parseInt(alertIntervalElement.value) * 1000;
        var processingSpeedValue = processingSpeedElement.value;

        console.log('maxGoodAngle:', maxGoodAngle);
        console.log('alertInterval:', alertInterval);
        console.log('processingSpeed:', processingSpeedValue);

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
        config.processingSpeed = processingSpeedValue;
        
        // Apply processing speed change immediately
        updateProcessingSpeed(processingSpeedValue);
        
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
        const startButton = document.getElementById('startBtn');
        const stopButton = document.getElementById('stopBtn');
        const cameraSelect = document.getElementById('cameraSelect');
        
        startButton.disabled = true;
        startButton.textContent = 'Starting...';
        
        try {
            // Capture selected device before starting
            if (cameraSelect && cameraSelect.value) {
                selectedCameraDeviceId = cameraSelect.value;
            }
            await startWebcam();
            startButton.classList.add('hidden');
            stopButton.classList.remove('hidden');
            console.log('✅ Client-side processing started successfully');
        } catch (error) {
            console.error('❌ Error starting detection:', error);
            startButton.disabled = false;
            startButton.textContent = 'Start Detection';
        }
    });

    // Stop button event listener
    document.getElementById('stopBtn').addEventListener('click', () => {
        const startButton = document.getElementById('startBtn');
        const stopButton = document.getElementById('stopBtn');
        
        stopDetection();
        
        // Reset button states
        stopButton.classList.add('hidden');
        startButton.classList.remove('hidden');
        startButton.disabled = false;
        startButton.textContent = 'Start Detection';
        
        console.log('✅ Detection stopped by user');
    });

    // Reset configuration event listener
    document.getElementById('resetConfig').addEventListener('click', () => {
        try {
            // Reset to default configuration values
            config = {
                maxGoodAngle: 25,      // Good posture threshold
                alertInterval: 10000,  // Alert interval in milliseconds
                processingSpeed: 'medium' // Processing speed setting
            };
            
            // Update UI
            const maxGoodAngleElement = document.getElementById('maxGoodAngle');
            const alertIntervalElement = document.getElementById('alertInterval');
            const processingSpeedElement = document.getElementById('processingSpeed');
            
            if (maxGoodAngleElement) {
                maxGoodAngleElement.value = config.maxGoodAngle;
            }
            if (alertIntervalElement) {
                alertIntervalElement.value = config.alertInterval / 1000;
            }
            if (processingSpeedElement) {
                processingSpeedElement.value = config.processingSpeed;
                updateProcessingSpeed(config.processingSpeed);
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

    // Show history modal event listener
    document.getElementById('showHistory').addEventListener('click', () => {
        showHistoryModal();
    });

    // Close modal event listeners
    document.getElementById('closeModal').addEventListener('click', () => {
        hideHistoryModal();
    });

    // Close modal when clicking outside
    document.getElementById('historyModal').addEventListener('click', (e) => {
        if (e.target.id === 'historyModal') {
            hideHistoryModal();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideHistoryModal();
        }
    });
    // Load camera list button
    const loadCamerasBtn = document.getElementById('loadCameras');
    if (loadCamerasBtn) {
        loadCamerasBtn.addEventListener('click', async () => {
            await enumerateCameras();
        });
    }

    // Update selected camera when user changes selection
    const cameraSelect = document.getElementById('cameraSelect');
    if (cameraSelect) {
        cameraSelect.addEventListener('change', (e) => {
            selectedCameraDeviceId = e.target.value || null;
        });
    }
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