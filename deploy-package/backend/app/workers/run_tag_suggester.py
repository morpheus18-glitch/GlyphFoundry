from workers.workerlib import run_forever
from app import tag_suggester

def step():
    return bool(tag_suggester.step())

if __name__ == "__main__":
    run_forever(step)
