import time
from collections import OrderedDict

# A small in-memory cache for answers that are expensive to build but
# rarely change - every Neon round trip costs ~50-300 ms, so a page that
# asks the same read-only question again shouldn't pay it again.
# Per process: with several server instances each keeps its own copy,
# which the TTL keeps fresh enough for data that changes out-of-band.


class TTLCache:
    def __init__(self, ttl_seconds: float, max_entries: int = 512):
        self.ttl = ttl_seconds
        self.max_entries = max_entries
        self._data: OrderedDict = OrderedDict()

    def get(self, key):
        hit = self._data.get(key)
        if hit is None:
            return None
        stored_at, value = hit
        if time.monotonic() - stored_at > self.ttl:
            self._data.pop(key, None)
            return None
        self._data.move_to_end(key)
        return value

    def set(self, key, value):
        self._data[key] = (time.monotonic(), value)
        self._data.move_to_end(key)
        while len(self._data) > self.max_entries:
            self._data.popitem(last=False)  # drop the least recently used
        return value

    def clear(self):
        self._data.clear()
