"""
Minimal conftest for pure unit tests (no database, no Redis).

These tests cover stateless service functions (chunking, WPM calculation, etc.)
and must be runnable on any developer machine without Docker.
The parent conftest.py (which wires up a live Postgres test DB) is NOT loaded
here because pytest stops conftest discovery at the first __init__.py boundary
within a package — and the unit/ sub-package has its own __init__.py.
"""
import os

# Provide dummy values so config.py can instantiate Settings without a real DB/Redis.
# The services tested here never touch the DB or Redis.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://dummy:dummy@localhost/dummy")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault(
    "SECRET_KEY",
    "c4f86a9d72e51930b80f1d47a82b3149e6f284c718a39d05e21976a4f5b8c30d",
)
