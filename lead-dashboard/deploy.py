"""
GitHub への push → PythonAnywhere 自動反映。

/deploy エンドポイント（GitHub Actions or GitHub Webhook から HMAC 署名付きで呼ばれる）が
  1. git fetch + reset --hard origin/<DEPLOY_BRANCH>
  2. requirements.txt が変わっていれば pip install
  3. DB スキーマ更新
  4. WSGI ファイルを touch → PythonAnywhere が自動でWebアプリをリロード（手動 Reload 不要）
を行う。.env と data/（DB）は git 管理外なので消えない。
"""
from __future__ import annotations

import getpass
import hashlib
import hmac
import os
import subprocess
import sys
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(BASE_DIR, "data", "deploy.log")


def verify_signature(secret: str, body: bytes, header: str) -> bool:
    if not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[7:])


def _git(*args: str, timeout: int = 120) -> str:
    out = subprocess.run(["git", "-C", BASE_DIR, *args], capture_output=True, text=True, timeout=timeout)
    if out.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {out.stderr.strip() or out.stdout.strip()}")
    return out.stdout.strip()


def current_revision() -> str:
    try:
        return _git("rev-parse", "--short", "HEAD", timeout=10)
    except Exception:  # noqa: BLE001
        return "unknown"


def _file_hash(path: str) -> str:
    try:
        with open(path, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()
    except OSError:
        return ""


def wsgi_file_path() -> str:
    """PythonAnywhere の WSGI 設定ファイル。touch するとWebアプリがリロードされる"""
    if os.environ.get("WSGI_FILE"):
        return os.environ["WSGI_FILE"]
    user = os.environ.get("PA_USERNAME") or getpass.getuser()
    domain = os.environ.get("PA_DOMAIN") or f"{user}.pythonanywhere.com"
    return f"/var/www/{domain.replace('.', '_').lower()}_wsgi.py"


def _python_bin() -> str:
    # uWSGI 内では sys.executable が uwsgi 本体を指すことがあるため virtualenv の python を使う
    for cand in (os.path.join(sys.prefix, "bin", "python"), os.path.join(sys.prefix, "bin", "python3")):
        if os.path.exists(cand):
            return cand
    return f"python{sys.version_info.major}.{sys.version_info.minor}"


def run_deploy(branch: str) -> dict:
    log: list[str] = []
    ok = True
    req = os.path.join(BASE_DIR, "requirements.txt")
    try:
        before = current_revision()
        old_req = _file_hash(req)
        _git("fetch", "--depth", "50", "origin", branch)
        _git("reset", "--hard", f"origin/{branch}")
        after = current_revision()
        log.append(f"git: {before} → {after}")

        if _file_hash(req) != old_req:
            cmd = [_python_bin(), "-m", "pip", "install", "-q", "-r", req]
            if not os.environ.get("VIRTUAL_ENV") and sys.prefix == sys.base_prefix:
                cmd.append("--user")
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            log.append("pip install: " + ("OK" if r.returncode == 0 else f"失敗 {r.stderr[-500:]}"))
            ok = ok and r.returncode == 0

        r = subprocess.run([_python_bin(), "-c", "import db; db.init_db()"], cwd=BASE_DIR,
                           capture_output=True, text=True, timeout=60)
        log.append("DB更新: " + ("OK" if r.returncode == 0 else f"失敗 {r.stderr[-300:]}"))

        wsgi = wsgi_file_path()
        if os.path.exists(wsgi):
            os.utime(wsgi, None)
            log.append(f"リロード: {wsgi} を更新")
        else:
            log.append(f"リロード: WSGIファイルが見つかりません（{wsgi}）。.env の WSGI_FILE を設定してください")
            ok = False
    except Exception as e:  # noqa: BLE001
        ok = False
        log.append(f"失敗: {e}")

    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {'OK' if ok else 'NG'} " + " / ".join(log) + "\n")
    except OSError:
        pass
    return {"ok": ok, "log": log}
