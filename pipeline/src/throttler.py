import time
from collections import defaultdict

class Throttler:
    def __init__(self, delay_seconds=1.5):
        self.delay = delay_seconds
        self._last_fetch = defaultdict(float)
    
    def wait(self, domain):
        last_time = self._last_fetch[domain]
        elapsed = time.time() - last_time
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self._last_fetch[domain] = time.time()
