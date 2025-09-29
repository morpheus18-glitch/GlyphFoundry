from workers.workerlib import run_forever
from app import layout_worker

def step():
    return bool(layout_worker.step())

if __name__ == "__main__":
    run_forever(step)
