#!/usr/bin/env python3
"""Camera -> threshold mask -> MJPEG over HTTP.

  /            live preview + threshold slider
  /stream.mjpg the mask, for browsers / OBS Media Source / TouchDesigner
  /set?threshold=N&invert=0|1&blur=N   change + persist
  /config      current settings (JSON)
  POST /power  body "poweroff" | "reboot" — clean shutdown, needs the sudoers rule from setup.sh

source "webcam": any UVC camera (development).  source "aravis": Blackfly S via aravissrc.
"""
import json, os, subprocess, threading, time
import cv2
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
CFG_PATH = os.environ.get("MASK_CONFIG", os.path.join(HERE, "config.json"))

with open(CFG_PATH) as f:
    cfg = json.load(f)
lock = threading.Lock()
latest = {"jpeg": None, "n": 0}
cond = threading.Condition()


def save():
    with open(CFG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)


def open_capture():
    if cfg["source"] == "aravis":
        cap = cv2.VideoCapture(cfg["aravis"], cv2.CAP_GSTREAMER)
    else:
        if not os.path.exists(f"/dev/video{cfg['webcam']}"):
            return None  # nothing plugged in; don't let OpenCV probe every backend
        cap = cv2.VideoCapture(cfg["webcam"], cv2.CAP_V4L2)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, cfg["width"])
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cfg["height"])
    if cap.isOpened():
        return cap
    cap.release()
    return None


def grab_loop():
    cap = None
    while True:
        if cap is None:
            cap = open_capture()
            if cap is None:
                time.sleep(2)  # camera unplugged / not ready: retry forever
                continue
        ok, frame = cap.read()
        if not ok:
            cap.release(); cap = None
            time.sleep(1)  # unplugged mid-stream: back off, then reopen
            continue
        gray = frame if frame.ndim == 2 else cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        with lock:
            thr, inv, blur, q = cfg["threshold"], cfg["invert"], cfg["blur"], cfg["jpeg_quality"]
        if blur > 1:
            k = blur | 1
            gray = cv2.GaussianBlur(gray, (k, k), 0)
        _, mask = cv2.threshold(gray, thr, 255, cv2.THRESH_BINARY_INV if inv else cv2.THRESH_BINARY)
        ok, jpg = cv2.imencode(".jpg", mask, [cv2.IMWRITE_JPEG_QUALITY, q])
        if ok:
            with cond:
                latest["jpeg"] = jpg.tobytes(); latest["n"] += 1
                cond.notify_all()


PAGE = """<!doctype html><title>mask</title>
<body style="margin:0;background:#111;color:#ddd;font:14px sans-serif">
<img src="/stream.mjpg" style="width:100%%;max-width:960px;display:block">
<p style="padding:8px">threshold <input id=t type=range min=0 max=255 value=%d
 oninput="v.textContent=this.value;fetch('/set?threshold='+this.value)"> <b id=v>%d</b>
 &nbsp; <label><input id=i type=checkbox %s onchange="fetch('/set?invert='+(this.checked?1:0))"> invert</label>
 &nbsp; stream: <code>http://%s:%d/stream.mjpg</code>
 &nbsp; <button onclick="power('poweroff')">Power off</button> <button onclick="power('reboot')">Reboot</button></p>
<script>function power(a){if(!confirm(a+' the Pi?'))return;fetch('/power',{method:'POST',body:a});
document.body.innerHTML='<p style=padding:8px>'+a+' — wait for the green LED to stop blinking before unplugging.</p>'}</script>"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/stream.mjpg":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=f")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")  # demos/ pulls the mask into a WebGL texture
            self.end_headers()
            n = -1
            try:
                while True:
                    with cond:
                        cond.wait_for(lambda: latest["n"] != n, timeout=1)
                        if latest["jpeg"] is None or latest["n"] == n:
                            continue
                        jpg, n = latest["jpeg"], latest["n"]
                    self.wfile.write(b"--f\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n" % len(jpg))
                    self.wfile.write(jpg); self.wfile.write(b"\r\n")
            except (BrokenPipeError, ConnectionResetError):
                return
        elif u.path == "/set":
            q = parse_qs(u.query)
            with lock:
                if "threshold" in q: cfg["threshold"] = max(0, min(255, int(q["threshold"][0])))
                if "invert" in q: cfg["invert"] = q["invert"][0] in ("1", "true")
                if "blur" in q: cfg["blur"] = max(0, int(q["blur"][0]))
                save()
            self.reply(200, b"ok", "text/plain")
        elif u.path == "/config":
            with lock:
                self.reply(200, json.dumps(cfg).encode(), "application/json")
        else:
            host = self.headers.get("Host", "mask.local").split(":")[0]
            body = PAGE % (cfg["threshold"], cfg["threshold"], "checked" if cfg["invert"] else "", host, cfg["port"])
            self.reply(200, body.encode(), "text/html")

    def do_POST(self):
        if urlparse(self.path).path != "/power":
            return self.reply(404, b"no", "text/plain")
        action = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode().strip()
        if action not in ("poweroff", "reboot"):
            return self.reply(400, b"poweroff|reboot", "text/plain")
        self.reply(200, b"ok", "text/plain")
        subprocess.Popen(["sudo", "-n", "systemctl", action])

    def reply(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    threading.Thread(target=grab_loop, daemon=True).start()
    print(f"http://0.0.0.0:{cfg['port']}/")
    ThreadingHTTPServer(("0.0.0.0", cfg["port"]), H).serve_forever()
