
from workers.workerlib import run_forever
import importlib
nlp_mod = importlib.import_module("app.nlp_extract")
def step():
    if hasattr(nlp_mod, "step"): return bool(nlp_mod.step())
    if hasattr(nlp_mod, "poll_once"): nlp_mod.poll_once(); return True
    if hasattr(nlp_mod, "main"): nlp_mod.main(); return True
    raise RuntimeError("nlp_extract lacks step/poll_once/main")
if __name__ == "__main__":
    run_forever(step)
