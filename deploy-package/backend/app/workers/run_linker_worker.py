
from workers.workerlib import run_forever
import importlib
linker = importlib.import_module("app.linker_worker")
def step():
    if hasattr(linker, "step"): return bool(linker.step())
    if hasattr(linker, "poll_once"): linker.poll_once(); return True
    if hasattr(linker, "main"): linker.main(); return True
    raise RuntimeError("linker_worker lacks step/poll_once/main")
if __name__ == "__main__":
    run_forever(step)
