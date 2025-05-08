// --- Side panel for pasting text to read aloud ---

import setTheme from './style';

const textarea = document.getElementById('textarea');
const readAloudButton = document.getElementById('read-aloud-button');

setTheme();

readAloudButton.addEventListener('click', (_event) => {
  const text = textarea.value.trim();
  if (!text) {
    return;
  } else {
    // console.log("read aloud button clicked.");
    readAloudButton.disabled = true; // Disable immediately

    chrome.runtime.sendMessage({ target: 'background', type: 'read-aloud', text: text }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending read-aloud command:", chrome.runtime.lastError.message);
      } else if (response && response.success) {
        // console.log("read-aloud command sent successfully.");
        textarea.value = ''; // Clear the textarea
      } else {
        // console.log("read-aloud command failed or no API credentials.");
        readAloudButton.disabled = false;
      }
    });
  }
});

textarea.addEventListener('input', () => {
  if (textarea.value.trim()) {
    readAloudButton.disabled = false;
  } else {
    readAloudButton.disabled = true;
  }
});
