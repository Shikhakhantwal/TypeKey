"""
TypeKey Dual-Port Local Server
Serves TypeKey on both Port 3000 AND Port 15418 simultaneously.
Supports / and /shikha15418 routes, and enforces no-cache headers.
"""
import http.server
import socketserver
import os
import sys
import threading

PORTS = [3000, 15418]
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class TypeKeyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def translate_path(self, path):
        clean_path = path.split('?')[0].split('#')[0].strip('/')
        if clean_path in ['', 'shikha15418']:
            return os.path.join(DIRECTORY, 'index.html')
        return super().translate_path(path)

    def end_headers(self):
        # Prevent browser caching of any files during development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def start_server_on_port(port):
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", port), TypeKeyHandler) as httpd:
            print(f"TypeKey listening on http://localhost:{port}/ and http://localhost:{port}/shikha15418")
            sys.stdout.flush()
            httpd.serve_forever()
    except Exception as e:
        print(f"Error starting server on port {port}: {e}")
        sys.stdout.flush()

def main():
    threads = []
    for port in PORTS:
        t = threading.Thread(target=start_server_on_port, args=(port,), daemon=True)
        t.start()
        threads.append(t)
    
    print("TypeKey dual servers running:")
    for port in PORTS:
        print(f" - http://localhost:{port}/")
        print(f" - http://localhost:{port}/shikha15418")
    sys.stdout.flush()

    try:
        # Keep main thread alive
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("Stopping servers.")

if __name__ == '__main__':
    main()