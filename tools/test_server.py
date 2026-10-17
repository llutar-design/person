"""자동 테스트용 로컬 서버.

정적 파일을 제공하고, selftest.html이 POST /__result 로 보낸 결과를
tools/selftest-result.txt 에 저장한다.

사용법:  python tools/test_server.py [포트]
"""
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULT = ROOT / "tools" / "selftest-result.txt"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != "/__result":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        # 진행 상황 보고가 늦게 도착해 최종 결과를 덮어쓰지 않게 한다.
        done = RESULT.exists() and b"RESULT:" in RESULT.read_bytes()
        if not done or b"RESULT:" in body:
            tmp = RESULT.with_suffix(".tmp")
            tmp.write_bytes(body)
            tmp.replace(RESULT)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
