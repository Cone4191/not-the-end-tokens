import bcrypt
from models import db, User, Session
from datetime import datetime, timedelta
import uuid


def hash_password(password):
    """Hash della password con bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password, password_hash):
    """Verifica la password"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def create_user(username, password):
    """Crea un nuovo utente"""
    # Verifica se l'utente esiste già
    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return None, "Username già esistente"

    # Crea nuovo utente
    password_hash = hash_password(password)
    new_user = User(username=username, password_hash=password_hash)

    try:
        db.session.add(new_user)
        db.session.commit()
        return new_user, None
    except Exception as e:
        db.session.rollback()
        return None, f"Errore nella creazione utente: {str(e)}"


def login_user(username, password):
    """Login utente"""
    user = User.query.filter_by(username=username).first()

    if not user:
        return None, None, "Username non trovato"

    if not verify_password(password, user.password_hash):
        return None, None, "Password errata"

    # Aggiorna ultimo login
    user.last_login = datetime.utcnow()

    # Crea sessione
    session_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=7)  # Sessione valida per 7 giorni

    session = Session(
        session_id=session_id,
        user_id=user.id,
        expires_at=expires_at
    )

    try:
        db.session.add(session)
        db.session.commit()
        return user, session_id, None
    except Exception as e:
        db.session.rollback()
        return None, None, f"Errore nella creazione sessione: {str(e)}"


def verify_session(session_id):
    """Verifica se la sessione è valida"""
    session = Session.query.filter_by(session_id=session_id).first()

    if not session:
        return None, "Sessione non trovata"

    if session.expires_at < datetime.utcnow():
        return None, "Sessione scaduta"

    return session.user, None


def logout_user(session_id):
    """Logout utente (elimina sessione)"""
    session = Session.query.filter_by(session_id=session_id).first()

    if session:
        try:
            db.session.delete(session)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            return False

    return False
