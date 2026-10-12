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

    # 9. Check Semantic Search Retrieval (Phase 4 Search MVP)
    search_res = client.post(
        "/api/search",
        json={"query": "gradient descent and neural networks", "top_k": 3},
    )
    assert search_res.status_code == 200, f"Search failed: {search_res.text}"
    search_data = search_res.json()
    assert search_data["total_results"] >= 1
    top_hit = search_data["results"][0]
    assert top_hit["score"] > 0.40
    assert "gradient descent" in top_hit["text"].lower() or "neural networks" in top_hit["text"].lower()
    print(f"[E2E] Semantic Search: Top match score={top_hit['score']:.4f} ({top_hit['confidence_percent']}%), latency={search_data['latency_ms']}ms")

    # Verify search with video_id filter
    filtered_search = client.post(
        "/api/search",
        json={"query": "neural networks", "video_id": video_id, "top_k": 1},
    )
    assert filtered_search.status_code == 200
    assert filtered_search.json()["total_results"] == 1
    assert filtered_search.json()["results"][0]["video_id"] == video_id
    print("[E2E] Filtered Search: Confirmed video isolation filter.")

    # 10. Check Extracted Frames & API (Phase 5 Visual Content Retrieval)
    frames_res = client.get(f"/api/videos/{video_id}/frames")
    assert frames_res.status_code == 200, f"Frames fetch failed: {frames_res.text}"
    frames_data = frames_res.json()
    assert frames_data["total_frames"] >= 1
    frame0 = frames_data["frames"][0]
    assert frame0["preview_url"].startswith(f"/api/videos/{video_id}/frames/")
    print(f"[E2E] Visual Frames: Sampled {frames_data['total_frames']} frames for video {video_id}")

    # Verify frame image can be served
    frame_img_res = client.get(frame0["preview_url"])
    assert frame_img_res.status_code == 200
    assert frame_img_res.headers.get("content-type") == "image/jpeg"
    assert len(frame_img_res.content) > 0
    print(f"[E2E] Frame Image Serving: Verified JPEG delivery ({len(frame_img_res.content)} bytes)")

    # 11. Check Visual Content Retrieval (Phase 5 CLIP Cross-Modal Search)
    visual_search_res = client.post(
        "/api/search",
        json={
            "query": "colorful test pattern display screen",
            "modality": "visual",
            "video_id": video_id,
            "top_k": 3,
        },
    )
    assert visual_search_res.status_code == 200, f"Visual search failed: {visual_search_res.text}"
    visual_search_data = visual_search_res.json()
    assert visual_search_data["total_results"] >= 1
    top_visual = visual_search_data["results"][0]
    assert top_visual["modality"] == "visual"
    assert top_visual["frame_id"] is not None
    assert top_visual["preview_url"] is not None
    assert top_visual["start_time"] >= 0.0
    print(
        f"[E2E] Visual Search: Top visual match score={top_visual['score']:.4f} "
        f"at timestamp {top_visual['start_time']}s (latency={visual_search_data['latency_ms']}ms)"
    )
