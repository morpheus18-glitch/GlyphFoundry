
import signal, time, sys, traceback
STOP = False
def _handle_sigterm(signum, frame):
    global STOP
    STOP = True
signal.signal(signal.SIGTERM, _handle_sigterm)
signal.signal(signal.SIGINT, _handle_sigterm)

def run_forever(step_fn, idle_sleep=0.1):
    backoff=0.5
    while not STOP:
        try:
            did = bool(step_fn())
            if did:
                backoff = 0.5
            else:
                time.sleep(idle_sleep)
        except Exception:
            traceback.print_exc(file=sys.stderr)
            time.sleep(backoff)
            backoff = min(8.0, backoff*2)
