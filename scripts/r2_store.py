"""Minimal R2 client using the S3 SigV4 API. Used by the fallback engine.

Device sync goes through the Worker instead, so a laptop never needs these keys.
"""
import hashlib
import hmac
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

EMPTY_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def canonical_request(method, uri, query, headers, payload_hash):
    names = sorted(headers)
    canonical_headers = "".join(f"{name}:{headers[name]}\n" for name in names)
    signed = ";".join(names)
    return f"{method}\n{uri}\n{query}\n{canonical_headers}\n{signed}\n{payload_hash}", signed


def signature(secret, date_stamp, region, service, string_to_sign):
    def digest(key, message):
        return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()

    key = digest(("AWS4" + secret).encode("utf-8"), date_stamp)
    key = digest(key, region)
    key = digest(key, service)
    key = digest(key, "aws4_request")
    return hmac.new(key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()


def authorization(access_key, secret, method, uri, query_pairs, extra_headers, payload, now, region="auto", service="s3"):
    payload_hash = hashlib.sha256(payload).hexdigest()
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    headers = {"x-amz-content-sha256": payload_hash, "x-amz-date": amz_date, **extra_headers}
    query = "&".join(
        f"{urllib.parse.quote(name, safe='')}={urllib.parse.quote(value, safe='')}"
        for name, value in sorted(query_pairs)
    )
    canonical, signed = canonical_request(method, uri, query, headers, payload_hash)
    scope = f"{date_stamp}/{region}/{service}/aws4_request"
    string_to_sign = "\n".join(["AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical.encode()).hexdigest()])
    signed_value = signature(secret, date_stamp, region, service, string_to_sign)
    header = f"AWS4-HMAC-SHA256 Credential={access_key}/{scope}, SignedHeaders={signed}, Signature={signed_value}"
    return header, headers, query


class R2Store:
    def __init__(self, account_id, access_key, secret_key, bucket, prefix="v1", clock=None):
        self.account_id = account_id
        self.access_key = access_key
        self.secret_key = secret_key
        self.bucket = bucket
        self.prefix = prefix.strip("/")
        self.clock = clock
        self.host = f"{account_id}.r2.cloudflarestorage.com"

    def manifest(self):
        found = {}
        token = None
        while True:
            pairs = [("list-type", "2"), ("max-keys", "1000"), ("prefix", self.prefix + "/")]
            if token:
                pairs.append(("continuation-token", token))
            root = ET.fromstring(self._request("GET", "", pairs, {}, b""))
            for content in root.iter():
                if _local(content.tag) != "Contents":
                    continue
                key = _child(content, "Key")
                logical = self._logical(key)
                if not logical:
                    continue
                meta = self._head_sha(logical)
                found[logical] = meta
            truncated = next((item.text for item in root.iter() if _local(item.tag) == "IsTruncated"), "false")
            if truncated != "true":
                break
            token = next((item.text for item in root.iter() if _local(item.tag) == "NextContinuationToken"), None)
            if not token:
                break
        return found

    def get(self, key):
        status, body, _headers = self._raw("GET", self._object_path(key), [], {}, b"")
        if status == 404:
            raise FileNotFoundError(key)
        if status != 200:
            raise RuntimeError(f"R2 读取失败 {status}")
        return body

    def put(self, key, data):
        digest = hashlib.sha256(data).hexdigest()
        status, _body, _headers = self._raw(
            "PUT",
            self._object_path(key),
            [],
            {"content-type": "application/octet-stream", "x-amz-meta-sha256": digest},
            data,
        )
        if status not in (200, 201):
            raise RuntimeError(f"R2 写入失败 {status}")

    def delete(self, key):
        status, _body, _headers = self._raw("DELETE", self._object_path(key), [], {}, b"")
        if status not in (200, 204, 404):
            raise RuntimeError(f"R2 删除失败 {status}")

    def _head_sha(self, key):
        status, _body, headers = self._raw("HEAD", self._object_path(key), [], {}, b"")
        if status != 200:
            raise RuntimeError(f"R2 元数据失败 {status}")
        digest = headers.get("x-amz-meta-sha256")
        if not digest:
            raise RuntimeError("R2 对象缺少校验")
        return digest

    def _object_path(self, key):
        from sync_engine import valid_sync_key
        if not valid_sync_key(key, True):
            raise ValueError("同步路径无效")
        return "/" + self.bucket + "/" + self.prefix + "/" + key

    def _logical(self, stored):
        from sync_engine import valid_sync_key
        marker = self.prefix + "/"
        if not stored or not stored.startswith(marker):
            return None
        key = stored[len(marker):]
        return key if valid_sync_key(key, True) else None

    def _request(self, method, suffix, query, extra, payload):
        status, body, _headers = self._raw(method, "/" + self.bucket + suffix, query, extra, payload)
        if status != 200:
            raise RuntimeError(f"R2 列表失败 {status}")
        return body

    def _raw(self, method, uri, query, extra, payload):
        from datetime import datetime, timezone
        now = self.clock() if self.clock else datetime.now(timezone.utc)
        host_headers = {"host": self.host, **{name.lower(): value for name, value in extra.items()}}
        auth, signed_headers, query_string = authorization(
            self.access_key, self.secret_key, method, uri, query, host_headers, payload, now
        )
        url = f"https://{self.host}{uri}"
        if query_string:
            url += "?" + query_string
        request = urllib.request.Request(url, data=payload if method in ("PUT", "POST") else None, method=method)
        for name, value in signed_headers.items():
            request.add_header(name, value)
        request.add_header("Authorization", auth)
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.status, response.read(), {key.lower(): value for key, value in response.headers.items()}
        except urllib.error.HTTPError as error:
            return error.code, error.read(), {key.lower(): value for key, value in error.headers.items()}


def _local(tag):
    return tag.rsplit("}", 1)[-1]
