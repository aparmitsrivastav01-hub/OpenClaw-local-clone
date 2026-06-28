# Piper TTS Setup Instructions

This guide explains how to set up Piper TTS for fully local text-to-speech in OpenClaw.

## Overview

Piper is a fast, local neural text-to-speech system that works entirely offline. It uses ONNX models and runs on CPU, making it ideal for privacy-focused applications.

**Benefits over ElevenLabs:**
- ✅ Fully local - no API calls
- ✅ No billing or subscription required
- ✅ Works offline
- ✅ Privacy-focused
- ✅ Free and open-source

## Prerequisites

- Windows 10/11 (for this guide)
- FFmpeg (already required for OpenClaw voice features)
- ~500MB disk space for Piper executable and voice models

## Step 1: Download Piper

### Option A: Download Pre-built Binary (Recommended)

1. Visit the Piper releases page:
   ```
   https://github.com/rhasspy/piper/releases
   ```

2. Download the latest Windows binary (usually named `piper_windows_amd64.zip`)

3. Extract the zip file to your OpenClaw project:
   ```
   OpenClaw/
   └── voice/
       └── piper/
           ├── piper.exe
           └── voices/
   ```

### Option B: Build from Source

If you prefer to build Piper from source:

1. Install Rust toolchain: https://rustup.rs/
2. Clone Piper repository:
   ```bash
   git clone https://github.com/rhasspy/piper.git
   cd piper
   ```
3. Build for Windows:
   ```bash
   cargo build --release
   ```
4. Copy the executable to your project:
   ```bash
   cp target/release/piper.exe OpenClaw/voice/piper/piper.exe
   ```

## Step 2: Download Voice Models

Piper requires ONNX voice models. Download from the official model repository:

1. Visit the Piper voices repository:
   ```
   https://huggingface.co/rhasspy/piper-voices
   ```

2. Browse available models by language and quality

### Recommended English Models

**Medium Quality (Balanced speed/quality):**
- `en_US-lessac-medium.onnx` - American English, male voice
- `en_US-amy-medium.onnx` - American English, female voice

**High Quality (Slower, better sound):**
- `en_US-lessac-high.onnx` - American English, male voice
- `en_US-amy-high.onnx` - American English, female voice

**Low Quality (Faster, lower quality):**
- `en_US-lessac-low.onnx` - American English, male voice
- `en_US-amy-low.onnx` - American English, female voice

### Download Instructions

1. Navigate to the desired model folder (e.g., `en/lessac/medium`)
2. Download these files:
   - `en_US-lessac-medium.onnx` (the model)
   - `en_US-lessac-medium.onnx.json` (model config)
   - `en_US-lessac-medium.onnx.json` is optional but recommended

3. Place files in your voices directory:
   ```
   OpenClaw/
   └── voice/
       └── piper/
           ├── piper.exe
           └── voices/
               └── en_US-lessac-medium.onnx
   ```

## Step 3: Configure Environment Variables

Add the following environment variables to your system or `.env` file:

```env
# Enable voice mode
VOICE_ENABLED=1

# Use Piper for TTS
VOICE_TTS_PROVIDER=piper

# Piper executable path (relative to project root)
PIPER_PATH=voice/piper/piper.exe

# Piper voice model path (relative to project root)
PIPER_VOICE_MODEL=voice/piper/voices/en_US-lessac-medium.onnx
```

### Windows Environment Variables

To set environment variables permanently on Windows:

1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Click "Advanced" tab
3. Click "Environment Variables"
4. Under "User variables", click "New"
5. Add each variable:
   - Variable name: `VOICE_ENABLED`, Variable value: `1`
   - Variable name: `VOICE_TTS_PROVIDER`, Variable value: `piper`
   - Variable name: `PIPER_PATH`, Variable value: `C:\Users\C RR COMPUTERS\Desktop\OpenClaw\voice\piper\piper.exe`
   - Variable name: `PIPER_VOICE_MODEL`, Variable value: `C:\Users\C RR COMPUTERS\Desktop\OpenClaw\voice\piper\voices\en_US-lessac-medium.onnx`

### Using .env File (Recommended)

Create a `.env` file in your OpenClaw project root:

```env
VOICE_ENABLED=1
VOICE_TTS_PROVIDER=piper
PIPER_PATH=voice/piper/piper.exe
PIPER_VOICE_MODEL=voice/piper/voices/en_US-lessac-medium.onnx
```

Then load it before running:
```powershell
# PowerShell
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}
bun run index.ts wakeup
```

## Step 4: Verify Installation

Run OpenClaw with voice mode enabled:

```bash
bun run index.ts wakeup
```

You should see output like:

```
💬 Conversation

Ask questions, give tasks, or describe goals — OpenClaw picks the right approach.

Voice Enabled: true
Input Source: voice
STT: faster-whisper
TTS: piper
Recorder: node

Validating Piper TTS...
  ✓ PIPER_PATH: voice/piper/piper.exe
  ✓ PIPER_VOICE_MODEL: voice/piper/voices/en_US-lessac-medium.onnx
✓ Piper configuration validated

Voice session created for TTS output.
```

If you see errors:
- `✗ PIPER_PATH environment variable not set` - Set the PIPER_PATH variable
- `✗ PIPER_VOICE_MODEL environment variable not set` - Set the PIPER_VOICE_MODEL variable
- `Piper executable not found at: ...` - Check the path is correct
- `Piper voice model not found at: ...` - Check the model path is correct

## Step 5: Test Piper Standalone

Before using with OpenClaw, test Piper directly:

```bash
cd voice/piper
./piper.exe --model voices/en_US-lessac-medium.onnx --output_file test.wav "Hello, this is a test of Piper TTS."
```

This should create a `test.wav` file. Play it to verify audio quality.

## Troubleshooting

### Piper Not Found

**Error**: `Piper executable not found at: voice/piper/piper.exe`

**Solution**: 
- Verify the path is correct
- Use absolute path if relative path doesn't work
- Check file permissions

### Model Not Found

**Error**: `Piper voice model not found at: voice/piper/voices/en_US-lessac-medium.onnx`

**Solution**:
- Verify the model file exists
- Download the correct `.onnx` file (not `.json` or other files)
- Check file permissions

### Synthesis Fails

**Error**: `Piper synthesis failed (exit code X): ...`

**Solution**:
- Check Piper version compatibility with model
- Try a different voice model
- Ensure FFmpeg is installed and accessible
- Check system resources (CPU/RAM)

### Slow Performance

**Solution**:
- Use a "low" quality model for faster synthesis
- Close other applications to free CPU resources
- Consider using a machine with better CPU performance

## Advanced Configuration

### Using Multiple Voice Models

You can switch between voice models by changing the `PIPER_VOICE_MODEL` environment variable:

```env
# American English, male
PIPER_VOICE_MODEL=voice/piper/voices/en_US-lessac-medium.onnx

# American English, female
PIPER_VOICE_MODEL=voice/piper/voices/en_US-amy-medium.onnx

# British English
PIPER_VOICE_MODEL=voice/piper/voices/en_GB-alba-medium.onnx
```

### Custom Model Directory

If you prefer to store models elsewhere:

```env
PIPER_PATH=C:\path\to\piper.exe
PIPER_VOICE_MODEL=C:\path\to\models\en_US-lessac-medium.onnx
```

## Performance Tips

1. **Use medium quality models** for best balance of speed and quality
2. **Close unnecessary applications** to free CPU resources
3. **Use SSD storage** for faster model loading
4. **Consider GPU acceleration** if available (requires CUDA-compatible GPU)

## Comparison: Piper vs ElevenLabs

| Feature | Piper | ElevenLabs |
|---------|-------|------------|
| Cost | Free | Paid (subscription) |
| Latency | ~200-500ms | ~100-300ms |
| Quality | Good | Excellent |
| Offline | Yes | No |
| Privacy | Full | Data sent to cloud |
| Setup | Manual | API key only |
| Voice Selection | Limited | Extensive |

## Uninstalling Piper

To revert to ElevenLabs or another TTS provider:

1. Change environment variable:
   ```env
   VOICE_TTS_PROVIDER=elevenlabs
   ELEVENLABS_API_KEY=your_api_key
   ```

2. Remove Piper files (optional):
   ```bash
   rm -rf voice/piper
   ```

## Support

- Piper GitHub: https://github.com/rhasspy/piper
- Piper Voices: https://huggingface.co/rhasspy/piper-voices
- OpenClaw Issues: Report issues in the OpenClaw repository
