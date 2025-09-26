from workers.workerlib import run_forever
from app import curation_worker

def step():
    return bool(curation_worker.step())

if __name__ == "__main__":
    run_forever(step)
