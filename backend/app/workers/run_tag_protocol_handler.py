from workers.workerlib import run_forever
from app import tag_protocol_handler

def step():
    return bool(tag_protocol_handler.step())

if __name__ == "__main__":
    run_forever(step)
