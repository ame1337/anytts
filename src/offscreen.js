// offscreen.js - Runs in the offscreen document to play audio

const audioPlayer = document.getElementById('tts-audio');
let ended = true;
// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  // Ensure the message is intended for the offscreen document
  if (message.target !== 'offscreen') {
    return;
  }

  switch (message.type) {
    case 'play-audio':
      if (message.audioData) {
        // console.log("Offscreen received play-audio command with data.");
        const uint8Array = new Uint8Array(message.audioData);
        const blob = new Blob([uint8Array], { type: 'audio/mp3' });

        // Create a URL and set it to an <audio> element
        const audioUrl = URL.createObjectURL(blob);
        audioPlayer.src = audioUrl;
      }
      // console.log("Offscreen received play-audio command. play/pause audio.");
      if (audioPlayer.paused) {
        audioPlayer.play()
          .catch(error => console.error("Error starting audio playback:", error));
      } else {
        audioPlayer.pause();
      }
      break;
    case 'stop-audio':
      // console.log("Offscreen received stop-audio command.");
      audioPlayer.pause();
      audioPlayer.currentTime = 0; // Reset playback position
      break;
    case 'download-audio':
      if (message.audioData) {
        // console.log("Offscreen received download-audio command with data.");
        const uint8Array = new Uint8Array(message.audioData);
        const blob = new Blob([uint8Array], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);

        chrome.runtime.sendMessage({
          target: 'background',
          source: 'offscreen',
          type: 'download-ready',
          url: audioUrl
        }).catch(err => console.error("Offscreen: Error sending download-ready message:", err));
      } else {
        console.log("No audio data received to download.");
      }
      break;
  }
});

// Fired when playback starts or resumes
audioPlayer.onplaying = () => {
  // console.log("Audio playback started/resumed.");
  ended = false;
  sendEventToBackground('audio-started');
};

// Fired when playback is paused
audioPlayer.onpause = () => {
  // console.log("onpause event fired.");
  if(audioPlayer.currentTime === 0) ended = true;
  sendEventToBackground('audio-paused');
};

// Fired when playback finishes naturally
audioPlayer.onended = () => {
  // console.log("Audio playback finished naturally.");
  ended = true;
  sendEventToBackground('audio-paused');
};

// Notify background about the error
audioPlayer.onerror = (e) => {
  // console.log("Audio player error:", e);
  sendEventToBackground('audio-error');
};

function sendEventToBackground(type) {
  chrome.runtime.sendMessage({
    target: 'background',
    source: 'offscreen',
    type: type,
    ended: ended
  }).catch(err => console.error("Offscreen: Error sending audio-event, message:", err));
}

// console.log("Offscreen script loaded.");
