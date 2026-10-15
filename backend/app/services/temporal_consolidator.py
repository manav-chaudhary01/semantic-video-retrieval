from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
import math

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


class TemporalConsolidator:
    """Consolidates cross-modal evidence and merges adjacent temporal moments."""

    @staticmethod
    def normalize_min_max(scores: List[float]) -> List[float]:
        """Performs min-max score calibration over candidate matches so cross-modal scales are comparable."""
        if not scores:
            return []
        if len(scores) == 1:
            return [1.0]

        s_min = min(scores)
        s_max = max(scores)
        span = s_max - s_min
        if span < 1e-6:
            return [1.0] * len(scores)

        return [(s - s_min) / span for s in scores]

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

        # 2. Assign ranks
        for i, tm in enumerate(text_matches):
            tm.rank = i + 1
        for i, vm in enumerate(visual_matches):
            vm.rank = i + 1

        # 3. Calibrate scores
        if text_matches:
            norm_t = self.normalize_min_max([m.raw_score for m in text_matches])
            for m, s in zip(text_matches, norm_t):
                m.normalized_score = s

        # Deduplicate consecutive visual frames to avoid redundant clusters
        deduped_visual = self.deduplicate_frames(visual_matches, cluster_radius_sec=frame_interval_sec * 2.0)
        if deduped_visual:
            norm_v = self.normalize_min_max([m.raw_score for m in deduped_visual])
            for m, s in zip(deduped_visual, norm_v):
                m.normalized_score = s

        # 4. Cross-modal temporal pairing
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
                    # Calibrated linear score fusion
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

        # 5. Include remaining text-only candidates (no co-occurring visual match)
        for tm in text_matches:
            if tm.segment_id in matched_text_ids:
                continue

            if fusion_method == "rrf":
                score = w_text * (1.0 / (60.0 + tm.rank))
                confidence = round(min(1.0, score * 30.0) * 100, 1)
            else:
                score = w_text * tm.normalized_score
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

        # 6. Include remaining visual-only candidates (no co-occurring dialogue)
        for vm in deduped_visual:
            if vm.frame_id in matched_visual_ids:
                continue

            if fusion_method == "rrf":
                score = w_visual * (1.0 / (60.0 + vm.rank))
                confidence = round(min(1.0, score * 30.0) * 100, 1)
            else:
                score = w_visual * vm.normalized_score
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

        # 7. Sort by fused score descending
        fused_items.sort(key=lambda x: x.score, reverse=True)

        # 8. Apply threshold filter if specified
        if threshold is not None:
            fused_items = [item for item in fused_items if item.score >= threshold]

        return fused_items[:top_k]


temporal_consolidator = TemporalConsolidator()
