// YouTube Learning Assistant Content Script

class YouTubeLearningAssistant {
  constructor() {
    this.isActive = false;
    this.mediaRecorder = null;
    this.audioStream = null;
    this.transcribing = false;
    this.chunkQueue = [];
    this.videoElement = null;
    
    this.init();
  }

  init() {
    if (this.isOnYouTubeWatch()) {
      this.showActivationPrompt();
    }
  }

  isOnYouTubeWatch() {
    return window.location.href.includes('youtube.com/watch');
  }

  showActivationPrompt() {
    // Check if prompt already exists
    if (document.getElementById('ai-assist-prompt')) {
      return;
    }

    const promptDiv = document.createElement('div');
    promptDiv.id = 'ai-assist-prompt';
    promptDiv.innerHTML = `
      <div class="prompt-container">
        <div class="prompt-text">Activate Learning Assistant for this video?</div>
        <div class="prompt-buttons">
          <button class="btn-yes" id="assist-yes">Yes</button>
          <button class="btn-no" id="assist-no">No</button>
        </div>
      </div>
    `;

    document.body.appendChild(promptDiv);

    // Add event listeners
    document.getElementById('assist-yes').onclick = () => this.activateAssistant();
    document.getElementById('assist-no').onclick = () => this.dismissPrompt();
  }

  dismissPrompt() {
    const prompt = document.getElementById('ai-assist-prompt');
    if (prompt) {
      prompt.remove();
    }
  }

  async activateAssistant() {
    this.dismissPrompt();

    // Check for API key
    const result = await chrome.storage.local.get('apiKey');
    if (!result.apiKey) {
      alert('Please set up your OpenAI API key in the extension settings.');
      chrome.runtime.openOptionsPage();
      return;
    }

    this.isActive = true;
    this.setupVideoCapture();
    this.createChatInterface();
    this.showRecordingIndicator();
  }

  setupVideoCapture() {
    // Find the YouTube video element
    this.videoElement = document.querySelector('video');
    
    if (!this.videoElement) {
      console.error('No video element found');
      return;
    }

    try {
      // Capture the video stream
      const stream = this.videoElement.captureStream();
      
      // Extract only audio tracks
      const audioTracks = stream.getAudioTracks();
      this.audioStream = new MediaStream();
      audioTracks.forEach(track => this.audioStream.addTrack(track));

      // Set up MediaRecorder
      const options = { mimeType: 'audio/webm;codecs=opus' };
      this.mediaRecorder = new MediaRecorder(this.audioStream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.handleAudioChunk(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
      };

      // Start recording in 15-second chunks
      this.mediaRecorder.start(15000);

    } catch (error) {
      console.error('Error setting up audio capture:', error);
      this.addSystemMessage('Error: Could not capture audio from video.');
    }
  }

  handleAudioChunk(audioBlob) {
    if (this.transcribing) {
      // Queue the chunk if still processing previous one
      this.chunkQueue.push(audioBlob);
      return;
    }

    this.transcribing = true;
    this.processAudioChunk(audioBlob);
  }

  async processAudioChunk(audioBlob) {
    try {
      const buffer = await audioBlob.arrayBuffer();
      chrome.runtime.sendMessage({ 
        type: 'transcribeChunk', 
        audio: buffer 
      });
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      this.transcribing = false;
      this.processQueue();
    }
  }

  processQueue() {
    if (this.chunkQueue.length > 0) {
      const nextChunk = this.chunkQueue.shift();
      this.processAudioChunk(nextChunk);
    }
  }

  createChatInterface() {
    // Check if chat already exists
    if (document.getElementById('assist-chat')) {
      return;
    }

    const chatDiv = document.createElement('div');
    chatDiv.id = 'assist-chat';
    chatDiv.innerHTML = `
      <div id="assist-chat-header">
        <span>AI Learning Assistant</span>
        <button id="assist-chat-close">×</button>
      </div>
      <div id="assist-chat-log">
        <div class="chat-message system">
          <div class="sender">System</div>
          Learning Assistant activated! I'm now transcribing the video. You can ask questions about the content once some audio has been processed.
        </div>
      </div>
      <div id="assist-chat-input-area">
        <input type="text" id="assist-chat-question" placeholder="Ask a question about the video..." />
        <button id="assist-send-btn">Send</button>
      </div>
    `;

    document.body.appendChild(chatDiv);

    // Add event listeners
    document.getElementById('assist-send-btn').onclick = () => this.sendQuestion();
    document.getElementById('assist-chat-close').onclick = () => this.closeAssistant();
    
    const questionInput = document.getElementById('assist-chat-question');
    questionInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendQuestion();
        e.preventDefault();
      }
    });
  }

  sendQuestion() {
    const input = document.getElementById('assist-chat-question');
    const question = input.value.trim();
    
    if (!question) return;

    // Add user message to chat
    this.addUserMessage(question);
    
    // Clear input and disable controls
    input.value = '';
    input.disabled = true;
    document.getElementById('assist-send-btn').disabled = true;

    // Show typing indicator
    this.addTypingIndicator();

    // Send question to background script
    chrome.runtime.sendMessage({ 
      type: 'askQuestion', 
      question: question 
    });
  }

  addUserMessage(message) {
    const log = document.getElementById('assist-chat-log');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message user';
    messageDiv.innerHTML = `
      <div class="sender">You</div>
      <div>${this.escapeHtml(message)}</div>
    `;
    log.appendChild(messageDiv);
    log.scrollTop = log.scrollHeight;
  }

  addAssistantMessage(message) {
    // Remove typing indicator
    this.removeTypingIndicator();
    
    const log = document.getElementById('assist-chat-log');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message assistant';
    messageDiv.innerHTML = `
      <div class="sender">Assistant</div>
      <div>${this.escapeHtml(message)}</div>
    `;
    log.appendChild(messageDiv);
    log.scrollTop = log.scrollHeight;

    // Re-enable input
    const input = document.getElementById('assist-chat-question');
    input.disabled = false;
    document.getElementById('assist-send-btn').disabled = false;
    input.focus();
  }

  addSystemMessage(message) {
    const log = document.getElementById('assist-chat-log');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message system';
    messageDiv.innerHTML = `
      <div class="sender">System</div>
      <div>${this.escapeHtml(message)}</div>
    `;
    log.appendChild(messageDiv);
    log.scrollTop = log.scrollHeight;
  }

  addTypingIndicator() {
    const log = document.getElementById('assist-chat-log');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message assistant typing-indicator-message';
    typingDiv.innerHTML = `
      <div class="sender">Assistant</div>
      <div class="typing-indicator">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    `;
    log.appendChild(typingDiv);
    log.scrollTop = log.scrollHeight;
  }

  removeTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator-message');
    if (indicator) {
      indicator.remove();
    }
  }

  showRecordingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'recording-indicator';
    indicator.textContent = '🔴 Recording';
    indicator.id = 'recording-indicator';
    document.body.appendChild(indicator);
  }

  closeAssistant() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Clean up audio stream
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
    }

    // Remove UI elements
    const chat = document.getElementById('assist-chat');
    const indicator = document.getElementById('recording-indicator');
    
    if (chat) chat.remove();
    if (indicator) indicator.remove();

    this.isActive = false;
    this.transcribing = false;
    this.chunkQueue = [];

    // Show activation prompt again
    setTimeout(() => this.showActivationPrompt(), 1000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Message listener for background script responses
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'transcriptResult') {
    // Transcript chunk processed
    assistant.transcribing = false;
    assistant.processQueue();
    
    // Optionally show progress
    if (message.text && message.text.trim()) {
      console.log('Transcribed:', message.text);
    }
  }
  
  if (message.type === 'answer') {
    // Answer received from AI
    assistant.addAssistantMessage(message.text);
  }
  
  if (message.type === 'error') {
    // Error from background script
    assistant.removeTypingIndicator();
    assistant.addSystemMessage('Error: ' + message.message);
    
    // Re-enable input
    const input = document.getElementById('assist-chat-question');
    if (input) {
      input.disabled = false;
      document.getElementById('assist-send-btn').disabled = false;
    }
  }
});

// Initialize the assistant
const assistant = new YouTubeLearningAssistant();

// Handle navigation within YouTube (SPA behavior)
let currentUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    if (assistant.isActive) {
      assistant.closeAssistant();
    }
    if (assistant.isOnYouTubeWatch()) {
      setTimeout(() => assistant.showActivationPrompt(), 1000);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });