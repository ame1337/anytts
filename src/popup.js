// popup.js - Logic for the extension's popup window

import setTheme from './style';

const playButton = document.getElementById('play-button');
const playButtonIcon = document.querySelector("#play-button>svg>use")
const stopButton = document.getElementById('stop-button');
const downloadButton = document.getElementById('download-button');
const playbackStatus = document.getElementById('playback-status');

setTheme();

// --- Load saved settings when popup opens ---
document.addEventListener('DOMContentLoaded', () => {
  // Get initial playback status from background script
  chrome.runtime.sendMessage({ target: 'background', type: 'get-status' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error getting initial status:", chrome.runtime.lastError.message);
      updatePlaybackUI(false, false, false, false); // Assume default state on error
    } else if (response) {
      // console.log("Initial status received:", response);
      updatePlaybackUI(
        response.audioExists,
        response.isPlaying,
        response.isPaused,
        response.hasCredentials
      );
    } else {
      console.log("No response received for initial status request.");
      updatePlaybackUI(false, false, false, false); // Assume default state
    }
  });
});

// --- Audio Controls ---
playButton.addEventListener('click', () => {
  // console.log("Play button clicked.");
  playButton.disabled = true; // Disable immediately
  chrome.runtime.sendMessage({ target: 'background', type: 'play-audio' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending play command:", chrome.runtime.lastError.message);
    } else if (response && response.success) {
      // console.log("Play command sent successfully.");
    } else {
      console.error("Play command failed or no response.");
    }
  });
});

stopButton.addEventListener('click', () => {
  // console.log("Stop button clicked.");
  stopButton.disabled = true; // Disable immediately
  chrome.runtime.sendMessage({ target: 'background', type: 'stop-audio' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending stop command:", chrome.runtime.lastError.message);
    } else if (response && response.success) {
      // console.log("Stop command sent successfully.");
    } else {
      console.error("Stop command failed or no response.");
    }
  });
});

downloadButton.addEventListener('click', () => {
  // console.log("Download button clicked.");
  downloadButton.disabled = true; // Disable immediately
  chrome.runtime.sendMessage({ target: 'background', type: 'download-audio' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending download command:", chrome.runtime.lastError.message);
    } else if (response && response.success) {
      // console.log("Download command sent successfully.");
    } else {
      console.error("Download command failed or no response.");
    }
  });
});

// --- Listen for status updates from background ---
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  // Ensure message is intended for the popup
  if (message.target === 'popup' && message.type === 'update-status') {
    // console.log("Received status update from background:", message);
    updatePlaybackUI(message.audioExists, message.isPlaying, message.isPaused, message.hasCredentials);
  }
});

// --- UI Update Functions ---
function updatePlaybackUI(audioExists, isPlaying, isPaused, hasCredentials) {
  if (isPlaying) {
    playbackStatus.textContent = "audio.mp3"; // Playing
    playButton.disabled = false; // Disable play button when playing
    // change icon to pause when playing
    playButtonIcon.setAttribute("href", "#fa-pause");
    stopButton.disabled = false; // Enable stop button only when playing
    downloadButton.disabled = false;
  } else if (!audioExists) {
    playbackStatus.textContent = "No audio"; // No audio
    playButtonIcon.setAttribute("href", "#fa-play");
    playButton.disabled = true; // Disable play button if no audio
    stopButton.disabled = true; // Disable stop button if no audio
    downloadButton.disabled = true;
  } else {
    playbackStatus.textContent = "audio.mp3"; // Idle
    playButtonIcon.setAttribute("href", "#fa-play");
    playButton.disabled = false; // Enable play button when not playing
    stopButton.disabled = !isPaused;
    downloadButton.disabled = false;
  }

  if (!hasCredentials) {
    document.getElementById('api-status').classList.remove("d-none");
  } else {
    document.getElementById('api-status').classList.add("d-none");
  }
}
