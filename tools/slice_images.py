"""이미지 시트(1536×1024)를 앱에서 쓰는 개별 파일로 잘라 images/ 아래에 저장한다.

사용법:  python tools/slice_images.py "시트 파일.png"
필요: Pillow (python -m pip install pillow)

시트 배치(이미지 프롬프트 A·B 순서):
  1줄  로고 · 앱 아이콘 · 탐험대원(2명) · 생각 · 응원 · 도장      → 배경을 지워 투명 PNG
  2줄  한국 탐험 · 세계 탐험 · 빈 수첩 · 준비 중                   → WebP
  3줄  분야 아이콘 5 · 단계 아이콘 4 (파스텔 칸)                    → 칸을 지워 투명 PNG
  4줄  세종대왕 · 이순신 · 장영실 · 유관순 · 방정환 대표 그림        → WebP
  5줄  마리 퀴리 · 아인슈타인 · 헬렌 켈러 · 만델라 · 제인 구달        → WebP
좌표는 2026-10-04 오후 12:05 시트 기준으로 측정했다. 다른 시트를 쓰면 좌표를 다시 확인할 것.
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "images"

ROW1 = (7, 259)
# (파일, x 시작, x 끝) — 1줄은 연결된 덩어리의 가운데 x로 나눈다
ROW1_ITEMS = [
    ("ui/logo.png", 0, 370),
    ("ui/icon.png", 370, 572),
    ("ui/mascot-default.png", 572, 874),
    ("ui/mascot-think.png", 874, 1036),
    ("ui/mascot-cheer.png", 1036, 1258),
    ("ui/mascot-stamp.png", 1258, 1536),
]
ROW2 = [  # (파일, 상자)
    ("ui/start-korea.webp", (7, 263, 477, 526)),
    ("ui/start-world.webp", (482, 263, 950, 526)),
    ("ui/empty-notebook.webp", (959, 270, 1236, 526)),
    ("ui/preparing.webp", (1245, 270, 1528, 526)),
]
ICONS_Y = (538, 676)
ICONS = [
    ("icons/field-science.png", 10, 164),
    ("icons/field-arts.png", 177, 331),
    ("icons/field-society.png", 343, 501),
    ("icons/field-learning.png", 513, 673),
    ("icons/field-sharing.png", 686, 838),
    ("icons/step-story.png", 890, 1043),
    ("icons/step-quiz.png", 1055, 1193),
    ("icons/step-mission.png", 1205, 1352),
    ("icons/step-stamp.png", 1364, 1517),
]
PEOPLE_X = [(7, 327), (332, 630), (636, 919), (925, 1222), (1228, 1529)]
PEOPLE = [
    ((686, 844), ["kr-sejong", "kr-yisunsin", "kr-jangyeongsil", "kr-yugwansun", "kr-bangjeonghwan"]),
    ((849, 1014), ["w-curie", "w-einstein", "w-keller", "w-mandela", "w-goodall"]),
]


def near(c, ref, tol):
    return abs(c[0] - ref[0]) <= tol and abs(c[1] - ref[1]) <= tol and abs(c[2] - ref[2]) <= tol


def flood_background(img, refs, tol):
    """테두리에서 시작해 refs 색과 비슷한 픽셀을 배경으로 표시한다."""
    w, h = img.size
    px = img.load()
    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if bg[i]:
            continue
        c = px[x, y]
        if not any(near(c, r, tol) for r in refs):
            continue
        bg[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    return bg


def components(fg, w, h):
    """전경 픽셀의 연결 덩어리 목록 (픽셀 인덱스 리스트)."""
    seen = bytearray(w * h)
    comps = []
    for start in range(w * h):
        if not fg[start] or seen[start]:
            continue
        comp = []
        q = deque([start]); seen[start] = 1
        while q:
            i = q.popleft(); comp.append(i)
            x, y = i % w, i // w
            for j in ((i - 1) if x > 0 else -1, (i + 1) if x < w - 1 else -1, i - w, i + w):
                if 0 <= j < w * h and fg[j] and not seen[j]:
                    seen[j] = 1; q.append(j)
        comps.append(comp)
    return comps


def to_rgba(region, keep):
    w, h = region.size
    out = region.convert("RGBA")
    data = out.load()
    for y in range(h):
        for x in range(w):
            if not keep[y * w + x]:
                data[x, y] = (255, 255, 255, 0)
    bbox = out.getbbox()
    return out.crop(bbox) if bbox else out


def save(img, rel, **kw):
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, **kw)
    print(f"{rel:38s} {img.size[0]}×{img.size[1]}")


def main(sheet_path):
    sheet = Image.open(sheet_path).convert("RGB")

    # 1줄: 흰 배경을 지우고, 덩어리를 가운데 x 기준으로 각 그림에 나눈다.
    top, bottom = ROW1
    row = sheet.crop((0, top, sheet.width, bottom))
    w, h = row.size
    bg = flood_background(row, [(255, 255, 255)], 14)
    fg = bytearray(1 if not b else 0 for b in bg)
    masks = {name: bytearray(w * h) for name, _, _ in ROW1_ITEMS}
    for comp in components(fg, w, h):
        if len(comp) < 12:  # 흰 배경의 잡티
            continue
        cx = sum(i % w for i in comp) / len(comp)
        for name, x0, x1 in ROW1_ITEMS:
            if x0 <= cx < x1:
                for i in comp:
                    masks[name][i] = 1
                break
    for name, _, _ in ROW1_ITEMS:
        img = to_rgba(row, masks[name])
        save(img, name)
        if name == "ui/icon.png":
            square = Image.new("RGBA", (max(img.size),) * 2, (255, 255, 255, 0))
            square.paste(img, ((square.width - img.width) // 2, (square.height - img.height) // 2))
            for size in (192, 512):
                save(square.resize((size, size), Image.LANCZOS), f"ui/icon-{size}.png")
            save(square.resize((48, 48), Image.LANCZOS), "favicon.png")

    # 2줄: 사진형 그림
    for name, box in ROW2:
        save(sheet.crop(box), name, quality=86, method=6)

    # 3줄: 파스텔 칸과 바깥 흰색을 지운다.
    for name, x0, x1 in ICONS:
        # 칸의 둥근 모서리와 테두리 선이 남지 않도록 안쪽으로 10px 들여 자른다.
        tile = sheet.crop((x0 + 10, ICONS_Y[0] + 10, x1 - 10, ICONS_Y[1] - 10))
        # 칸 색은 그림이 어디에 닿느냐에 따라 달라 보이므로, 네 모서리와 위쪽 가운데의 밝은 색을 모두 배경으로 본다.
        tw, th = tile.size
        samples = [tile.getpixel(p) for p in ((2, 2), (tw - 3, 2), (2, th - 3), (tw - 3, th - 3), (tw // 2, 2))]
        refs = [(255, 255, 255)] + [c for c in samples if sum(c) > 540]
        bg = flood_background(tile, refs, 24)
        keep = bytearray(1 if not b else 0 for b in bg)
        save(to_rgba(tile, keep), name)

    # 4·5줄: 인물 대표 그림
    for (y0, y1), ids in PEOPLE:
        for pid, (x0, x1) in zip(ids, PEOPLE_X):
            save(sheet.crop((x0 + 1, y0, x1 - 1, y1)), f"people/{pid}/cover.webp", quality=86, method=6)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("사용법: python tools/slice_images.py <시트.png>")
    main(sys.argv[1])
