from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RawTrend:
    external_id: str          # stable id for dedupe (post id, video id, slug, etc.)
    title: str
    url: str
    velocity: float = 0.0     # upvotes/hr, views/hr, etc.
    raw: dict = field(default_factory=dict)   # full payload for audit trail


class Source(ABC):
    """All trend sources implement this interface."""

    def __init__(self, source_row: dict):
        self.id: int = source_row["id"]
        self.kind: str = source_row["kind"]
        self.handle: str | None = source_row.get("handle")
        self.config: dict = source_row.get("config") or {}

    @abstractmethod
    def fetch(self) -> list[RawTrend]:
        """Pull items from the source. Return empty list on any failure."""
        ...
