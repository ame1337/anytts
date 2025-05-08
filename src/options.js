// options.js - Logic for the extension's Azure TTS settings

import setTheme from './style';

const optionsForm = document.getElementById('options-form');
const azureKeyInput = document.getElementById('azure-key');
const azureRegionInput = document.getElementById('azure-region');
const azureVoiceSelect = document.getElementById('azure-voice');
const saveButton = document.getElementById('save-button');
const statusMessage = document.getElementById('status-message');
const statusText = document.getElementById('status-text');
const clearButton = document.getElementById('clear-button');
const updateVoicesButton = document.getElementById('update-voices');
const statusMessageIcon = document.querySelector('#status-message>svg>use');
let isUpdatingVoices = false;

setTheme();

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // console.log("Options DOM loaded.");
  loadOptions();
});

// --- Load Settings ---
async function loadOptions() {
  chrome.storage.local.get(['azureKey', 'azureRegion', 'azureVoice'], (result) => {
    if (!result.azureKey || !result.azureRegion) {
      displayStatus("Please enter your API Key and Region.");
      return;
    } else if (result.azureKey && result.azureRegion && !result.azureVoice) {
      //grab voices from azure;
      loadAzureVoices(atob(result.azureKey), result.azureRegion).catch((_e) => {
        // rethrown error. nothing to do here
      });
    } else {
      updateVoicesButton.disabled = false;
      azureKeyInput.disabled = true;
      azureRegionInput.disabled = true;
      saveButton.disabled = true;
      displayStatus("Azure API has been configured.", "success");
    }

    azureKeyInput.value = result.azureKey;
    azureRegionInput.value = result.azureRegion;
    if (result.azureVoice) {
      const voice = result.azureVoice.split('_')[0];
      const gender = result.azureVoice.split('_')[1];
      const emoji = gender === 'Female' ? '🙎‍♀️' : '🙎‍♂️';
      azureVoiceSelect.options[0].value = result.azureVoice;
      azureVoiceSelect.options[0].textContent = `${voice} ${emoji}`;
    }
    // console.log("Loaded settings into options form.");
  });
  return true;
}

// --- Handle Form ---
optionsForm.addEventListener('submit', (event) => {
  event.preventDefault(); // Prevent form from actually submitting
  saveButton.disabled = true;
  const key = nerd_proof(azureKeyInput.value.trim());
  const region = nerd_proof(azureRegionInput.value);
  const voice = nerd_proof(azureVoiceSelect.value);
  // console.log("Saving settings:", { key, region, voice });

  if (!key || !region) {
    displayStatus("Please enter your API Key and Region.", "danger");
    saveButton.disabled = false;
    return;
  } else if (key && region && !voice) {
    // display spinner
    // grab voices from azure
    // enable voice select
    loadAzureVoices(key, region).then(() => {
      chrome.storage.local.set({
        azureKey: btoa(key),
        azureRegion: region
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error saving key and region:", chrome.runtime.lastError);
        } else {
          // console.log("Key and region saved successfully.");
          saveButton.disabled = false;
        }
      });
    }).catch((_e) => {
      // rethrown error. nothing to do here
    });
  } else {
        chrome.storage.local.set({
          azureVoice: voice
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error saving voice:", chrome.runtime.lastError);
          } else {
            // console.log("Voice saved successfully.");
            saveButton.disabled = false;
            displayStatus("Azure API has been configured.", "success");
          }
        });
  }
});

// --- Clear Settings ---
clearButton.addEventListener('click', (_event) => {
  clearOptions();
  displayStatus("Please enter your API Key and Region.");
});

// --- Update Voices ---
updateVoicesButton.addEventListener('click', (_event) => {
  chrome.storage.local.get(['azureKey', 'azureRegion'], (result) => {
    if (result.azureKey && result.azureRegion) {
      loadAzureVoices(atob(result.azureKey), result.azureRegion).catch((_e) => {
        // rethrown error. nothing to do here
      });
    }
  });
});

function clearOptions() {
  chrome.storage.local.clear();
  azureKeyInput.disabled = false;
  azureKeyInput.value = '';
  azureRegionInput.disabled = false;
  azureRegionInput.value = '';
  azureVoiceSelect.options[0].value = '';
  azureVoiceSelect.options[0].textContent = '';
  azureVoiceSelect.disabled = true;
  updateVoicesButton.disabled = true;
  saveButton.disabled = false;
  // console.log("API options cleared.");
}

// --- Status Message ---
function displayStatus(message, type = "info") {
  if (type === "success") {
    statusMessageIcon.setAttribute('href', '#fa-circle-check');
  } else {
    statusMessageIcon.setAttribute('href', '#fa-triangle-exclamation');
  }
  statusMessage.classList.add('d-none'); // Hide first
  setTimeout(() => {
    statusText.textContent = message;
    statusMessage.className = `mt-3 alert alert-${type}`; // Reset and add type class
    statusMessage.style.width = '100%';
    statusMessage.classList.remove('d-none');
  }, 100); // Delay for flashing effect
}

function nerd_proof(str) {
  if (!str) return false;
  return str.replace(/[^a-zA-Z0-9_-]/g, '');
}

// --- Load Azure Voices ---
async function loadAzureVoices(key, region) {
  if (isUpdatingVoices) return; // Prevent multiple calls
  const spinner = document.getElementById("spinner");
  const multilingual = document.getElementById("multilingual");
  const locale = document.getElementById("locale");
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;

  // Show spinner, disable inputs
  spinner.classList.toggle('d-none');
  isUpdatingVoices = true;
  azureKeyInput.disabled = true;
  azureRegionInput.disabled = true;
  azureVoiceSelect.disabled = true;
  updateVoicesButton.disabled = true;
  saveButton.disabled = true;

  try {
    const response = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': key }
    });

    if (!response.ok) throw new Error('Failed to fetch voices');

    const voices = await response.json();

    voices.forEach(voice => {
      const emoji = voice.Gender === 'Female' ? '🙎‍♀️' : '🙎‍♂️';
      const option = document.createElement('option');
      option.value = `${voice.ShortName}_${voice.Gender}`;
      option.textContent = `${voice.ShortName} ${emoji}`;
      if (voice.ShortName.includes("Multilingual")) {
        multilingual.appendChild(option);
      } else {
        locale.appendChild(option);
      }
    });
    displayStatus("Please select a voice.", "warning");
    azureVoiceSelect.disabled = false;
    saveButton.disabled = false;
  } catch (error) {
    // console.log('Error loading voices:', error);
    displayStatus("Error. Please check your API Key and region.", "danger");
    azureKeyInput.disabled = false;
    azureRegionInput.disabled = false;
    saveButton.disabled = false;
    throw error; // Rethrow to save creds based on error
  } finally {
    // Hide spinner, enable select
    spinner.classList.toggle('d-none');
    isUpdatingVoices = false;
  }
}
