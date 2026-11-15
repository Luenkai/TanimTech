"""Shared helper for calling third-party JSON APIs (Trefle, ISRIC SoilGrids).

Gives every client the same behaviour: timeout, a couple of retries for 429/5xx/network blips,
a small in-memory TTL cache (the free tiers are rate limited), and one error type the routes can
turn into a clean JSON response. Secrets (API tokens) are never put into error messages.
"""
import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "TanimTech/1.0 (+crop planning web app)"


class UpstreamError(Exception):
    """status = HTTP status we should answer with; upstream = status the provider returned (if any)."""

    def __init__(self, message, status=502, upstream=None, retry_after=None):
        super().__init__(message)
        self.message, self.status, self.upstream, self.retry_after = message, status, upstream, retry_after


def _open(request, timeout):
    """Single network call. Tests replace this function."""
    return urllib.request.urlopen(request, timeout=timeout)


def fetch_json(url, params=None, headers=None, timeout=20, retries=2, provider="upstream"):
    query = urllib.parse.urlencode(params or {}, doseq=True, safe="[],")
    full = f"{url}?{query}" if query else url
    request = urllib.request.Request(full, headers={"Accept": "application/json", "User-Agent": USER_AGENT, **(headers or {})})
    last = None
    for attempt in range(retries + 1):
        try:
            with _open(request, timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            retry_after = exc.headers.get("Retry-After") if exc.headers else None
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(min(float(retry_after) if (retry_after or "").replace(".", "").isdigit() else 0.6 * (attempt + 1), 3))
                last = exc
                continue
            if exc.code == 429:
                raise UpstreamError(f"{provider} is rate limiting requests. Wait a minute and try again.", 429, 429,
                                    int(retry_after) if (retry_after or "").isdigit() else 60) from None
            if exc.code in (401, 403):
                raise UpstreamError(f"{provider} rejected the request (HTTP {exc.code}). Check the API token on the server.", 502, exc.code) from None
            if exc.code == 404:
                raise UpstreamError(f"{provider} has no data for that request.", 404, 404) from None
            raise UpstreamError(f"{provider} returned an error (HTTP {exc.code}).", 502, exc.code) from None
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last = exc
            if attempt < retries:
                time.sleep(0.6 * (attempt + 1))
                continue
            raise UpstreamError(f"{provider} could not be reached. Try again later.", 504) from None
        except ValueError:
            raise UpstreamError(f"{provider} returned an unreadable response.", 502) from None
    raise UpstreamError(f"{provider} is unavailable.", 502) from None


class TTLCache:
    def __init__(self, ttl=3600, max_items=512):
        self.ttl, self.max_items, self._data, self._lock = ttl, max_items, {}, threading.Lock()

    def get(self, key):
        with self._lock:
            hit = self._data.get(key)
            if hit and hit[0] > time.time():
                return hit[1]
            self._data.pop(key, None)
            return None

    def set(self, key, value):
        with self._lock:
            if len(self._data) >= self.max_items:
                self._data.pop(next(iter(self._data)))
            self._data[key] = (time.time() + self.ttl, value)
            return value

    def clear(self):
        with self._lock:
            self._data.clear()
