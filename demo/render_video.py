"""Render the Specimen Casebook three-minute hackathon demo.

Run from the repository root:
  uv run --with imageio-ffmpeg python demo/render_video.py
"""

from __future__ import annotations

import json
import re
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg


ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demo"
SLIDES = DEMO / "slides"
AUDIO = DEMO / "audio"
WORK = DEMO / "video-work"
OUTPUT = DEMO / "SpecimenCasebook_3min_Demo.mp4"
CAPTIONS = DEMO / "captions.srt"
FPS = 30
TARGET_SECONDS = 180.0


def audio_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes() / wav.getframerate()


def srt_time(seconds: float) -> str:
    millis = round(seconds * 1000)
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    secs, millis = divmod(millis, 1_000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


def make_captions(segments: list[dict], durations: list[float]) -> None:
    rows: list[str] = []
    caption_index = 1
    slide_start = 0.0
    for segment, narration_seconds in zip(segments, durations):
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", segment["text"]) if s.strip()]
        weights = [max(1, len(sentence.split())) for sentence in sentences]
        weight_total = sum(weights)
        cursor = slide_start + 0.5
        for sentence, weight in zip(sentences, weights):
            span = narration_seconds * weight / weight_total
            end = cursor + span
            rows.extend([str(caption_index), f"{srt_time(cursor)} --> {srt_time(end)}", sentence, ""])
            caption_index += 1
            cursor = end
        slide_start += narration_seconds + 1.0
    CAPTIONS.write_text("\n".join(rows), encoding="utf-8")


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> None:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    segments = json.loads((DEMO / "narration.json").read_text(encoding="utf-8"))
    WORK.mkdir(parents=True, exist_ok=True)
    narration_durations = [audio_duration(AUDIO / f"narration-{item['id']}.wav") for item in segments]
    make_captions(segments, narration_durations)

    rendered: list[Path] = []
    for item, narration_seconds in zip(segments, narration_durations):
        slide = SLIDES / f"slide-{item['id']}.png"
        narration = AUDIO / f"narration-{item['id']}.wav"
        out = WORK / f"segment-{item['id']}.mp4"
        duration = narration_seconds + 1.0
        still_frame = (
            f"scale=1280:720:flags=lanczos,fps={FPS},"
            "format=yuv420p,setsar=1"
        )
        run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-loop",
                "1",
                "-i",
                str(slide),
                "-i",
                str(narration),
                "-filter_complex",
                f"[0:v]{still_frame}[v];[1:a]adelay=500:all=1,apad=pad_dur=0.5,aresample=48000[a]",
                "-map",
                "[v]",
                "-map",
                "[a]",
                "-t",
                f"{duration:.3f}",
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "20",
                "-c:a",
                "aac",
                "-b:a",
                "160k",
                "-ar",
                "48000",
                "-movflags",
                "+faststart",
                "-y",
                str(out),
            ]
        )
        rendered.append(out)

    concat_file = WORK / "segments.txt"
    concat_file.write_text(
        "\n".join(f"file '{path.as_posix()}'" for path in rendered), encoding="utf-8"
    )
    joined = WORK / "joined.mp4"
    run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_file),
            "-c",
            "copy",
            "-y",
            str(joined),
        ]
    )

    escaped_srt = CAPTIONS.resolve().as_posix().replace(":", r"\:")
    subtitle_filter = (
        f"subtitles='{escaped_srt}':"
        "force_style='FontName=Arial,FontSize=19,PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H00142B20,BorderStyle=3,BackColour=&HAA142B20,"
        "Outline=1,Shadow=0,MarginV=24,Alignment=2'"
    )
    run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(joined),
            "-vf",
            subtitle_filter,
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-t",
            f"{TARGET_SECONDS:.3f}",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-ar",
            "48000",
            "-movflags",
            "+faststart",
            "-y",
            str(OUTPUT),
        ]
    )
    print(OUTPUT)


if __name__ == "__main__":
    main()
