"""
常駐ワーカー（任意）。PythonAnywhere の「Always-on tasks」に登録すると、
ブラウザを閉じていても収集・調査・メール自動送信が進む。

  コマンド例: /home/<ユーザー名>/.virtualenvs/leads/bin/python /home/<ユーザー名>/atally/lead-dashboard/worker.py

コードが更新（自動デプロイ）されたら自分で終了し、Always-on task が新しいコードで再起動する。
"""
import os
import sys
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(BASE_DIR, ".env"))

import collector  # noqa: E402
import mailer  # noqa: E402
from db import init_db  # noqa: E402


def code_mtime() -> float:
    return max(os.path.getmtime(os.path.join(BASE_DIR, f)) for f in os.listdir(BASE_DIR) if f.endswith(".py"))


def maybe_auto_prtimes(last: float) -> float:
    """PRTIMES_AUTO_MINUTES ごとに PR TIMES の新着フィードを取り込む（0 で無効）"""
    minutes = int(os.environ.get("PRTIMES_AUTO_MINUTES", "0") or 0)
    if minutes <= 0 or time.time() - last < minutes * 60 or collector.active_run_id():
        return last
    run_id = collector.create_run(os.environ.get("PRTIMES_AUTO_KEYWORD", ""), "", ["prtimes"])
    print(f"auto prtimes run {run_id}", flush=True)
    return time.time()


def main() -> None:
    init_db()
    started = code_mtime()
    last_prtimes = 0.0
    print("worker started", flush=True)
    while True:
        if code_mtime() != started:
            print("code updated, exiting for restart", flush=True)
            return
        try:
            r = mailer.send_step()
            if r.get("status"):
                print(f"mail {r['status']}: {r.get('to')} ({r.get('campaign')}) {r.get('error') or ''}", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"mail error: {e}", flush=True)
        last_prtimes = maybe_auto_prtimes(last_prtimes)
        run_id = collector.active_run_id()
        if run_id:
            run = collector.step(run_id)
            print(f"run {run_id}: {run.get('status')} {run.get('enrich_done')}/{run.get('enrich_total')}", flush=True)
            time.sleep(0.5)
        else:
            time.sleep(5)


if __name__ == "__main__":
    main()
