// background.js - Handles context menu, Azure API call, and audio playback coordination

import replaceRomanNumerals from './roman-numbers';

// --- Constants ---
const AZURE_TTS_ENDPOINT_TEMPLATE = "https://{region}.tts.speech.microsoft.com/cognitiveservices/v1";
const CONTEXT_MENU_ID = "readAloudGeorgian";
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// --- State ---
let azureKey = '';
let azureRegion = '';
let azureVoice = ''; // Default voice
let audioExists = false; // Check if audio source exists for playback
let isPlaying = false; // Track if audio is currently playing
let isPaused = false;
let savedAudioBuffer = null; // Store audio buffer for playback

// --- Initialization ---
loadCredsAndState();

function loadState() {
  audioExists = !!savedAudioBuffer; // Check if audio source exists for playback
  updateContextMenu();
  updatePopupState();
  // console.log("Background script state loaded.");
}

function loadCredsAndState() {
  chrome.storage.local.get(['azureKey', 'azureRegion', 'azureVoice'], (result) => {
    if (result.azureKey) azureKey = atob(result.azureKey);
    azureRegion = result.azureRegion || '';
    azureVoice = result.azureVoice?.replace(/_Male|_Female/, '') || '';
    // console.log('Loaded Azure credentials:', { key: !!azureKey, region: azureRegion, voice: azureVoice });
    loadState();
  });
}

// --- Context Menu ---
function createContextMenu() {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Read Aloud",
    contexts: ["selection"], // Show only when text is selected
    enabled: hasCredentials() // Initially enable only if key/region are set
  }, () => {
    if (chrome.runtime.lastError) {
      // console.log("Context menu already exists creating failed.");
      // console.log(chrome.runtime.lastError.message);
    } else {
      // console.log("Context menu enabled state updated:", hasCredentials());
    }
  });
}

function updateContextMenu() {
  // Update the existing menu's enabled state
  chrome.contextMenus.update(CONTEXT_MENU_ID, {
    enabled: hasCredentials()
  }, () => {
    if (chrome.runtime.lastError) {
      // If the menu doesn't exist yet (e.g., on first install before onInstalled runs), create it.
      // console.log("Context menu not found for update, creating now.");
      createContextMenu();
    } else {
      // console.log("Context menu enabled state updated:", hasCredentials());
    }
  });
}

// Function to inform the popup about the current playback state
function updatePopupState() {
  chrome.runtime.sendMessage({
    target: 'popup', // Target popup specifically
    type: 'update-status',
    audioExists: audioExists,
    isPlaying: isPlaying,
    isPaused: isPaused,
    hasCredentials: hasCredentials()
  }).catch(err => {
    // Ignore error if popup is not open
    if (err.message.includes("Could not establish connection") || err.message.includes("Receiving end does not exist")) {
      // console.log("Popup not open, skipping state update.");
    } else {
      console.error("Error sending status update to popup:", err);
    }
  });
}

// --- Audio Playback via Offscreen Document ---
async function hasOffscreenDocument(path) {
  // Check all existing contexts for a document matching the given path.
  const offscreenUrl = chrome.runtime.getURL(path);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  return contexts.length > 0;
}

async function setupOffscreenDocument(path) {
  const state = await hasOffscreenDocument(path);
  if (state) {
    // console.log("Offscreen document already exists.");
  } else {
    // console.log("Creating offscreen document.");
    await chrome.offscreen.createDocument({
      url: path,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Playing audio from Azure TTS service.',
    }).catch(error => {
      console.error("Failed to create offscreen document:", error);
    });
  }
}

// --- Azure TTS API Call ---
async function synthesizeSpeech(text) {
  if (!hasCredentials()) {
    // console.log("Cannot synthesize speech: Azure API not configured.");
    // Optional: Notify user again or disable functionality
    return;
  }

  // Ensure audio is stopped before synthesizing
  const isOffscreenDocumentAvailable = await hasOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
  if (isOffscreenDocumentAvailable) {
    stopAudio();
  }

  let filteredText = filterText(text);
  if (!filteredText) return;

  if (/[ა-ჰ]/u.test(filteredText)) {
    filteredText = replaceRomanNumerals(filteredText);
  }

  const endpoint = AZURE_TTS_ENDPOINT_TEMPLATE.replace('{region}', azureRegion);
  const ssml = `
    <speak version='1.0' xml:lang='en-US'>
        <voice name='${azureVoice}'>
            ${filteredText}
        </voice>
    </speak>`;

  // console.log("Sending request to Azure TTS:", endpoint);
  // set badge
  chrome.action.setBadgeText({ text: '⏳' });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
      },
      body: ssml
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Azure TTS API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    // console.log("Azure TTS response successful.");

    const audioBuffer = await response.arrayBuffer();
    // console.log("Audio buffer received");
    // Store the audio buffer for playback
    savedAudioBuffer = audioBuffer;
    playAudio(audioBuffer);

  } catch (error) {
    console.log("Error calling Azure TTS API:", error.message);
  } finally {
    // remove badge
    chrome.action.setBadgeText({ text: '' });
  }
}

async function playAudio(audioBuffer) {
  // Check if audio buffer is available for playback
  if (!audioBuffer) {
    // console.log("No audio buffer available for playback.");
    updatePopupState();
    return;
  }

  const isOffscreenDocumentAvailable = await hasOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);

  if (isOffscreenDocumentAvailable) {
    // is Offscreen document is available it means we have audio
    if (isPlaying || isPaused) {
      sendAudio(null);
      return;
    }
  } else {
    // Ensure the offscreen document is ready before trying to play
    await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
  }


  // console.log("sending audio to offscreen document.");
  // prepare the audio data for transfer and send it to the offscreen document
  const data = prepAudio(audioBuffer);
  sendAudio(data);
}

async function downloadAudio(audioBuffer) {
  await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
  const data = prepAudio(audioBuffer);
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'download-audio',
    audioData: data
  }).catch(error => {
    console.error("Error sending download-audio command to offscreen document:", error);
  });
}

function prepAudio(audioBuffer = null) {
  if (!audioBuffer) return null;
  const data = new Uint8Array(audioBuffer);
  return Array.from(data);
}

function sendAudio(data) {
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'play-audio',
    audioData: data
  }).catch(error => {
    console.error("Error sending message to offscreen document:", error);
  });
  audioExists = !!savedAudioBuffer;
}

function stopAudio() {
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'stop-audio'
  }).catch(error => console.error("Error sending stop message:", error));
}

function hasCredentials() {
  return !!azureKey && !!azureRegion && !!azureVoice;
}

// Helper to filter text for SSML
function filterText(text) {
  if (!text) return '';
  return text.replace(/[<>&]/g, '').replace(/\s{2,}/g, ' ').replace(/\[(\d+)\]/g, '');
}

// Listen for changes in storage (e.g., when credentials are updated in the popup)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.azureKey) {
      if (changes.azureKey.newValue) azureKey = atob(changes.azureKey.newValue);
      else azureKey = '';
      // console.log('Azure Key updated:', !!azureKey);
    }
    if (changes.azureRegion) {
      azureRegion = changes.azureRegion.newValue || '';
      // console.log('Azure Region updated:', azureRegion);
    }
    if (changes.azureVoice) {
      azureVoice = changes.azureVoice.newValue?.replace(/_Male|_Female/, '') || '';
      // console.log('Azure Voice updated:', azureVoice);
    }
    // Update context menu based on whether credentials are set
    updateContextMenu();
  }
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, _tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText) {
    // console.log("Context menu clicked.");
    if (!hasCredentials()) {
      return;
    }
    synthesizeSpeech(info.selectionText);
  }
});

// --- Communication with Popup ---
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Listen for messages from the popup (TODO: update for better logic)
  // console.log("Background received message:", message);
  if (message.target === 'background') {
    switch (message.type) {
      case 'get-status':
        sendResponse({
          audioExists: audioExists,
          isPlaying: isPlaying,
          isPaused: isPaused,
          hasCredentials: hasCredentials()
        });
        break;
      case 'play-audio':
        playAudio(savedAudioBuffer);
        sendResponse({ success: true });
        break;
      case 'stop-audio':
        stopAudio();
        sendResponse({ success: true });
        break;
      case 'download-audio':
        downloadAudio(savedAudioBuffer);
        sendResponse({ success: true });
        break;
      case 'read-aloud':
        if (!hasCredentials()) {
          // console.log("Azure API not configured.");
          sendResponse({ success: false });
          break;
        }
        synthesizeSpeech(message.text);
        sendResponse({ success: true });
        break;
    }
  }

  // Listen for messages from the offscreen document
  if (message.target === 'background' && message.source === 'offscreen') {
    if (message.type === 'audio-paused') {
      // console.log("Audio paused (message from offscreen).");
      isPlaying = false;
      isPaused = !message.ended;
      updatePopupState(); // Update popup UI
      sendResponse({ success: true });
    } if (message.type === 'audio-started') {
      // console.log("Audio started (message from offscreen).");
      isPlaying = true;
      isPaused = false;
      updatePopupState();
      sendResponse({ success: true });
    } else if (message.type === 'audio-error') {
      console.log("Audio error (message from offscreen).");
      isPlaying = false;
      isPaused = false;
      updatePopupState();
      sendResponse({ success: true });
    } else if (message.type === 'download-ready') {
      try {
        chrome.downloads.download({
          url: message.url,
          filename: 'audio.mp3',
          saveAs: true // shows the "Save As" dialog to the user
        }, downloadId => {
          // console.log('Download started with ID:', downloadId);
        });
      } catch (error) {
        console.error('Download error:', error);
      }
    }
  }

  return true; // Indicates async response is possible
});
