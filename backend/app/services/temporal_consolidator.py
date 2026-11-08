from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
import math

from backend.app.core.config import settings
from backend.app.schemas.search import SearchResultItem


@dataclass
class TextMatch:
    segment_id: str
    video_id: str
    video_title: str
    start_time: float
    end_time: float
    text: str
    raw_score: float
    normalized_score: float = 0.0
    rank: int = 0
    has_audio: Optional[bool] = None
    video_status: str = "READY"


@dataclass
class VisualMatch:
    frame_id: str
    video_id: str
    video_title: str
    timestamp: float
    preview_url: str
    raw_score: float
    normalized_score: float = 0.0
    rank: int = 0
    has_audio: Optional[bool] = None
    video_status: str = "READY"


class TemporalConsolidator:
    """Consolidates cross-modal evidence and merges adjacent temporal moments."""

    @staticmethod
    def calibrate_score(raw_score: float, lower_bound: float, upper_bound: float) -> float:
        """Clamps and scales raw cosine similarity to [0.0, 1.0] using fixed bounds.

        Formula: clamp((raw_score - lower_bound) / (upper_bound - lower_bound), 0.0, 1.0)
        """
        if upper_bound <= lower_bound:
            return 0.0
        return max(0.0, min(1.0, (raw_score - lower_bound) / (upper_bound - lower_bound)))

    @classmethod
    def calibrate_text_score(cls, raw_score: float) -> float:
        """Calibrates text embedding cosine similarity (all-MiniLM-L6-v2) using fixed bounds."""
        return cls.calibrate_score(
            raw_score,
            settings.CALIBRATION_TEXT_LOWER,
            settings.CALIBRATION_TEXT_UPPER,
        )

    @classmethod
    def calibrate_visual_score(cls, raw_score: float) -> float:
        """Calibrates visual embedding cosine similarity (CLIP ViT-B-32) using fixed bounds."""
        return cls.calibrate_score(
            raw_score,
            settings.CALIBRATION_VISUAL_LOWER,
            settings.CALIBRATION_VISUAL_UPPER,
        )

    @classmethod
    def normalize_min_max(cls, scores: List[float], modality: str = "text") -> List[float]:
        """Fixed-range calibration wrapper for candidate scores.

        Preserves backward compatibility with existing callers while enforcing
        independent, fixed-range clamping rather than per-query relative stretching.
        """
        if not scores:
            return []
        if modality == "visual":
            return [cls.calibrate_visual_score(s) for s in scores]
        return [cls.calibrate_text_score(s) for s in scores]

    def deduplicate_frames(
        self,
        matches: List[VisualMatch],
        cluster_radius_sec: float = 4.0,
    ) -> List[VisualMatch]:
        """Clusters consecutive frames from the same video within cluster_radius_sec, retaining the peak match.

        Prevents multiple neighboring frames from the same 2-second sampling interval
        from dominating the top-K retrieved list.
        """
        if not matches:
            return []

        # Group matches by video_id
        by_video: Dict[str, List[VisualMatch]] = {}
        for m in matches:
            by_video.setdefault(m.video_id, []).append(m)

        deduped: List[VisualMatch] = []

        for video_id, v_matches in by_video.items():
            # Sort by timestamp ascending
            sorted_by_time = sorted(v_matches, key=lambda x: x.timestamp)
            clusters: List[List[VisualMatch]] = []
            curr_cluster: List[VisualMatch] = []

            for m in sorted_by_time:
                if not curr_cluster:
                    curr_cluster.append(m)
                else:
                    if abs(m.timestamp - curr_cluster[-1].timestamp) <= cluster_radius_sec:
                        curr_cluster.append(m)
                    else:
                        clusters.append(curr_cluster)
                        curr_cluster = [m]

            if curr_cluster:
                clusters.append(curr_cluster)

            # For each cluster, pick the frame with the highest raw_score as representative
            for cluster in clusters:
                best = max(cluster, key=lambda x: x.raw_score)
                deduped.append(best)

        # Re-sort by raw_score descending
        deduped.sort(key=lambda x: x.raw_score, reverse=True)
        return deduped

    def fuse_multimodal(
        self,
        text_matches: List[TextMatch],
        visual_matches: List[VisualMatch],
        alpha: float = 0.5,
        beta: float = 0.5,
        fusion_method: str = "linear",
        temporal_window_sec: float = 10.0,
        frame_interval_sec: float = 2.0,
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> List[SearchResultItem]:
        """Fuses text dialogue matches and visual frame matches into consolidated multimodal video moments."""
        # 1. Normalize weights
        total_w = alpha + beta
        if total_w <= 1e-6:
            alpha = 0.5
            beta = 0.5
            total_w = 1.0
        w_text = alpha / total_w
        w_visual = beta / total_w

        # 2. Stage 2: Independent score calibration
        for tm in text_matches:
            tm.normalized_score = self.calibrate_text_score(tm.raw_score)

        # Deduplicate consecutive visual frames to avoid redundant clusters
        deduped_visual = self.deduplicate_frames(visual_matches, cluster_radius_sec=frame_interval_sec * 2.0)
        for vm in deduped_visual:
            vm.normalized_score = self.calibrate_visual_score(vm.raw_score)

        # 3. Candidate eligibility filtering for RRF
        # In RRF mode, filter candidate eligibility by calibrated score threshold BEFORE ranking
        if fusion_method == "rrf" and threshold is not None:
            text_matches = [m for m in text_matches if m.normalized_score >= threshold]
            deduped_visual = [m for m in deduped_visual if m.normalized_score >= threshold]

        # 4. Assign ranks
        for i, tm in enumerate(text_matches):
            tm.rank = i + 1
        for i, vm in enumerate(deduped_visual):
            vm.rank = i + 1

        # 5. Stage 3 & 4: Cross-modal temporal pairing and consolidation
        matched_visual_ids = set()
        matched_text_ids = set()
        fused_items: List[SearchResultItem] = []

        # Find overlapping / co-occurring text and visual matches per video
        for tm in text_matches:
            best_visual: Optional[VisualMatch] = None
            min_dist = float("inf")

            t_center = (tm.start_time + tm.end_time) / 2.0

            for vm in deduped_visual:
                if vm.video_id != tm.video_id:
                    continue
                # Temporal distance between visual keyframe and speech segment center
                dist = abs(vm.timestamp - t_center)
                if dist <= temporal_window_sec and dist < min_dist:
                    min_dist = dist
                    best_visual = vm

            if best_visual is not None:
                # Merge into unified multimodal moment
                matched_text_ids.add(tm.segment_id)
                matched_visual_ids.add(best_visual.frame_id)

                if fusion_method == "rrf":
                    # Reciprocal Rank Fusion: w_1 / (60 + r_1) + w_2 / (60 + r_2)
                    fused_score = (
                        w_text * (1.0 / (60.0 + tm.rank))
                        + w_visual * (1.0 / (60.0 + best_visual.rank))
                    )
                    # Scale RRF score to 0..1 for UI display
                    confidence = round(min(1.0, fused_score * 30.0) * 100, 1)
                else:
                    # Calibrated linear score fusion: w_text * s_text + w_visual * s_visual
                    fused_score = w_text * tm.normalized_score + w_visual * best_visual.normalized_score
                    confidence = round(max(0.0, min(1.0, fused_score)) * 100, 1)

                moment_start = min(tm.start_time, best_visual.timestamp)
                moment_end = max(tm.end_time, best_visual.timestamp + frame_interval_sec)

                fused_items.append(
                    SearchResultItem(
                        segment_id=tm.segment_id,
                        frame_id=best_visual.frame_id,
                        video_id=tm.video_id,
                        video_title=tm.video_title,
                        start_time=round(moment_start, 2),
                        end_time=round(moment_end, 2),
                        peak_time=round(best_visual.timestamp, 2),
                        text=tm.text,
                        score=round(fused_score, 4),
                        confidence_percent=confidence,
                        text_score=round(tm.raw_score, 4),
                        visual_score=round(best_visual.raw_score, 4),
                        fused_score=round(fused_score, 4),
                        modality="multimodal",
                        preview_url=best_visual.preview_url,
                        stream_url=f"/api/videos/{tm.video_id}/stream",
                    )
                )

        # 6. Unpaired text-only candidates (no co-occurring visual match)
        for tm in text_matches:
            if tm.segment_id in matched_text_ids:
                continue

            # Missing-modality policy for unpaired text:
            # Video frames are always present in indexed video assets;
            # since no visual match co-occurred, apply configurable missing-modality discount.
            discount = settings.MISSING_MODALITY_DISCOUNT

            if fusion_method == "rrf":
                score = w_text * (1.0 / (60.0 + tm.rank))
                confidence = round(min(1.0, score * 30.0) * 100, 1)
            else:
                score = tm.normalized_score * discount
                confidence = round(max(0.0, min(1.0, score)) * 100, 1)

            fused_items.append(
                SearchResultItem(
                    segment_id=tm.segment_id,
                    frame_id=None,
                    video_id=tm.video_id,
                    video_title=tm.video_title,
                    start_time=tm.start_time,
                    end_time=tm.end_time,
                    peak_time=round((tm.start_time + tm.end_time) / 2.0, 2),
                    text=tm.text,
                    score=round(score, 4),
                    confidence_percent=confidence,
                    text_score=round(tm.raw_score, 4),
                    visual_score=None,
                    fused_score=round(score, 4),
                    modality="text",
                    preview_url=None,
                    stream_url=f"/api/videos/{tm.video_id}/stream",
                )
            )

        # 7. Unpaired visual-only candidates (no co-occurring dialogue)
        for vm in deduped_visual:
            if vm.frame_id in matched_visual_ids:
                continue

            # Missing-modality policy for unpaired visual:
            # If the video genuinely has no audio and is fully indexed (READY), apply no penalty (discount=1.0).
            # Otherwise (audio was present or processing incomplete), apply discount.
            if vm.has_audio is False and vm.video_status == "READY":
                discount = 1.0
            else:
                discount = settings.MISSING_MODALITY_DISCOUNT

            if fusion_method == "rrf":
                score = w_visual * (1.0 / (60.0 + vm.rank))
                confidence = round(min(1.0, score * 30.0) * 100, 1)
            else:
                score = vm.normalized_score * discount
                confidence = round(max(0.0, min(1.0, score)) * 100, 1)

            fused_items.append(
                SearchResultItem(
                    segment_id=None,
                    frame_id=vm.frame_id,
                    video_id=vm.video_id,
                    video_title=vm.video_title,
                    start_time=vm.timestamp,
                    end_time=round(vm.timestamp + frame_interval_sec, 2),
                    peak_time=round(vm.timestamp, 2),
                    text=f"Visual scene at {vm.timestamp:.1f}s",
                    score=round(score, 4),
                    confidence_percent=confidence,
                    text_score=None,
                    visual_score=round(vm.raw_score, 4),
                    fused_score=round(score, 4),
                    modality="visual",
                    preview_url=vm.preview_url,
                    stream_url=f"/api/videos/{vm.video_id}/stream",
                )
            )

        # 8. Sort by fused score descending
        fused_items.sort(key=lambda x: x.score, reverse=True)

        # 9. Stage 5: User-facing threshold filtering
        # For linear fusion: filter by fused score.
        # For RRF: candidate eligibility was evaluated prior to RRF; do not filter RRF score by threshold.
        if threshold is not None and fusion_method != "rrf":
            fused_items = [item for item in fused_items if item.score >= threshold]

        return fused_items[:top_k]


temporal_consolidator = TemporalConsolidator()
