# PythonAnywhere の WSGI 設定ファイル（Web タブ → "WSGI configuration file" の中身をこれに置き換える）
# setup_pythonanywhere.sh を使った場合は自動で書き込まれる。
import os
import sys

PROJECT_DIR = os.path.expanduser("~/atally/lead-dashboard")
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)
os.chdir(PROJECT_DIR)

from app import app as application  # noqa: E402,F401
