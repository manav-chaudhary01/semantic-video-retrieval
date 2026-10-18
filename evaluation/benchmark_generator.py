import json
import os
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Tuple

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.services.health_service import ensure_ffmpeg_path
from backend.app.db.session import SessionLocal
from backend.app.models.video import Video
from backend.app.models.job import ProcessingJob
from backend.app.services.job_service import job_service
from evaluation.schema import BenchmarkDataset, BenchmarkQuery, GroundTruthInterval


BENCHMARK_DIR = Path("evaluation/data")
BENCHMARK_FILE = BENCHMARK_DIR / "benchmark_dataset.json"


def generate_synthetic_audio(text: str, output_path: Path) -> None:
    """Uses Windows SpeechSynthesizer via PowerShell to render clear synthetic speech."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    clean_text = text.replace("'", "")
    ps_cmd = (
        f"Add-Type -AssemblyName System.Speech; "
        f"$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        f"$synth.SetOutputToWaveFile('{output_path.as_posix()}'); "
        f"$synth.Speak('{clean_text}'); "
        f"$synth.Dispose();"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], check=True, capture_output=True)


def build_synthetic_benchmark_video(
    video_path: Path,
    scene1_color: str,
    scene2_color: str,
    scene1_text: str,
    scene2_text: str,
) -> float:
    """Builds a 2-scene 10-second MP4 video with custom audio and distinct visual canvas colors."""
    ensure_ffmpeg_path()
    temp_dir = Path("data/temp/eval_build")
    temp_dir.mkdir(parents=True, exist_ok=True)

    audio1 = temp_dir / "audio1.wav"
    audio2 = temp_dir / "audio2.wav"
    concat_audio = temp_dir / "combined_audio.wav"

    generate_synthetic_audio(scene1_text, audio1)
    generate_synthetic_audio(scene2_text, audio2)

    # Pad or adjust each audio section to ~5.0s and concatenate
    filter_complex = (
        "[0:a]apad=pad_dur=5.0,atrim=0:5.0[a1]; "
        "[1:a]apad=pad_dur=5.0,atrim=0:5.0[a2]; "
        "[a1][a2]concat=n=2:v=0:a=1[aout]"
    )
    cmd_audio = [
        "ffmpeg", "-y",
        "-i", str(audio1),
        "-i", str(audio2),
        "-filter_complex", filter_complex,
        "-map", "[aout]",
        str(concat_audio),
    ]
    subprocess.run(cmd_audio, check=True, capture_output=True)

    # Synthesize visual scenes: 5s scene1 color + 5s scene2 color
    video_filter = (
        f"color=c={scene1_color}:s=640x360:d=5.0[v1]; "
        f"color=c={scene2_color}:s=640x360:d=5.0[v2]; "
        f"[v1][v2]concat=n=2:v=1:a=0[vout]"
    )
    cmd_mux = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c={scene1_color}:s=640x360:d=5.0",
        "-f", "lavfi", "-i", f"color=c={scene2_color}:s=640x360:d=5.0",
        "-i", str(concat_audio),
        "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[vout]",
        "-map", "[vout]",
        "-map", "2:a",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-shortest",
        str(video_path),
    ]
    subprocess.run(cmd_mux, check=True, capture_output=True)
    return 10.0


def ingest_and_wait(video_path: Path, filename: str) -> str:
    """Ingests a video into the SQLite and FAISS pipeline and polls until COMPLETED."""
    import uuid
    import shutil

    video_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    storage_filename = f"{video_id}.mp4"
    dest_path = settings.get_absolute_path(settings.VIDEOS_DIR) / storage_filename
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(video_path, dest_path)

    file_size = os.path.getsize(dest_path)

    with SessionLocal() as db:
        new_vid = Video(
            id=video_id,
            original_filename=filename,
            storage_path=f"data/videos/{storage_filename}",
            file_size=file_size,
            mime_type="video/mp4",
            status="UPLOADED",
        )
        new_job = ProcessingJob(
            id=job_id,
            video_id=video_id,
            stage="VALIDATING",
            status="PENDING",
            progress=0.0,
        )
        db.add(new_vid)
        db.add(new_job)
        db.commit()

    # Trigger background ingestion job
    job_service.submit_job(video_id, job_id, dest_path)

    # Wait for completion
    logger.info(f"Ingesting benchmark video '{filename}' ({video_id})...")
    for _ in range(60):
        time.sleep(0.5)
        with SessionLocal() as db:
            j = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
            if j and j.status == "COMPLETED":
                logger.info(f"Benchmark video '{filename}' successfully indexed.")
                return video_id
            if j and j.status == "FAILED":
                raise RuntimeError(f"Ingestion failed for {filename}: {j.error_message}")

    raise TimeoutError(f"Benchmark video '{filename}' did not complete within timeout.")


def setup_benchmark_corpus_and_dataset() -> BenchmarkDataset:
    """Generates the exploratory evaluation videos, indexes them, and saves the benchmark ground truth dataset."""
    BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)
    eval_temp = Path("data/temp/eval_videos")
    eval_temp.mkdir(parents=True, exist_ok=True)

    # Video 1: Deep Learning
    v1_file = eval_temp / "eval_deep_learning.mp4"
    build_synthetic_benchmark_video(
        v1_file,
        scene1_color="0x0B192C",  # Deep navy blue
        scene2_color="0x1E3E62",  # Lighter blue
        scene1_text="Welcome to this lecture on deep learning and neural networks.",
        scene2_text="We explore gradient descent optimization and error loss function minimization.",
    )
    v1_id = ingest_and_wait(v1_file, "eval_deep_learning.mp4")

    # Video 2: Robotics & Vehicles
    v2_file = eval_temp / "eval_robotics_vehicles.mp4"
    build_synthetic_benchmark_video(
        v2_file,
        scene1_color="0xDC2626",  # Bright Red
        scene2_color="0xF59E0B",  # Amber / Yellow
        scene1_text="In computer vision robotics an autonomous red car navigates city streets.",
        scene2_text="A pedestrian enters the room and navigates through the doorway.",
    )
    v2_id = ingest_and_wait(v2_file, "eval_robotics_vehicles.mp4")

    # Video 3: Environmental Science
    v3_file = eval_temp / "eval_climate_science.mp4"
    build_synthetic_benchmark_video(
        v3_file,
        scene1_color="0x06B6D4",  # Cyan ocean
        scene2_color="0x10B981",  # Emerald green
        scene1_text="Earth climate change and global warming cause sea levels to rise.",
        scene2_text="Solar panels and clean renewable green energy can reduce carbon emissions.",
    )
    v3_id = ingest_and_wait(v3_file, "eval_climate_science.mp4")

    corpus_ids = [v1_id, v2_id, v3_id]

    queries = [
        # --- A. Dialogue-Only Queries ---
        BenchmarkQuery(
            query_id="Q01",
            query="What does the speaker say about gradient descent optimization?",
            query_type="dialogue_only",
            expected_relevant_video_ids=[v1_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v1_id,
                    start_time=5.0,
                    end_time=10.0,
                    description="Speaker discusses gradient descent optimization and loss minimization",
                )
            ],
            notes="Requires matching speech transcript segment on optimization",
        ),
        BenchmarkQuery(
            query_id="Q02",
            query="How do solar panels and renewable green energy help?",
            query_type="dialogue_only",
            expected_relevant_video_ids=[v3_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v3_id,
                    start_time=5.0,
                    end_time=10.0,
                    description="Speaker explains solar panels and renewable energy reducing carbon emissions",
                )
            ],
            notes="Requires speech matching on solar panels and green energy",
        ),
        BenchmarkQuery(
            query_id="Q03",
            query="Where does the speaker introduce neural networks and deep learning?",
            query_type="dialogue_only",
            expected_relevant_video_ids=[v1_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v1_id,
                    start_time=0.0,
                    end_time=5.0,
                    description="Lecture introduction covering deep learning and neural networks",
                )
            ],
            notes="Introductory speech segment on deep learning foundations",
        ),
        BenchmarkQuery(
            query_id="Q04",
            query="Discussing global warming and rising sea levels",
            query_type="dialogue_only",
            expected_relevant_video_ids=[v3_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v3_id,
                    start_time=0.0,
                    end_time=5.0,
                    description="Speaker discusses climate change and rising sea levels",
                )
            ],
            notes="Speech segment discussing global warming impacts",
        ),

        # --- B. Visual-Only Queries ---
        BenchmarkQuery(
            query_id="Q05",
            query="A bright red car or red vehicle",
            query_type="visual_only",
            expected_relevant_video_ids=[v2_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v2_id,
                    start_time=0.0,
                    end_time=5.0,
                    description="Red visual canvas scene corresponding to vehicle",
                )
            ],
            notes="Visual retrieval matching bright red visual features",
        ),
        BenchmarkQuery(
            query_id="Q06",
            query="A person enters the room",
            query_type="visual_only",
            expected_relevant_video_ids=[v2_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v2_id,
                    start_time=5.0,
                    end_time=10.0,
                    description="Amber room scene where person navigation occurs",
                )
            ],
            notes="Visual retrieval of person entering room moment",
        ),
        BenchmarkQuery(
            query_id="Q07",
            query="Ocean water or blue sea level view",
            query_type="visual_only",
            expected_relevant_video_ids=[v3_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v3_id,
                    start_time=0.0,
                    end_time=5.0,
                    description="Cyan / aqua canvas scene representing sea levels and water",
                )
            ],
            notes="Visual retrieval of aqua ocean water scene",
        ),
        BenchmarkQuery(
            query_id="Q08",
            query="A green surface representing clean energy",
            query_type="visual_only",
            expected_relevant_video_ids=[v3_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v3_id,
                    start_time=5.0,
                    end_time=10.0,
                    description="Emerald green canvas scene representing clean energy",
                )
            ],
            notes="Visual retrieval of green environmental scene",
        ),

        # --- C. Multimodal Queries (Co-occurring Dialogue and Visuals) ---
        BenchmarkQuery(
            query_id="Q09",
            query="Autonomous red car navigating city streets",
            query_type="multimodal",
            expected_relevant_video_ids=[v2_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v2_id,
                    start_time=0.0,
                    end_time=5.0,
                    description="Co-occurring speech about autonomous car and red visual scene",
                )
            ],
            notes="Joint speech and visual evidence of autonomous red vehicle",
        ),
        BenchmarkQuery(
            query_id="Q10",
            query="Neural networks lecture with blue presentation screen",
            query_type="multimodal",
            expected_relevant_video_ids=[v1_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v1_id,
                    start_time=0.0,
                    end_time=5.0,
                    description="Deep learning speech aligned with blue presentation background",
                )
            ],
            notes="Speech intro with blue slide presentation",
        ),
        BenchmarkQuery(
            query_id="Q11",
            query="Speaker explaining global warming with ocean water visual",
            query_type="multimodal",
            expected_relevant_video_ids=[v3_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v3_id,
                    start_time=0.0,
                    end_time=5.0,
                    description="Climate change dialogue paired with cyan sea water scene",
                )
            ],
            notes="Climate change speech aligned with ocean water visual",
        ),
        BenchmarkQuery(
            query_id="Q12",
            query="Pedestrian entering room during robotics discussion",
            query_type="multimodal",
            expected_relevant_video_ids=[v2_id],
            ground_truth_intervals=[
                GroundTruthInterval(
                    video_id=v2_id,
                    start_time=5.0,
                    end_time=10.0,
                    description="Room entry speech aligned with amber room scene",
                )
            ],
            notes="Speech mentioning pedestrian combined with room visual scene",
        ),

        # --- D. Unanswerable / Negative Queries (Out of Domain) ---
        BenchmarkQuery(
            query_id="Q13",
            query="Quantum computing qubit entanglement and superconductivity",
            query_type="unanswerable",
            expected_relevant_video_ids=[],
            ground_truth_intervals=[],
            is_unanswerable=True,
            notes="Out of domain: no quantum physics concepts exist in corpus",
        ),
        BenchmarkQuery(
            query_id="Q14",
            query="Baking chocolate chip cookies in an oven recipe",
            query_type="unanswerable",
            expected_relevant_video_ids=[],
            ground_truth_intervals=[],
            is_unanswerable=True,
            notes="Out of domain: culinary content absent from corpus",
        ),
        BenchmarkQuery(
            query_id="Q15",
            query="Astronaut landing on Mars spacecraft launch",
            query_type="unanswerable",
            expected_relevant_video_ids=[],
            ground_truth_intervals=[],
            is_unanswerable=True,
            notes="Out of domain: space exploration absent from corpus",
        ),
    ]

    dataset = BenchmarkDataset(
        version="1.0.0",
        dataset_name="Semantic Video Retrieval Benchmark (Exploratory)",
        description=(
            "Standardized benchmark dataset with 15 queries (4 dialogue-only, 4 visual-only, "
            "4 multimodal, and 3 unanswerable) across a controlled 3-video corpus."
        ),
        corpus_video_ids=corpus_ids,
        queries=queries,
    )

    with open(BENCHMARK_FILE, "w", encoding="utf-8") as f:
        json.dump(dataset.model_dump(), f, indent=2)

    logger.info(f"Generated benchmark dataset saved to {BENCHMARK_FILE}")
    return dataset


def load_or_create_benchmark() -> BenchmarkDataset:
    """Loads existing benchmark dataset or creates it if not found."""
    if BENCHMARK_FILE.exists():
        with open(BENCHMARK_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return BenchmarkDataset(**data)
    return setup_benchmark_corpus_and_dataset()
