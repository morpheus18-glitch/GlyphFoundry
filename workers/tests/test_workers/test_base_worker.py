"""Unit tests for BaseWorker utility methods."""
import asyncio

from workers.shared.base_worker import BaseWorker, WorkerMessage


class DummyMessage:
    def __init__(self, payload):
        self.correlation_id = "test"
        self.message_type = "test"
        self.payload = payload


class DummyWorker(BaseWorker):
    def __init__(self):
        super().__init__(worker_type="dummy", redis_url="redis://localhost:6379/0", max_concurrent_jobs=1)
        self._processed = asyncio.Event()

    async def on_startup(self) -> None:
        self._processed.clear()

    async def fetch_job(self):
        self._shutdown_event.set()
        return DummyMessage({"value": 1})

    async def handle_job(self, message: WorkerMessage) -> None:
        if message.payload["value"] != 1:
            raise AssertionError("unexpected payload")
        self._processed.set()


def test_worker_processes_job(monkeypatch):
    async def fake_ping(self):
        return True

    worker = DummyWorker()
    monkeypatch.setattr("redis.asyncio.client.Redis.ping", fake_ping)

    async def fake_close(self):
        return None

    monkeypatch.setattr("redis.asyncio.client.Redis.aclose", fake_close)
    async def fake_register(self):
        return None
    monkeypatch.setattr(worker, "_register_worker", fake_register.__get__(worker, DummyWorker))
    async def fake_update(self, status):
        return None
    monkeypatch.setattr(worker, "_update_status", fake_update.__get__(worker, DummyWorker))
    async def fake_send(self):
        return None
    monkeypatch.setattr(worker, "_send_heartbeat", fake_send.__get__(worker, DummyWorker))

    async def run_worker():
        await worker.on_startup()
        message = await worker.fetch_job()
        await worker.handle_job(message)

    asyncio.run(run_worker())
    assert worker._processed.is_set()
