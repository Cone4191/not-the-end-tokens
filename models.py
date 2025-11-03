from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()


class User(db.Model):
    """Modello Utente"""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)

    # Relazioni
    owned_rooms = db.relationship('Room', backref='owner', lazy='dynamic', foreign_keys='Room.owner_id')
    characters = db.relationship('Character', backref='user', lazy='dynamic')
    sessions = db.relationship('Session', backref='user', lazy='dynamic')

    def __repr__(self):
        return f'<User {self.username}>'


class Session(db.Model):
    """Modello Sessione"""
    __tablename__ = 'sessions'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)

    def __repr__(self):
        return f'<Session {self.session_id}>'


class Room(db.Model):
    """Modello Stanza"""
    __tablename__ = 'rooms'

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.String(20), unique=True, nullable=False, index=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

    # Stato del sacchetto
    bag_successi = db.Column(db.Integer, default=0)
    bag_complicazioni = db.Column(db.Integer, default=0)

    # Relazioni
    players = db.relationship('RoomPlayer', backref='room', lazy='dynamic', cascade='all, delete-orphan')
    characters = db.relationship('Character', backref='room', lazy='dynamic', cascade='all, delete-orphan')
    history = db.relationship('DrawHistory', backref='room', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Room {self.room_id}>'

    def to_dict(self):
        """Converti stanza in dizionario"""
        return {
            'id': self.room_id,
            'owner_id': self.owner_id,
            'players': [p.player_name for p in self.players.all()],
            'created_at': self.created_at.isoformat(),
            'bag': {
                'successi': self.bag_successi,
                'complicazioni': self.bag_complicazioni
            }
        }


class RoomPlayer(db.Model):
    """Modello Giocatore in Stanza"""
    __tablename__ = 'room_players'

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # Può essere null se giocatore guest
    player_name = db.Column(db.String(100), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<RoomPlayer {self.player_name}>'


class Character(db.Model):
    """Modello Scheda Personaggio"""
    __tablename__ = 'characters'

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    player_name = db.Column(db.String(100), nullable=False)

    # Dati personaggio (JSON)
    name = db.Column(db.String(200))
    motivation = db.Column(db.Text)
    archetype = db.Column(db.String(200))
    photo = db.Column(db.Text)  # Base64 della foto

    # Tratti (stored as JSON)
    traits = db.Column(db.Text)  # JSON array di tratti
    selected_traits = db.Column(db.Text)  # JSON array di ID selezionati
    empowered_traits = db.Column(db.Text)  # JSON array di ID potenziati

    # Contatori
    quality_counter = db.Column(db.Integer, default=0)
    ability_counter = db.Column(db.Integer, default=0)

    # Sventure e Lezioni (JSON)
    misfortunes = db.Column(db.Text)  # JSON array
    lessons = db.Column(db.Text)  # JSON array

    # Risorse e Note
    resources = db.Column(db.Text)
    notes = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Character {self.name}>'

    def to_dict(self):
        """Converti personaggio in dizionario"""
        return {
            'name': self.name,
            'motivation': self.motivation,
            'archetype': self.archetype,
            'photo': self.photo,
            'traits': json.loads(self.traits) if self.traits else [],
            'selected_traits': json.loads(self.selected_traits) if self.selected_traits else [],
            'empowered_traits': json.loads(self.empowered_traits) if self.empowered_traits else [],
            'quality_counter': self.quality_counter,
            'ability_counter': self.ability_counter,
            'misfortunes': json.loads(self.misfortunes) if self.misfortunes else [],
            'lessons': json.loads(self.lessons) if self.lessons else [],
            'resources': self.resources,
            'notes': self.notes
        }


class DrawHistory(db.Model):
    """Modello Storico Estrazioni"""
    __tablename__ = 'draw_history'

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    player_name = db.Column(db.String(100), nullable=False)

    # Risultato estrazione (JSON)
    drawn_tokens = db.Column(db.Text, nullable=False)  # JSON array di token estratti
    successi = db.Column(db.Integer, default=0)
    complicazioni = db.Column(db.Integer, default=0)

    # Flags speciali
    adrenaline = db.Column(db.Boolean, default=False)
    confusion = db.Column(db.Boolean, default=False)
    risk_all = db.Column(db.Boolean, default=False)

    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<DrawHistory {self.player_name} - {self.timestamp}>'

    def to_dict(self):
        """Converti storico in dizionario"""
        return {
            'player': self.player_name,
            'drawn': json.loads(self.drawn_tokens),
            'successi': self.successi,
            'complicazioni': self.complicazioni,
            'timestamp': self.timestamp.isoformat(),
            'adrenaline': self.adrenaline,
            'confusion': self.confusion,
            'risk_all': self.risk_all
        }
