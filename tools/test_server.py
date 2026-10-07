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
        RESULT.write_bytes(self.rfile.read(length))
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
