// YouTube Learning Assistant Background Script (Service Worker)

class BackgroundService {
  constructor() {
    this.transcriptChunks = [];
    this.apiKey = null;
    this.isInitialized = false;
    
    this.init();
  }

  async init() {
    // Load API key from storage
    const result = await chrome.storage.local.get('apiKey');
    this.apiKey = result.apiKey;
    this.isInitialized = true;
  }

  async ensureApiKey() {
    if (!this.apiKey) {
      const result = await chrome.storage.local.get('apiKey');
      this.apiKey = result.apiKey;
    }
    return this.apiKey;
  }

  async transcribeAudioChunk(audioBuffer, tabId) {
    try {
      const apiKey = await this.ensureApiKey();
      if (!apiKey) {
        this.sendError(tabId, 'No API key available for transcription.');
        return;
      }

      // Convert ArrayBuffer to Blob for form upload
      const blob = new Blob([audioBuffer], { type: 'audio/webm' });
      
      // Prepare multipart form data
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('STT API error:', response.status, errorText);
        this.sendError(tabId, `Transcription API error: ${response.status}`);
        return;
      }

      const data = await response.json();
      const transcriptText = data.text?.trim();

      if (transcriptText && transcriptText.length > 0) {
        await this.handleNewTranscriptText(transcriptText);
        
        // Send result back to content script
        chrome.tabs.sendMessage(tabId, { 
          type: 'transcriptResult', 
          text: transcriptText 
        });
      }

    } catch (error) {
      console.error('Transcription failed:', error);
      this.sendError(tabId, 'Transcription failed: ' + error.message);
    }
  }

  async handleNewTranscriptText(text) {
    try {
      const apiKey = await this.ensureApiKey();
      if (!apiKey) {
        console.error('No API key for embedding generation');
        return;
      }

      // Generate embedding for the transcript chunk
      const embedResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-ada-002'
        })
      });

      if (!embedResponse.ok) {
        console.error('Embedding API error:', embedResponse.status);
        // Still store text without embedding if embedding fails
        this.transcriptChunks.push({ text: text, embedding: null });
        return;
      }

      const embedData = await embedResponse.json();
      const vector = embedData.data[0].embedding;

      // Store the chunk with its embedding
      this.transcriptChunks.push({ 
        text: text, 
        embedding: vector,
        timestamp: Date.now()
      });

      console.log(`Stored transcript chunk: "${text.substring(0, 50)}..." (${this.transcriptChunks.length} total chunks)`);

    } catch (error) {
      console.error('Error handling transcript text:', error);
      // Store text without embedding as fallback
      this.transcriptChunks.push({ text: text, embedding: null });
    }
  }

  async handleUserQuestion(question, tabId) {
    try {
      if (this.transcriptChunks.length === 0) {
        chrome.tabs.sendMessage(tabId, { 
          type: 'answer', 
          text: "I don't have any transcript information yet. Please wait for the video to be processed, or make sure the video has audio." 
        });
        return;
      }

      const apiKey = await this.ensureApiKey();
      if (!apiKey) {
        this.sendError(tabId, 'No API key available.');
        return;
      }

      // Get embedding for the question
      const embedResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: question,
          model: 'text-embedding-ada-002'
        })
      });

      if (!embedResponse.ok) {
        this.sendError(tabId, 'Failed to process question.');
        return;
      }

      const embedData = await embedResponse.json();
      const questionVector = embedData.data[0].embedding;

      // Find most relevant transcript chunks
      let relevantChunks;
      
      // Filter chunks that have embeddings
      const chunksWithEmbeddings = this.transcriptChunks.filter(chunk => chunk.embedding);
      
      if (chunksWithEmbeddings.length > 0) {
        // Use vector similarity
        const scoredChunks = chunksWithEmbeddings.map(chunk => ({
          text: chunk.text,
          score: this.cosineSimilarity(questionVector, chunk.embedding)
        }));
        
        scoredChunks.sort((a, b) => b.score - a.score);
        relevantChunks = scoredChunks.slice(0, 3); // Top 3 most relevant
      } else {
        // Fallback to keyword matching if no embeddings available
        relevantChunks = this.keywordSearch(question, this.transcriptChunks.slice(-5)); // Last 5 chunks
      }

      if (relevantChunks.length === 0) {
        chrome.tabs.sendMessage(tabId, { 
          type: 'answer', 
          text: "I couldn't find relevant information in the transcript to answer your question. Try asking about something that was mentioned in the video." 
        });
        return;
      }

      // Prepare context for the LLM
      const contextText = relevantChunks.map(chunk => chunk.text).join('\n\n');

      // Prepare messages for ChatCompletion API
      const systemMessage = {
        role: "system",
        content: "You are a helpful assistant that answers questions about a YouTube video's content. Use ONLY the provided transcript excerpts to answer. If the answer is not clearly in the transcript, say you don't have enough information to answer that question. Keep your answers concise and helpful."
      };

      const userMessage = {
        role: "user",
        content: `Video transcript excerpts:\n\n${contextText}\n\nQuestion: ${question}`
      };

      // Call ChatCompletion API
      const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [systemMessage, userMessage],
          max_tokens: 300,
          temperature: 0.2
        })
      });

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        console.error('Chat API error:', chatResponse.status, errorText);
        this.sendError(tabId, `AI API error: ${chatResponse.status}`);
        return;
      }

      const chatData = await chatResponse.json();
      const answerText = chatData.choices[0].message.content;

      // Send answer back to content script
      chrome.tabs.sendMessage(tabId, { 
        type: 'answer', 
        text: answerText 
      });

    } catch (error) {
      console.error('Error handling question:', error);
      this.sendError(tabId, 'Error processing your question: ' + error.message);
    }
  }

  keywordSearch(question, chunks) {
    // Simple keyword-based fallback search
    const questionWords = question.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    return chunks.map(chunk => {
      const chunkText = chunk.text.toLowerCase();
      const matches = questionWords.filter(word => chunkText.includes(word)).length;
      return {
        text: chunk.text,
        score: matches / questionWords.length
      };
    }).filter(chunk => chunk.score > 0).sort((a, b) => b.score - a.score);
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dot = 0.0;
    let normA = 0.0;
    let normB = 0.0;

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dot / (normA * normB);
  }

  sendError(tabId, message) {
    chrome.tabs.sendMessage(tabId, { 
      type: 'error', 
      message: message 
    }).catch(err => {
      console.error('Failed to send error message to tab:', err);
    });
  }

  // Reset transcript data (called when starting new video)
  resetTranscriptData() {
    this.transcriptChunks = [];
    console.log('Transcript data reset for new session');
  }
}

// Initialize the service
const backgroundService = new BackgroundService();

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (message.type === 'transcribeChunk') {
    const audioBuffer = message.audio;
    backgroundService.transcribeAudioChunk(audioBuffer, tabId);
    return true; // Keep message channel open for async response
  }

  if (message.type === 'askQuestion') {
    const question = message.question;
    backgroundService.handleUserQuestion(question, tabId);
    return true; // Keep message channel open for async response
  }

  if (message.type === 'resetSession') {
    backgroundService.resetTranscriptData();
    return true;
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  backgroundService.resetTranscriptData();
});

// Handle when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube Learning Assistant installed/updated');
});

// Handle tab updates (could be used to reset data on navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
    // New YouTube video loaded, could reset transcript data
    // But we'll let the content script handle this for now
  }
});