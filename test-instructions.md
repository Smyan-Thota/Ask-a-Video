# Testing the YouTube Learning Assistant

## Prerequisites
- Chrome browser
- OpenAI API key (get from https://platform.openai.com/api-keys)

## Step-by-Step Testing

### 1. Load Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select this folder: `/Users/smyan/Desktop/sandbox/youtube-video-explainer`

### 2. Configure API Key
1. Click the extension icon in Chrome toolbar
2. Go to "Options" or "Settings"
3. Enter your OpenAI API key (starts with "sk-")
4. Click "Save"

### 3. Test on YouTube
1. Go to a YouTube video (any video with speech)
2. Look for activation prompt in top-right corner
3. Click "Yes" to activate
4. Chat interface should appear on bottom-right
5. Play the video for 30+ seconds
6. Ask a question like "What is this video about?"

### Expected Behavior
- ✅ Prompt appears when visiting YouTube video
- ✅ Recording indicator shows when active
- ✅ Chat interface is responsive and styled
- ✅ Questions get answered based on video content
- ✅ Answers reference only what was said in the video

### Troubleshooting
- **No prompt**: Refresh the page, check extension is enabled
- **No transcription**: Check API key, verify video has audio
- **API errors**: Check OpenAI account has credits
- **Console errors**: Open DevTools (F12) to see error messages

### Test Video Suggestions
- Educational content (TED talks, tutorials)
- Videos with clear speech
- Avoid music-only videos

## File Structure Verification
Make sure all these files exist:
- manifest.json
- contentScript.js
- contentStyles.css
- background.js
- options.html
- options.js