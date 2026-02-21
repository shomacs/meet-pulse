from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, DateTime, Text, Column
from sqlalchemy.types import Integer as SAInteger
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(SAInteger, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    bio = Column(Text, nullable=True)  # basic info / notes
    is_approved = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    verification_code = Column(String(10), nullable=True)
    code_expires_at = Column(DateTime, nullable=True)
    code_attempts = Column(SAInteger, default=0, nullable=False)

    questions = relationship("Question", back_populates="author")
    question_votes = relationship("QuestionVote", back_populates="user")
    option_votes = relationship("OptionVote", back_populates="user")
    pulse_votes = relationship("PulseVote", back_populates="user")


class Meeting(Base):
    __tablename__ = "meetings"
    id = Column(SAInteger, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_visible = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(SAInteger, ForeignKey("users.id"), nullable=True)

    created_by = relationship("User", backref="meetings_created")
    questions = relationship("Question", back_populates="meeting", cascade="all, delete-orphan")
    pulse_polls = relationship("PulsePoll", back_populates="meeting", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"
    id = Column(SAInteger, primary_key=True, autoincrement=True)
    meeting_id = Column(SAInteger, ForeignKey("meetings.id"), nullable=True)  # backfill for existing DBs
    text = Column(Text, nullable=False)
    author_id = Column(SAInteger, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="questions")
    author = relationship("User", back_populates="questions")
    votes = relationship("QuestionVote", back_populates="question", cascade="all, delete-orphan")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan")


class QuestionVote(Base):
    __tablename__ = "question_votes"
    id = Column(SAInteger, primary_key=True, autoincrement=True)
    question_id = Column(SAInteger, ForeignKey("questions.id"), nullable=False)
    user_id = Column(SAInteger, ForeignKey("users.id"), nullable=False)
    vote_type = Column(String(10), nullable=False)  # 'up' or 'down'
    created_at = Column(DateTime, default=datetime.utcnow)

    question = relationship("Question", back_populates="votes")
    user = relationship("User", back_populates="question_votes")


class QuestionOption(Base):
    __tablename__ = "question_options"
    id = Column(SAInteger, primary_key=True, autoincrement=True)
    question_id = Column(SAInteger, ForeignKey("questions.id"), nullable=False)
    text = Column(String(500), nullable=False)
    sort_order = Column(SAInteger, default=0)

    question = relationship("Question", back_populates="options")
    votes = relationship("OptionVote", back_populates="option", cascade="all, delete-orphan")


class OptionVote(Base):
    __tablename__ = "option_votes"
    id = Column(SAInteger, primary_key=True, autoincrement=True)
    option_id = Column(SAInteger, ForeignKey("question_options.id"), nullable=False)
    user_id = Column(SAInteger, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    option = relationship("QuestionOption", back_populates="votes")
    user = relationship("User", back_populates="option_votes")


# Live pulse poll (per meeting; optional: tied to a question)
class PulsePoll(Base):
    __tablename__ = "pulse_polls"
    id = Column(SAInteger, primary_key=True, autoincrement=True)
    meeting_id = Column(SAInteger, ForeignKey("meetings.id"), nullable=True)
    question_id = Column(SAInteger, ForeignKey("questions.id"), nullable=True)  # when set, pulse is for this question
    title = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="pulse_polls")
    question = relationship("Question", backref="pulse_polls")
    options = relationship("PulseOption", back_populates="poll", cascade="all, delete-orphan")


class PulseOption(Base):
    __tablename__ = "pulse_options"
    id = Column(SAInteger, primary_key=True, autoincrement=True)
    poll_id = Column(SAInteger, ForeignKey("pulse_polls.id"), nullable=False)
    text = Column(String(200), nullable=False)
    sort_order = Column(SAInteger, default=0)

    poll = relationship("PulsePoll", back_populates="options")
    votes = relationship("PulseVote", back_populates="option", cascade="all, delete-orphan")


class PulseVote(Base):
    __tablename__ = "pulse_votes"
    id = Column(SAInteger, primary_key=True, autoincrement=True)
    option_id = Column(SAInteger, ForeignKey("pulse_options.id"), nullable=False)
    user_id = Column(SAInteger, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    option = relationship("PulseOption", back_populates="votes")
    user = relationship("User", back_populates="pulse_votes")
