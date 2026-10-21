import time
import os
import subprocess
from pathlib import Path
import httpx
import pytest

from backend.app.services.health_service import ensure_ffmpeg_path


def ensure_demo_video_exists() -> Path:
    """Ensures a realistic demo speech video exists for end-to-end testing."""
    ensure_ffmpeg_path()
    temp_dir = Path("data/temp")
    temp_dir.mkdir(parents=True, exist_ok=True)
    video_path = temp_dir / "demo_speech_video.mp4"
    audio_path = temp_dir / "test_speech.wav"

    if not audio_path.exists():
        # Generate speech audio via PowerShell SpeechSynthesizer
        ps_script = (
            "Add-Type -AssemblyName System.Speech; "
            "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            "$synth.SetOutputToWaveFile('data/temp/test_speech.wav'); "
            "$synth.Speak('Welcome to the deep learning lecture. Today we will explore neural networks and gradient descent optimization.'); "
            "$synth.Dispose();"
        )
        subprocess.run(["powershell", "-Command", ps_script], check=True)

    if not video_path.exists():
        # Mux testsrc video with speech audio
        cmd = [
            "ffmpeg",
            "-y",
            "-f", "lavfi",
            "-i", "testsrc=duration=7.5:size=640x360:rate=24",
            "-i", str(audio_path),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-shortest",
            str(video_path),
        ]
        subprocess.run(cmd, check=True, capture_output=True)

    return video_path


def test_e2e_live_transcription_and_indexing_pipeline():
    """Validates the entire end-to-end processing pipeline on a live server."""
    video_file = ensure_demo_video_exists()
    client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=30.0)

    # 1. Upload video
    with open(video_file, "rb") as f:
        files = {"file": ("speech_lecture.mp4", f, "video/mp4")}
        res = client.post("/api/videos", files=files)
    assert res.status_code == 202, f"Upload failed: {res.text}"
    upload_data = res.json()
    video_id = upload_data["video_id"]
    print(f"\n[E2E] Upload accepted: video_id={video_id}")

    # 2. Poll job status through all pipeline stages
    completed = False
    last_stage = None
    for attempt in range(60):
        time.sleep(1.0)
        s = client.get(f"/api/videos/{video_id}/status").json()
        if s["stage"] != last_stage or attempt % 5 == 0:
            print(f"[E2E] Polling: stage={s['stage']}, progress={s['progress']}%, status={s['status']}")
            last_stage = s["stage"]

        if s["status"] == "COMPLETED":
            completed = True
            break
        elif s["status"] == "FAILED":
            raise RuntimeError(f"Pipeline job failed: {s}")

    assert completed, f"Job did not finish in time. Last status: {s}"

    # 3. Verify video metadata
    video = client.get(f"/api/videos/{video_id}").json()
    print("[E2E] Probed Metadata:", {
        "duration": video["duration"],
        "resolution": f"{video['width']}x{video['height']}",
        "has_audio": video["has_audio"],
    })
    assert video["status"] == "READY"
    assert video["has_audio"] is True
    assert video["duration"] is not None and 7.0 <= video["duration"] <= 8.0

    # 4. Check extracted audio file on disk
    audio_path = f"data/audio/{video_id}.wav"
    assert os.path.exists(audio_path) and os.path.getsize(audio_path) > 0

    # 5. Check transcript endpoint (Phase 3 ASR)
    t_res = client.get(f"/api/videos/{video_id}/transcript")
    assert t_res.status_code == 200, f"Transcript fetch failed: {t_res.text}"
    t_data = t_res.json()
    print(f"[E2E] Transcript: {t_data['total_segments']} segment(s), lang={t_data['language']}")
    assert t_data["language"] == "en"
    assert t_data["total_segments"] >= 1
    assert any("neural networks" in seg["text"].lower() or "deep learning" in seg["text"].lower()
               for seg in t_data["segments"])

    # 6. Check segments pagination endpoint (Phase 3 Segmentation)
    s_res = client.get(f"/api/videos/{video_id}/segments?skip=0&limit=10")
    assert s_res.status_code == 200
    s_data = s_res.json()
    assert s_data["total"] >= 1
    seg0 = s_data["items"][0]
    assert seg0["start_time"] >= 0.0
    assert seg0["end_time"] > seg0["start_time"]
    assert seg0["index_reference"] is not None
    print(f"[E2E] Segment 0: [{seg0['start_time']}s - {seg0['end_time']}s] -> \"{seg0['text']}\" (FAISS ID: {seg0['index_reference']})")

    # 7. Check Range Streaming (Phase 2 feature preservation)
    stream_res = client.get(f"/api/videos/{video_id}/stream", headers={"Range": "bytes=0-1024"})
    assert stream_res.status_code == 206
    assert "bytes 0-1024/" in stream_res.headers.get("Content-Range", "")

    # 8. Check Vite frontend proxy
    try:
        proxy_client = httpx.Client(base_url="http://127.0.0.1:5173", timeout=5.0)
        proxy_res = proxy_client.get("/api/videos")
        if proxy_res.status_code == 200:
            print("[E2E] Vite Proxy: Verified connecting to backend.")
    except Exception as e:
        print(f"[E2E] Note: Vite proxy check skipped ({e})")
