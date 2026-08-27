"""
로컬 확인용 웹 서버

파이썬 기본 서버(python -m http.server)를 쓰면 브라우저가 파일을 캐시해서
코드를 고쳐도 옛 내용이 보일 수 있습니다. 특히 테스트가 고치기 전 코드를
검사하면서 "통과"라고 나오는 일이 생깁니다.

이 서버는 캐시하지 말라는 헤더를 붙여 그 문제를 막습니다.

사용법
    python serve.py            (기본 7777 포트)
    python serve.py 8080       (포트 지정)

그다음 브라우저에서
    http://localhost:7777/            검토 툴
    http://localhost:7777/new.html    새 UI 작업본
    http://localhost:7777/tests.html  회귀 테스트
"""
import sys
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):        # 요청 로그는 조용히
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 7777
    handler = partial(NoCacheHandler, directory='.')
    with HTTPServer(('127.0.0.1', port), handler) as httpd:
        print(f'  검토 툴   http://localhost:{port}/')
        print(f'  새 UI     http://localhost:{port}/new.html')
        print(f'  테스트    http://localhost:{port}/tests.html')
        print('\n  종료하려면 Ctrl+C')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n종료했습니다.')


if __name__ == '__main__':
    main()
