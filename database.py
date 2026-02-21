from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def _add_user_columns_sqlite(conn):
    """Add name, phone, bio, code_attempts to users if missing (for existing DBs)."""
    for col in ("name", "phone", "bio"):
        try:
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} TEXT"))
        except Exception:
            pass
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN code_attempts INTEGER NOT NULL DEFAULT 0"))
    except Exception:
        pass


def _add_meeting_visible_sqlite(conn):
    """Add is_visible to meetings if missing (existing meetings default to visible)."""
    try:
        conn.execute(text("ALTER TABLE meetings ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT 1"))
    except Exception:
        pass


def _add_meeting_columns_sqlite(conn):
    """Add meeting_id to questions and pulse_polls; backfill with default meeting if needed."""
    try:
        conn.execute(text("ALTER TABLE questions ADD COLUMN meeting_id INTEGER REFERENCES meetings(id)"))
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE pulse_polls ADD COLUMN meeting_id INTEGER REFERENCES meetings(id)"))
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE pulse_polls ADD COLUMN question_id INTEGER REFERENCES questions(id)"))
    except Exception:
        pass
    # Backfill: ensure at least one meeting and assign orphan questions/polls to it
    try:
        r = conn.execute(text("SELECT COUNT(*) FROM meetings")).fetchone()
        count = r[0] if r else 0
        if count == 0:
            conn.execute(text("INSERT INTO meetings (title, created_at) VALUES ('Default Meeting', datetime('now'))"))
        conn.execute(text("UPDATE questions SET meeting_id = (SELECT id FROM meetings LIMIT 1) WHERE meeting_id IS NULL"))
        conn.execute(text("UPDATE pulse_polls SET meeting_id = (SELECT id FROM meetings LIMIT 1) WHERE meeting_id IS NULL"))
    except Exception:
        pass


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_user_columns_sqlite)
        await conn.run_sync(_add_meeting_columns_sqlite)
        await conn.run_sync(_add_meeting_visible_sqlite)
