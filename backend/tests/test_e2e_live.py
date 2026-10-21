import time
import os
import httpx

client = httpx.Client(base_url="http://127.0.0.1:8000")

# 1. Upload video
with open("data/temp/demo_lecture.mp4", "rb") as f:
    files = {"file": ("demo_lecture.mp4", f, "video/mp4")}
    res = client.post("/api/videos", files=files)
assert res.status_code == 202, f"Upload failed: {res.text}"
upload_data = res.json()
video_id = upload_data["video_id"]
print("Upload accepted:", upload_data)

# 2. Poll job status
completed = False
for _ in range(15):
    time.sleep(0.5)
    s = client.get(f"/api/videos/{video_id}/status").json()
    print(f"Status check: stage={s['stage']}, progress={s['progress']}%, status={s['status']}")
    if s["status"] == "COMPLETED":
        completed = True
        break
    elif s["status"] == "FAILED":
        raise RuntimeError(f"Job failed: {s}")

assert completed, "Job did not finish in time"

# 3. Verify metadata
video = client.get(f"/api/videos/{video_id}").json()
print("Probed Metadata:", {
    "duration": video["duration"],
    "resolution": f"{video['width']}x{video['height']}",
    "fps": video["fps"],
    "has_audio": video["has_audio"],
    "size_bytes": video["file_size"]
})
assert video["status"] == "READY"
assert video["duration"] is not None and 4.8 <= video["duration"] <= 5.2
assert video["width"] == 640 and video["height"] == 360
assert video["has_audio"] is True

# 4. Check extracted audio file
audio_path = f"data/audio/{video_id}.wav"
assert os.path.exists(audio_path) and os.path.getsize(audio_path) > 0
print(f"Audio extracted on disk: {audio_path} ({os.path.getsize(audio_path)} bytes)")

# 5. Check range streaming
stream_res = client.get(f"/api/videos/{video_id}/stream", headers={"Range": "bytes=0-1024"})
assert stream_res.status_code == 206
print("Streaming test HTTP 206:", stream_res.headers.get("Content-Range"))

# 6. Check Vite proxy
proxy_client = httpx.Client(base_url="http://127.0.0.1:5173")
proxy_res = proxy_client.get("/api/videos")
assert proxy_res.status_code == 200
print("Proxy returned videos:", proxy_res.json()["total"], "video(s) found.")
