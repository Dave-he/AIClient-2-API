import redis
import asyncio
from typing import Optional, Any, Dict, List
import json
import os

class RedisClient:
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(RedisClient, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        if hasattr(self, '_initialized') and self._initialized:
            return
        
        self.host = host
        self.port = port
        self.db = db
        self._client = None
        self._initialized = True
    
    def connect(self):
        if self._client is not None:
            try:
                self._client.ping()
                return True
            except:
                pass
        
        try:
            self._client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5
            )
            self._client.ping()
            return True
        except Exception as e:
            self._client = None
            return False
    
    def is_connected(self) -> bool:
        if self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except:
            return False
    
    def get_client(self) -> Optional[redis.Redis]:
        if not self.is_connected():
            self.connect()
        return self._client
    
    def get(self, key: str) -> Optional[str]:
        client = self.get_client()
        if client is None:
            return None
        return client.get(key)
    
    def set(self, key: str, value: str, expire: Optional[int] = None) -> bool:
        client = self.get_client()
        if client is None:
            return False
        try:
            if expire:
                client.set(key, value, ex=expire)
            else:
                client.set(key, value)
            return True
        except:
            return False
    
    def set_json(self, key: str, value: Any, expire: Optional[int] = None) -> bool:
        try:
            json_str = json.dumps(value)
            return self.set(key, json_str, expire)
        except:
            return False
    
    def get_json(self, key: str) -> Optional[Any]:
        value = self.get(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except:
            return None
    
    def delete(self, key: str) -> bool:
        client = self.get_client()
        if client is None:
            return False
        try:
            client.delete(key)
            return True
        except:
            return False
    
    def exists(self, key: str) -> bool:
        client = self.get_client()
        if client is None:
            return False
        return client.exists(key) > 0
    
    def keys(self, pattern: str = "*") -> List[str]:
        client = self.get_client()
        if client is None:
            return []
        return client.keys(pattern)
    
    def flush_db(self) -> bool:
        client = self.get_client()
        if client is None:
            return False
        try:
            client.flushdb()
            return True
        except:
            return False
    
    def hset(self, key: str, mapping: Dict[str, str]) -> bool:
        client = self.get_client()
        if client is None:
            return False
        try:
            client.hset(key, mapping=mapping)
            return True
        except:
            return False
    
    def hget(self, key: str, field: str) -> Optional[str]:
        client = self.get_client()
        if client is None:
            return None
        return client.hget(key, field)
    
    def hgetall(self, key: str) -> Dict[str, str]:
        client = self.get_client()
        if client is None:
            return {}
        return client.hgetall(key)
    
    def lpush(self, key: str, *values: str) -> bool:
        client = self.get_client()
        if client is None:
            return False
        try:
            client.lpush(key, *values)
            return True
        except:
            return False
    
    def rpush(self, key: str, *values: str) -> bool:
        client = self.get_client()
        if client is None:
            return False
        try:
            client.rpush(key, *values)
            return True
        except:
            return False
    
    def lrange(self, key: str, start: int = 0, end: int = -1) -> List[str]:
        client = self.get_client()
        if client is None:
            return []
        return client.lrange(key, start, end)
    
    def incr(self, key: str) -> Optional[int]:
        client = self.get_client()
        if client is None:
            return None
        try:
            return client.incr(key)
        except:
            return None
    
    def decr(self, key: str) -> Optional[int]:
        client = self.get_client()
        if client is None:
            return None
        try:
            return client.decr(key)
        except:
            return None

redis_client = RedisClient()