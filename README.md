# YouTube Learning Assistant Chrome Extension

A Chrome extension that transcribes YouTube videos in real-time and provides an AI-powered Q&A chat interface to help you learn from video content.

## Features

- **Real-time Transcription**: Automatically transcribes YouTube video audio using OpenAI's Whisper API
- **AI-Powered Q&A**: Ask questions about video content and get answers based on the transcript
- **Privacy-Focused**: All data stays local except for API calls to OpenAI (using your own API key)
- **Smart Retrieval**: Uses vector embeddings to find relevant transcript segments for accurate answers
- **Clean UI**: Non-intrusive interface that overlays on YouTube without disrupting the viewing experience

## Installation

### Prerequisites
- Chrome browser
- OpenAI API key (get one at https://platform.openai.com/api-keys)

### Steps
1. **Download/Clone the Extension**
   - Clone this repository or download all files to a local folder

2. **Load the Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked" and select the folder containing the extension files

3. **Set Up Your API Key**
   - Click on the extension icon in Chrome's toolbar
   - Go to the extension's options/settings page
   - Enter your OpenAI API key and save it

## Usage

1. **Navigate to a YouTube Video**
   - Go to any YouTube video (e.g., `youtube.com/watch?v=...`)

2. **Activate the Assistant**
   - A prompt will appear asking if you want to activate the Learning Assistant
   - Click "Yes" to start transcription

3. **Watch and Learn**
   - The extension will begin transcribing the video audio in real-time
   - A chat interface will appear on the right side of the screen

4. **Ask Questions**
   - Type questions about the video content in the chat box
   - The AI will answer based on what has been transcribed so far
   - Questions are answered using only the video's content (no external knowledge)

## How It Works

### Architecture
- **Content Script**: Runs on YouTube pages, handles UI and audio capture
- **Background Service Worker**: Processes API calls for transcription and Q&A
- **Options Page**: Manages API key storage

### Technical Flow
1. **Audio Capture**: Uses `HTMLMediaElement.captureStream()` to get audio from YouTube's video element
2. **Chunked Processing**: Records audio in 15-second chunks for real-time processing
3. **Transcription**: Sends audio chunks to OpenAI's Whisper API for speech-to-text
4. **Embedding Generation**: Creates vector embeddings for each transcript chunk
5. **Question Processing**: When you ask a question:
   - Generates an embedding for your question
   - Finds most relevant transcript segments using cosine similarity
   - Sends relevant context to GPT-3.5-turbo for answer generation

## File Structure

```
youtube-video-explainer/
├── manifest.json          # Extension configuration
├── contentScript.js       # Main content script (UI + audio capture)
├── contentStyles.css      # Styling for injected UI elements
├── background.js          # Service worker (API calls + RAG logic)
├── options.html          # Settings page for API key
├── options.js            # Settings page logic
└── README.md            # This file
```

## Privacy & Security

- **Local Storage**: Your API key is stored locally in Chrome's storage
- **No External Servers**: Direct communication with OpenAI APIs only
- **Session-Based**: Transcript data is reset for each new video
- **User Control**: Extension only activates when you explicitly choose to use it

## Limitations

- Requires active internet connection for API calls
- Uses your OpenAI API quota (costs vary by usage)
- Currently supports OpenAI APIs only
- Works only on YouTube video pages
- Chrome extension only (not for other browsers)

## Troubleshooting

### Extension Not Working
- Ensure you're on a YouTube video page (`youtube.com/watch?v=...`)
- Check that your API key is correctly entered in settings
- Verify the extension is enabled in `chrome://extensions/`

### No Transcription
- Make sure the video has audio
- Check browser console for any error messages
- Verify your OpenAI API key has sufficient credits

### Poor Question Answers
- Ensure you're asking about content that was actually spoken in the video
- Try asking more specific questions
- Wait for more of the video to be transcribed before asking complex questions

## API Costs

This extension uses OpenAI APIs which incur costs:
- **Whisper API**: ~$0.006 per minute of audio
- **Embeddings API**: ~$0.0001 per 1K tokens
- **GPT-3.5-turbo**: ~$0.002 per 1K tokens

For a typical 30-minute video with 10 questions, expect costs around $0.20-0.50.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the extension.

## License

MIT License - feel free to use and modify as needed.