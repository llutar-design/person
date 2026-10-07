"""인물탐험대 콘텐츠 데이터 검사.

사용법:  python tools/validate.py
data/*.js 파일은 `window.X = [ ...JSON... ];` 형태여야 한다.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIELDS = {"과학·발명", "문화·예술", "나라와 사회", "배움과 생각", "나눔과 인권"}
TYPES = {"실존", "신화", "문학"}
STATUSES = {"검토 완료", "검토 필요", "준비 중"}
BASE_KEYS = ["id", "name", "region", "place", "era", "field", "type", "summary", "status", "selectionNote"]

errors = []
warnings = []


def load(path, var):
    text = path.read_text(encoding="utf-8")
    m = re.search(r"window\." + var + r"\s*=\s*(\[.*?\n\]);", text, re.S)
    if not m:
        errors.append(f"{path.name}: window.{var} 배열을 찾지 못함")
        return []
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as e:
        errors.append(f"{path.name}: JSON 형식 오류 - {e}")
        return []


def check_person(p, region):
    pid = p.get("id", "(id 없음)")
    for k in BASE_KEYS:
        if not p.get(k):
            errors.append(f"{pid}: '{k}' 누락")
    if p.get("region") != region:
        errors.append(f"{pid}: region이 '{region}'이 아님")
    if p.get("field") not in FIELDS:
        errors.append(f"{pid}: 알 수 없는 분야 '{p.get('field')}'")
    if p.get("type") not in TYPES:
        errors.append(f"{pid}: 알 수 없는 인물 유형 '{p.get('type')}'")
    if p.get("status") not in STATUSES:
        errors.append(f"{pid}: 알 수 없는 검토 상태 '{p.get('status')}'")
    if region == "world" and not p.get("area"):
        errors.append(f"{pid}: 세계 인물의 대륙(area) 누락")
    if region == "korea" and p.get("inSong") not in ("yes", "no", "check"):
        errors.append(f"{pid}: inSong 값 오류")

    cover = p.get("cover")
    if cover:
        if not cover.get("alt") or not cover.get("kind"):
            errors.append(f"{pid}: 그림의 대체 글(alt) 또는 종류(kind) 누락")
        if not (ROOT / cover.get("src", "")).is_file():
            warnings.append(f"{pid}: 그림 파일 없음 ({cover.get('src')}) — 앱은 그림 없이 동작")

    scene_imgs = p.get("sceneImages")
    if scene_imgs is not None:
        if len(scene_imgs) != 4:
            errors.append(f"{pid}: sceneImages는 장면 수(4)와 같아야 함 (그림이 없는 장면은 null)")
        for i, s in enumerate(scene_imgs, 1):
            if s is None:
                continue
            if not s.get("alt"):
                errors.append(f"{pid}: 장면 {i} 그림의 대체 글(alt) 누락")
            if not (ROOT / s.get("src", "")).is_file():
                warnings.append(f"{pid}: 장면 {i} 그림 파일 없음 ({s.get('src')})")

    if p.get("status") == "준비 중":
        if p.get("scenes") or p.get("quiz"):
            warnings.append(f"{pid}: '준비 중'인데 이야기·퀴즈가 들어 있음 (상태를 확인하세요)")
        return

    # 학습 가능 인물: 전체 콘텐츠 필수
    for k in ["achievements", "scenes", "glossary", "quiz", "mission", "sources"]:
        if not p.get(k):
            errors.append(f"{pid}: 학습 가능 인물인데 '{k}' 누락")
    scenes = p.get("scenes") or []
    if len(scenes) != 4:
        errors.append(f"{pid}: 장면이 4개가 아님 ({len(scenes)}개)")
    for i, s in enumerate(scenes, 1):
        if not (2 <= len(s) <= 3):
            errors.append(f"{pid}: 장면 {i}의 문장 수가 2~3개가 아님 ({len(s)}개)")
        for sent in s:
            if len(sent) > 40:
                warnings.append(f"{pid}: 장면 {i} 문장이 김({len(sent)}자) - {sent}")
    all_text = " ".join(" ".join(s) for s in scenes)
    for g in p.get("glossary") or []:
        if not g.get("word") or not g.get("meaning"):
            errors.append(f"{pid}: 낱말 풀이 항목 누락")
        elif g["word"] not in all_text:
            errors.append(f"{pid}: 낱말 '{g['word']}'이 이야기 본문에 없음")
    quiz = p.get("quiz") or []
    if len(quiz) != 3:
        errors.append(f"{pid}: 퀴즈가 3문제가 아님 ({len(quiz)}개)")
    types = set()
    for i, q in enumerate(quiz, 1):
        types.add(q.get("type"))
        opts = q.get("options") or []
        if q.get("type") == "ox" and opts != ["O", "X"]:
            errors.append(f"{pid}: 퀴즈 {i} OX 선택지 오류")
        if q.get("type") == "choice" and len(opts) != 3:
            errors.append(f"{pid}: 퀴즈 {i} 3지선다 선택지가 3개가 아님")
        if not isinstance(q.get("answer"), int) or not (0 <= q["answer"] < len(opts)):
            errors.append(f"{pid}: 퀴즈 {i} 정답이 선택지 안에 없음")
        if len(q.get("hints") or []) < 2:
            errors.append(f"{pid}: 퀴즈 {i} 힌트가 2개 미만")
        if not q.get("explanation"):
            errors.append(f"{pid}: 퀴즈 {i} 해설 누락")
        if not q.get("question"):
            errors.append(f"{pid}: 퀴즈 {i} 문제 누락")
    for s in p.get("sources") or []:
        if not s.get("title") or not str(s.get("url", "")).startswith("http"):
            errors.append(f"{pid}: 참고 자료 제목/링크 오류")


def main():
    korea = load(ROOT / "data" / "people-korea.js", "PEOPLE_KOREA")
    world = load(ROOT / "data" / "people-world.js", "PEOPLE_WORLD")
    for p in korea:
        check_person(p, "korea")
    for p in world:
        check_person(p, "world")

    ids = Counter(p.get("id") for p in korea + world)
    for pid, n in ids.items():
        if n > 1:
            errors.append(f"ID 중복: {pid} ({n}번)")
    names = Counter((p.get("region"), p.get("name")) for p in korea + world)
    for (r, name), n in names.items():
        if n > 1:
            errors.append(f"이름 중복: {name} ({r})")
    if len(korea) != 100:
        errors.append(f"한국 인물 수가 100명이 아님: {len(korea)}명")
    if len(world) != 100:
        errors.append(f"세계 인물 수가 100명이 아님: {len(world)}명")

    def summary(lst, label):
        ready = [p for p in lst if p.get("status") != "준비 중"]
        names = f" ({', '.join(p['name'] for p in ready)})" if len(ready) <= 20 else ""
        print(f"{label}: 전체 {len(lst)}명 / 학습 가능 {len(ready)}명{names}")
        print("  분야:", dict(Counter(p.get("field") for p in lst)))
        print("  유형:", dict(Counter(p.get("type") for p in lst)))
        print("  성별:", dict(Counter(p.get("gender") for p in lst)))
    summary(korea, "한국")
    print("  동요 수록:", dict(Counter(p.get("inSong") for p in korea)))
    summary(world, "세계")
    print("  대륙:", dict(Counter(p.get("area") for p in world)))

    for w in warnings:
        print("[주의]", w)
    if errors:
        for e in errors:
            print("[오류]", e)
        print(f"\n검사 실패: 오류 {len(errors)}건")
        sys.exit(1)
    print(f"\n검사 통과 (주의 {len(warnings)}건)")


if __name__ == "__main__":
    main()
