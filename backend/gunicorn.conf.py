
import multiprocessing, os
bind = "0.0.0.0:8000"
workers = int(os.getenv("GUNICORN_WORKERS", str(2 * multiprocessing.cpu_count() + 1)))
threads = int(os.getenv("GUNICORN_THREADS", "2"))
worker_class = "uvicorn.workers.UvicornWorker"
worker_tmp_dir = "/tmp"
preload_app = True
keepalive = 30
graceful_timeout = 30
timeout = 60
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOGLEVEL", "info")
backlog = 2048
