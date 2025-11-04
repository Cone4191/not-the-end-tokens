from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from sqlalchemy.pool import NullPool
import random
import uuid
from datetime import datetime
import os
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'not-the-end-secret-key-change-in-production')

# Database configuration - PostgreSQL in produzione, SQLite in locale
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    # Render fornisce DATABASE_URL con postgres://, ma SQLAlchemy richiede postgresql://
    if DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
    print(f"🗄️  Using PostgreSQL database")
    # Configurazione pool per eventlet - usa NullPool per evitare conflitti con greenlets
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'poolclass': NullPool  # NullPool crea una nuova connessione per ogni richiesta, evita problemi con eventlet
    }
else:
    # Fallback a SQLite per sviluppo locale
    # Usa check_same_thread=False per permettere l'uso multi-threaded con eventlet
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///not_the_end.db?check_same_thread=False'
    print(f"⚠️  DATABASE_URL not found - using SQLite (development only)")
    # Configurazione pool per SQLite
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

socketio = SocketIO(app, cors_allowed_origins="*")

# Inizializza database
from models import db, User, Room, RoomPlayer, Character, DrawHistory, Session
from auth import create_user, login_user, verify_session, logout_user

db.init_app(app)

# Crea tabelle se non esistono e aggiorna schema
with app.app_context():
    db.create_all()

    # Migrazione: aggiungi colonne mancanti per PostgreSQL
    try:
        with db.engine.connect() as conn:
            # Verifica e aggiungi is_master a room_players
            result = conn.execute(db.text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name='room_players' AND column_name='is_master'
            """))
            if not result.fetchone():
                print("🔄 Aggiunta colonna is_master a room_players...")
                conn.execute(db.text("ALTER TABLE room_players ADD COLUMN is_master BOOLEAN DEFAULT FALSE"))
                conn.execute(db.text("""
                    UPDATE room_players
                    SET is_master = TRUE
                    WHERE id IN (
                        SELECT MIN(id) FROM room_players GROUP BY room_id
                    )
                """))
                conn.commit()
                print("✅ Colonna is_master aggiunta")

            # Verifica e aggiungi visible_to_all a characters
            result = conn.execute(db.text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name='characters' AND column_name='visible_to_all'
            """))
            if not result.fetchone():
                print("🔄 Aggiunta colonna visible_to_all a characters...")
                conn.execute(db.text("ALTER TABLE characters ADD COLUMN visible_to_all BOOLEAN DEFAULT FALSE"))
                conn.commit()
                print("✅ Colonna visible_to_all aggiunta")
    except Exception as e:
        print(f"⚠️  Errore durante la migrazione dello schema: {str(e)}")
        # Non bloccare l'avvio dell'app se la migrazione fallisce

# Cache temporanea per le stanze attive (sacchetto in memoria)
active_rooms_cache = {}  # room_id: {'bag': {...}, 'adrenaline': {}, 'confusion': {}}

# Dizionario per generare meteo
METEO_DATA = {
    'primavera': {
        'pianura': ['Soleggiato', 'Nuvoloso', 'Pioggia leggera', 'Ventoso', 'Foschia'],
        'collina': ['Soleggiato', 'Nuvoloso', 'Pioggia', 'Ventoso', 'Nebbia'],
        'montagna': ['Soleggiato', 'Nevicate sparse', 'Nuvoloso', 'Vento forte', 'Nebbia fitta'],
        'costa': ['Soleggiato', 'Nuvoloso', 'Pioggia', 'Ventoso', 'Foschia marina'],
        'deserto': ['Soleggiato', 'Caldo secco', 'Vento sabbioso', 'Sereno', 'Tempesta di sabbia'],
        'foresta': ['Umido', 'Pioggia leggera', 'Nebbia', 'Soleggiato tra gli alberi', 'Ventilato'],
        'mare': ['Brezza marina', 'Soleggiato', 'Onde moderate', 'Nuvoloso', 'Ventoso']
    },
    'estate': {
        'pianura': ['Soleggiato', 'Caldo torrido', 'Temporale', 'Afa', 'Sereno'],
        'collina': ['Soleggiato', 'Caldo', 'Temporale pomeridiano', 'Ventilato', 'Foschia di calore'],
        'montagna': ['Soleggiato', 'Temporale improvviso', 'Fresco', 'Vento', 'Nebbia mattutina'],
        'costa': ['Soleggiato', 'Brezza marina', 'Caldo umido', 'Temporale', 'Foschia'],
        'deserto': ['Caldo torrido', 'Sole cocente', 'Vento caldo', 'Siccità', 'Miraggio'],
        'foresta': ['Ombreggiato', 'Umidità', 'Temporale', 'Caldo afoso', 'Soleggiato'],
        'mare': ['Mare calmo', 'Sole e brezza', 'Caldo umido', 'Temporale marino', 'Ventilato']
    },
    'autunno': {
        'pianura': ['Nuvoloso', 'Pioggia', 'Nebbia', 'Ventoso', 'Sereno'],
        'collina': ['Nuvoloso', 'Pioggia persistente', 'Nebbia fitta', 'Vento forte', 'Variabile'],
        'montagna': ['Nuvoloso', 'Pioggia/neve', 'Nebbia', 'Vento gelido', 'Prime nevicate'],
        'costa': ['Nuvoloso', 'Pioggia', 'Vento forte', 'Mareggiata', 'Foschia'],
        'deserto': ['Caldo', 'Ventoso', 'Sereno', 'Tempesta di sabbia', 'Caldo secco'],
        'foresta': ['Nebbia fitta', 'Pioggia', 'Ventoso', 'Umido', 'Freddo umido'],
        'mare': ['Mare mosso', 'Vento forte', 'Pioggia', 'Mareggiata', 'Nuvoloso']
    },
    'inverno': {
        'pianura': ['Nebbia', 'Gelido', 'Neve', 'Sereno e freddo', 'Gelo notturno'],
        'collina': ['Neve', 'Gelido', 'Nebbia', 'Vento gelido', 'Ghiaccio'],
        'montagna': ['Tormenta', 'Neve abbondante', 'Gelo estremo', 'Vento glaciale', 'Sereno e gelido'],
        'costa': ['Freddo pungente', 'Pioggia gelida', 'Vento freddo', 'Neve rara', 'Foschia gelida'],
        'deserto': ['Freddo secco', 'Soleggiato', 'Freddo notturno', 'Ventoso', 'Gelido'],
        'foresta': ['Neve tra gli alberi', 'Gelo', 'Nebbia gelida', 'Freddo umido', 'Ghiaccio'],
        'mare': ['Mare agitato', 'Vento gelido', 'Pioggia gelida', 'Mareggiate', 'Nebbia marina']
    }
}


@app.route('/')
def index():
    """Pagina principale"""
    return render_template('index.html')


@socketio.on('register')
def handle_register(data):
    """Registrazione nuovo utente"""
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        emit('error', {'message': 'Username e password sono obbligatori'})
        return

    if len(password) < 6:
        emit('error', {'message': 'La password deve essere almeno 6 caratteri'})
        return

    user, error = create_user(username, password)

    if error:
        emit('error', {'message': error})
        return

    emit('register_success', {'message': 'Registrazione completata! Effettua il login.'})


@socketio.on('refresh_rooms')
def handle_refresh_rooms(data):
    """Ricarica le stanze dell'utente usando la sessione esistente"""
    session_id = data.get('session_id')

    if not session_id:
        emit('error', {'message': 'Sessione non valida'})
        return

    user, error = verify_session(session_id)

    if error:
        emit('error', {'message': error})
        return

    # Trova stanze di cui è proprietario
    owned_rooms = Room.query.filter_by(owner_id=user.id, is_active=True).all()

    # Trova stanze condivise (in cui è giocatore ma non proprietario)
    shared_room_ids = db.session.query(RoomPlayer.room_id).filter_by(user_id=user.id).distinct().all()
    shared_rooms = []
    for (room_id,) in shared_room_ids:
        room = Room.query.get(room_id)
        if room and room.is_active and room.owner_id != user.id:
            shared_rooms.append(room)

    # Prepara dettagli stanze
    owned_rooms_details = []
    for room in owned_rooms:
        my_player = room.players.filter_by(user_id=user.id).first()
        owned_rooms_details.append({
            'id': room.room_id,
            'players': [p.player_name for p in room.players.all()],
            'created_at': room.created_at.isoformat(),
            'my_player_name': my_player.player_name if my_player else None
        })

    shared_rooms_details = []
    for room in shared_rooms:
        my_player = room.players.filter_by(user_id=user.id).first()
        shared_rooms_details.append({
            'id': room.room_id,
            'players': [p.player_name for p in room.players.all()],
            'created_at': room.created_at.isoformat(),
            'my_player_name': my_player.player_name if my_player else None
        })

    emit('rooms_refreshed', {
        'owned_rooms': owned_rooms_details,
        'shared_rooms': shared_rooms_details
    })


@socketio.on('login')
def handle_login(data):
    """Login utente con password"""
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        emit('error', {'message': 'Username e password sono obbligatori'})
        return

    user, session_id, error = login_user(username, password)

    if error:
        emit('error', {'message': error})
        return

    # Ottieni le stanze dell'utente
    owned_rooms = Room.query.filter_by(owner_id=user.id, is_active=True).all()

    # Stanze condivise (dove l'utente è un giocatore ma non owner)
    shared_room_ids = db.session.query(RoomPlayer.room_id).filter_by(user_id=user.id).distinct().all()
    shared_rooms = []
    for (room_id,) in shared_room_ids:
        room = Room.query.get(room_id)
        if room and room.is_active and room.owner_id != user.id:
            shared_rooms.append(room)

    # Prepara dettagli stanze
    owned_rooms_details = []
    for room in owned_rooms:
        # Trova il nome del giocatore in questa stanza
        my_player = room.players.filter_by(user_id=user.id).first()
        owned_rooms_details.append({
            'id': room.room_id,
            'players': [p.player_name for p in room.players.all()],
            'created_at': room.created_at.isoformat(),
            'my_player_name': my_player.player_name if my_player else None
        })

    shared_rooms_details = []
    for room in shared_rooms:
        # Trova il nome del giocatore in questa stanza
        my_player = room.players.filter_by(user_id=user.id).first()
        shared_rooms_details.append({
            'id': room.room_id,
            'players': [p.player_name for p in room.players.all()],
            'created_at': room.created_at.isoformat(),
            'my_player_name': my_player.player_name if my_player else None
        })

    emit('login_success', {
        'username': username,
        'user_id': user.id,
        'session_id': session_id,
        'owned_rooms': owned_rooms_details,
        'shared_rooms': shared_rooms_details
    })


@socketio.on('create_room')
def handle_create_room(data):
    """Crea una nuova stanza di gioco"""
    player_name = data.get('player_name', 'Giocatore')
    user_id = data.get('user_id')  # ID utente del creatore

    if not user_id:
        emit('error', {'message': 'Utente non autenticato'})
        return

    # Verifica che l'utente esista
    user = User.query.get(user_id)
    if not user:
        emit('error', {'message': 'Utente non trovato'})
        return

    # Genera ID stanza univoco
    room_id_str = str(uuid.uuid4())[:8]

    # Crea stanza nel database
    new_room = Room(
        room_id=room_id_str,
        owner_id=user_id,
        bag_successi=0,
        bag_complicazioni=0
    )

    # Aggiungi il creatore come primo giocatore e master
    room_player = RoomPlayer(
        player_name=player_name,
        user_id=user_id,
        is_master=True  # Il creatore è sempre il master
    )
    new_room.players.append(room_player)

    try:
        db.session.add(new_room)
        db.session.commit()

        # Inizializza cache per la stanza
        active_rooms_cache[room_id_str] = {
            'adrenaline': {},
            'confusion': {}
        }

        join_room(room_id_str)
        emit('room_created', {'room_id': room_id_str, 'player_name': player_name})

    except Exception as e:
        db.session.rollback()
        emit('error', {'message': f'Errore nella creazione della stanza: {str(e)}'})


@socketio.on('join_room')
def handle_join_room(data):
    """Unisciti a una stanza esistente"""
    room_id_str = data.get('room_id')
    player_name = data.get('player_name', 'Giocatore')
    user_id = data.get('user_id')  # ID utente

    # Trova la stanza nel database
    room = Room.query.filter_by(room_id=room_id_str, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    # Verifica limite giocatori
    if room.players.count() >= 10:
        emit('error', {'message': 'Stanza piena (max 10 giocatori)'})
        return

    # Controlla se il giocatore è già nella stanza
    existing_player = room.players.filter_by(player_name=player_name).first()

    # Se il nome esiste ma è lo stesso utente, è un re-join (non fare nulla, continua)
    if existing_player and existing_player.user_id != user_id:
        emit('error', {'message': f'Nome "{player_name}" già in uso in questa stanza'})
        return

    # Se il giocatore non è ancora nella stanza, aggiungilo
    if not existing_player:
        room_player = RoomPlayer(
            room_id=room.id,
            user_id=user_id,
            player_name=player_name
        )
        db.session.add(room_player)

    try:
        # Commit solo se abbiamo aggiunto un nuovo giocatore
        if not existing_player:
            db.session.commit()

        # Inizializza cache se non esiste
        if room_id_str not in active_rooms_cache:
            active_rooms_cache[room_id_str] = {
                'adrenaline': {},
                'confusion': {}
            }

        join_room(room_id_str)

        # Prepara dati stanza
        players_list = [p.player_name for p in room.players.all()]
        room_data = {
            'room_id': room_id_str,
            'players': players_list,
            'bag': {
                'successi': room.bag_successi,
                'complicazioni': room.bag_complicazioni
            },
            'history': [h.to_dict() for h in room.history.order_by(DrawHistory.timestamp.desc()).limit(20).all()]
        }

        emit('room_joined', {
            'room_id': room_id_str,
            'player_name': player_name,
            'room_data': room_data
        })

        emit('player_joined', {
            'player_name': player_name,
            'players': players_list
        }, room=room_id_str)

        # Carica scheda personaggio se esiste
        my_character = None
        if user_id:
            character = Character.query.filter_by(room_id=room.id, user_id=user_id).first()
            if character:
                my_character = character.to_dict()

        emit('my_character_loaded', {
            'character': my_character
        })

        # Invia tutte le schede degli altri giocatori
        characters_dict = {}
        for char in room.characters.all():
            characters_dict[char.player_name] = char.to_dict()

        emit('characters_loaded', {
            'characters': characters_dict
        })

    except Exception as e:
        db.session.rollback()
        emit('error', {'message': f'Errore nell\'unirsi alla stanza: {str(e)}'})


@socketio.on('configure_bag')
def handle_configure_bag(data):
    """Configura il sacchetto di token"""
    room_id = data.get('room_id')
    successi = int(data.get('successi', 0))
    complicazioni = int(data.get('complicazioni', 0))

    # Trova la stanza nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    # Aggiorna sacchetto nel database
    room.bag_successi = successi
    room.bag_complicazioni = complicazioni

    try:
        db.session.commit()

        emit('bag_configured', {
            'successi': successi,
            'complicazioni': complicazioni
        }, room=room_id)
    except Exception as e:
        db.session.rollback()
        emit('error', {'message': f'Errore nella configurazione del sacchetto: {str(e)}'})

@socketio.on('add_help')
def handle_add_help(data):
    """Aggiungi aiuto (+1 token bianco)"""
    room_id = data.get('room_id')
    player_name = data.get('player_name', 'Giocatore')

    # Trova la stanza nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    # Aggiungi 1 token bianco
    room.bag_successi += 1

    try:
        db.session.commit()

        # Broadcast a tutti nella stanza
        emit('help_added', {
            'helper': player_name,
            'bag': {
                'successi': room.bag_successi,
                'complicazioni': room.bag_complicazioni
            }
        }, room=room_id)
    except Exception as e:
        db.session.rollback()
        emit('error', {'message': f'Errore nell\'aggiungere aiuto: {str(e)}'})

@socketio.on('draw_tokens')
def handle_draw_tokens(data):
    """Estrai token dal sacchetto con supporto adrenalina e confusione"""
    try:
        room_id = data.get('room_id')
        num_tokens = data.get('num_tokens', 1)
        player_name = data.get('player_name', 'Giocatore')
        adrenaline = data.get('adrenaline', False)
        confusion = data.get('confusion', False)

        print(f"🎲 draw_tokens ricevuto: room={room_id}, tokens={num_tokens}, player={player_name}, adrenaline={adrenaline}, confusion={confusion}")

        # Trova la stanza nel database
        room = Room.query.filter_by(room_id=room_id, is_active=True).first()

        if not room:
            emit('error', {'message': 'Stanza non trovata'})
            return
    except Exception as e:
        print(f"❌ Errore in draw_tokens (inizio): {e}")
        import traceback
        traceback.print_exc()
        emit('error', {'message': f'Errore: {str(e)}'})
        return

    try:
        # Usa i valori del database
        bag_successi = room.bag_successi
        bag_complicazioni = room.bag_complicazioni

        # Adrenalina forza 4 token
        if adrenaline:
            num_tokens = 4

        # Verifica che ci siano abbastanza token
        total_tokens = bag_successi + bag_complicazioni
        if total_tokens < num_tokens:
            emit('error', {'message': 'Non ci sono abbastanza token nel sacchetto'})
            return

        # ========== GESTIONE CONFUSIONE ==========
        if confusion:
            # Con confusione: i token BIANCHI diventano random
            # I token NERI restano neri

            drawn = []
            temp_successi = bag_successi
            temp_complicazioni = bag_complicazioni

            for _ in range(num_tokens):
                if temp_successi + temp_complicazioni == 0:
                    break

                # Estrai un token
                total = temp_successi + temp_complicazioni
                rand = random.random()

                if rand < temp_complicazioni / total:
                    # Estratto un NERO (resta nero)
                    drawn.append('complicazione')
                    temp_complicazioni -= 1
                    bag_complicazioni -= 1
                else:
                    # Estratto un BIANCO (diventa RANDOM)
                    # 50% bianco, 50% nero
                    if random.random() < 0.5:
                        drawn.append('successo')
                    else:
                        drawn.append('complicazione')
                    temp_successi -= 1
                    # Aggiorna sacchetto reale: togli sempre il token BIANCO estratto fisicamente
                    bag_successi -= 1

        else:
            # ========== ESTRAZIONE NORMALE ==========
            drawn = []
            for _ in range(num_tokens):
                if bag_successi + bag_complicazioni == 0:
                    break

                # Protezione: assicurati che almeno un peso sia > 0
                if bag_successi <= 0 and bag_complicazioni <= 0:
                    break

                # Estrai usando random.choices
                token_key = random.choices(
                    ['successi', 'complicazioni'],
                    weights=[max(0, bag_successi), max(0, bag_complicazioni)]
                )[0]

                # Aggiungi al risultato usando la forma SINGOLARE
                token_name = 'successo' if token_key == 'successi' else 'complicazione'
                drawn.append(token_name)

                # Decrementa
                if token_key == 'successi':
                    bag_successi -= 1
                else:
                    bag_complicazioni -= 1

        # Conta risultati
        successi = drawn.count('successo')
        complicazioni = drawn.count('complicazione')

        # Aggiorna il sacchetto nel database
        room.bag_successi = bag_successi
        room.bag_complicazioni = bag_complicazioni

        # Crea entry storico nel database
        history_entry = DrawHistory(
            room_id=room.id,
            player_name=player_name,
            drawn_tokens=json.dumps(drawn),
            successi=successi,
            complicazioni=complicazioni,
            has_adrenaline=adrenaline,
            has_confusion=confusion
        )

        db.session.add(history_entry)
        db.session.commit()

        # Invia risultato
        result = {
            'player': player_name,
            'drawn': drawn,
            'successi': successi,
            'complicazioni': complicazioni,
            'bag_remaining': {
                'successi': bag_successi,
                'complicazioni': bag_complicazioni
            },
            'history': {
                'player': player_name,
                'drawn': drawn,
                'successi': successi,
                'complicazioni': complicazioni,
                'timestamp': history_entry.timestamp.isoformat(),
                'adrenaline': adrenaline,
                'confusion': confusion
            },
            'adrenaline': adrenaline,
            'confusion': confusion
        }
        print(f"📤 Inviando tokens_drawn: {result}")
        emit('tokens_drawn', result, room=room_id)

    except Exception as e:
        db.session.rollback()
        print(f"❌ Errore in draw_tokens: {e}")
        import traceback
        traceback.print_exc()
        emit('error', {'message': f'Errore durante estrazione: {str(e)}'})

@socketio.on('risk_all')
def handle_risk_all(data):
    """Rischia tutto - estrai fino a 5 token totali"""
    room_id = data.get('room_id')
    num_tokens = data.get('num_tokens', 1)
    player_name = data.get('player_name', 'Giocatore')
    previous_successi = data.get('previous_successi', 0)
    previous_complicazioni = data.get('previous_complicazioni', 0)

    # Trova la stanza nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    bag_successi = room.bag_successi
    bag_complicazioni = room.bag_complicazioni

    # Verifica che ci siano abbastanza token
    total_tokens = bag_successi + bag_complicazioni
    if total_tokens < num_tokens:
        emit('error', {'message': 'Non ci sono abbastanza token nel sacchetto'})
        return

    # Estrazione normale (niente adrenalina/confusione per risk_all)
    drawn = []
    for _ in range(num_tokens):
        if bag_successi + bag_complicazioni == 0:
            break

        # Estrai usando random.choices
        token_key = random.choices(
            ['successi', 'complicazioni'],
            weights=[max(0, bag_successi), max(0, bag_complicazioni)]
        )[0]

        # Aggiungi al risultato usando la forma SINGOLARE
        token_name = 'successo' if token_key == 'successi' else 'complicazione'
        drawn.append(token_name)

        # Decrementa
        if token_key == 'successi':
            bag_successi -= 1
        else:
            bag_complicazioni -= 1

    # Conta risultati NUOVI
    new_successi = drawn.count('successo')
    new_complicazioni = drawn.count('complicazione')

    # Calcola totali CUMULATIVI
    total_successi = previous_successi + new_successi
    total_complicazioni = previous_complicazioni + new_complicazioni

    # Aggiorna il sacchetto nel database
    room.bag_successi = bag_successi
    room.bag_complicazioni = bag_complicazioni

    # Crea entry storico nel database
    history_entry = DrawHistory(
        room_id=room.id,
        player_name=player_name,
        drawn_tokens=json.dumps(drawn),
        successi=new_successi,
        complicazioni=new_complicazioni,
        is_risk_all=True
    )

    try:
        db.session.add(history_entry)
        db.session.commit()

        # Invia risultato con totali corretti
        emit('risk_all_result', {
            'player': player_name,
            'drawn': drawn,
            'successi': new_successi,
            'complicazioni': new_complicazioni,
            'total_successi': total_successi,
            'total_complicazioni': total_complicazioni,
            'bag_remaining': {
                'successi': bag_successi,
                'complicazioni': bag_complicazioni
            },
            'history': {
                'player': player_name,
                'drawn': drawn,
                'successi': new_successi,
                'complicazioni': new_complicazioni,
                'timestamp': history_entry.timestamp.isoformat(),
                'risk_all': True,
                'total_successi': total_successi,
                'total_complicazioni': total_complicazioni
            }
        }, room=room_id)
    except Exception as e:
        db.session.rollback()
        emit('error', {'message': f'Errore durante rischia tutto: {str(e)}'})

@socketio.on('return_tokens')
def handle_return_tokens(data):
    """Rimetti i token nel sacchetto"""
    room_id = data.get('room_id')
    successi = int(data.get('successi', 0))
    complicazioni = int(data.get('complicazioni', 0))

    # Trova la stanza nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    room.bag_successi += successi
    room.bag_complicazioni += complicazioni

    try:
        db.session.commit()

        emit('tokens_returned', {
            'bag': {
                'successi': room.bag_successi,
                'complicazioni': room.bag_complicazioni
            }
        }, room=room_id)
    except Exception as e:
        db.session.rollback()
        emit('error', {'message': f'Errore nel rimettere i token: {str(e)}'})


@socketio.on('update_adrenaline')
def handle_update_adrenaline(data):
    """Aggiorna adrenalina di un giocatore"""
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    adrenaline = int(data.get('adrenaline', 0))

    # Verifica che la stanza esista nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    # Usa cache per stati temporanei
    if room_id not in active_rooms_cache:
        active_rooms_cache[room_id] = {'adrenaline': {}, 'confusion': {}}

    active_rooms_cache[room_id]['adrenaline'][player_name] = adrenaline

    emit('adrenaline_updated', {
        'player': player_name,
        'adrenaline': adrenaline
    }, room=room_id)


@socketio.on('update_confusion')
def handle_update_confusion(data):
    """Aggiorna confusione di un giocatore"""
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    confusion = int(data.get('confusion', 0))

    # Verifica che la stanza esista nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    # Usa cache per stati temporanei
    if room_id not in active_rooms_cache:
        active_rooms_cache[room_id] = {'adrenaline': {}, 'confusion': {}}

    active_rooms_cache[room_id]['confusion'][player_name] = confusion

    emit('confusion_updated', {
        'player': player_name,
        'confusion': confusion
    }, room=room_id)


@socketio.on('generate_weather')
def handle_generate_weather(data):
    """Genera meteo casuale"""
    stagione = data.get('stagione', 'primavera').lower()
    zona = data.get('zona', 'pianura').lower()
    player_name = data.get('player_name', 'Giocatore')
    room_id = data.get('room_id')

    if stagione not in METEO_DATA or zona not in METEO_DATA[stagione]:
        emit('error', {'message': 'Stagione o zona non valida'})
        return

    meteo = random.choice(METEO_DATA[stagione][zona])

    result = {
        'stagione': stagione.capitalize(),
        'zona': zona.capitalize(),
        'meteo': meteo,
        'player': player_name
    }

    if room_id:
        # Verifica che la stanza esista nel database
        room = Room.query.filter_by(room_id=room_id, is_active=True).first()
        if room:
            emit('weather_generated', result, room=room_id)
        else:
            emit('weather_generated', result)
    else:
        emit('weather_generated', result)


@socketio.on('reset_bag')
def handle_reset_bag(data):
    """Resetta il sacchetto"""
    room_id = data.get('room_id')

    # Trova la stanza nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    room.bag_successi = 0
    room.bag_complicazioni = 0

    try:
        db.session.commit()
        emit('bag_reset', {}, room=room_id)
    except Exception as e:
        db.session.rollback()
        emit('error', {'message': f'Errore nel resettare il sacchetto: {str(e)}'})

@socketio.on('save_character')
def handle_save_character(data):
    """Salva la scheda del personaggio"""
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    character = data.get('character')

    # Trova la stanza nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    # Trova il giocatore nella stanza
    room_player = room.players.filter_by(player_name=player_name).first()

    if not room_player:
        emit('error', {'message': 'Giocatore non trovato nella stanza'})
        return

    # Cerca se esiste già una scheda per questo giocatore
    existing_character = Character.query.filter_by(
        room_id=room.id,
        user_id=room_player.user_id
    ).first()

    try:
        if existing_character:
            # Aggiorna scheda esistente
            existing_character.player_name = player_name
            existing_character.name = character.get('name', '')
            existing_character.motivation = character.get('motivation', '')
            existing_character.archetype = character.get('archetype', '')
            existing_character.photo = character.get('photo', '')
            existing_character.traits = json.dumps(character.get('traits', []))
            existing_character.selected_traits = json.dumps(character.get('selected_traits', []))
            existing_character.empowered_traits = json.dumps(character.get('empowered_traits', []))
            existing_character.quality_counter = character.get('quality_counter', 0)
            existing_character.ability_counter = character.get('ability_counter', 0)
            existing_character.misfortunes = json.dumps(character.get('misfortunes', []))
            existing_character.lessons = json.dumps(character.get('lessons', []))
            existing_character.resources = character.get('resources', '')
            existing_character.notes = character.get('notes', '')
        else:
            # Crea nuova scheda
            new_character = Character(
                room_id=room.id,
                user_id=room_player.user_id,
                player_name=player_name,
                name=character.get('name', ''),
                motivation=character.get('motivation', ''),
                archetype=character.get('archetype', ''),
                photo=character.get('photo', ''),
                traits=json.dumps(character.get('traits', [])),
                selected_traits=json.dumps(character.get('selected_traits', [])),
                empowered_traits=json.dumps(character.get('empowered_traits', [])),
                quality_counter=character.get('quality_counter', 0),
                ability_counter=character.get('ability_counter', 0),
                misfortunes=json.dumps(character.get('misfortunes', [])),
                lessons=json.dumps(character.get('lessons', [])),
                resources=character.get('resources', ''),
                notes=character.get('notes', '')
            )
            db.session.add(new_character)

        db.session.commit()

        # Notifica tutti nella stanza
        emit('character_saved', {
            'player_name': player_name,
            'character': character
        }, room=room_id)

    except Exception as e:
        db.session.rollback()
        emit('error', {'message': f'Errore nel salvare la scheda: {str(e)}'})


@socketio.on('get_characters')
def handle_get_characters(data):
    """Recupera tutte le schede della stanza"""
    room_id = data.get('room_id')
    user_id = data.get('user_id')

    # Trova la stanza nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    # Verifica se l'utente è il master
    room_player = room.players.filter_by(user_id=user_id).first()
    is_master = room_player.is_master if room_player else False

    # Recupera tutte le schede della stanza
    characters_dict = {}
    for character in room.characters.all():
        # Se sei il master o il proprietario della scheda, vedi tutto
        # Altrimenti vedi solo le schede con visible_to_all=True
        if is_master or character.user_id == user_id or character.visible_to_all:
            characters_dict[character.player_name] = character.to_dict()

    emit('characters_loaded', {
        'characters': characters_dict,
        'is_master': is_master
    })


@socketio.on('get_all_characters_for_master')
def handle_get_all_characters_for_master(data):
    """Recupera tutte le schede per il master (incluse quelle non visibili)"""
    room_id = data.get('room_id')
    user_id = data.get('user_id')

    # Trova la stanza nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    # Verifica che l'utente sia il master
    room_player = room.players.filter_by(user_id=user_id).first()

    if not room_player or not room_player.is_master:
        emit('error', {'message': 'Solo il master può vedere tutte le schede'})
        return

    # Recupera tutte le schede della stanza con informazioni di visibilità
    characters_list = []
    for character in room.characters.all():
        char_dict = character.to_dict()
        characters_list.append(char_dict)

    emit('all_characters_loaded', {
        'characters': characters_list
    })


@socketio.on('toggle_character_visibility')
def handle_toggle_character_visibility(data):
    """Toggle visibilità di una scheda (solo master)"""
    room_id = data.get('room_id')
    user_id = data.get('user_id')
    character_ids = data.get('character_ids', [])  # Lista di ID delle schede da rendere visibili

    # Trova la stanza nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    # Verifica che l'utente sia il master
    room_player = room.players.filter_by(user_id=user_id).first()

    if not room_player or not room_player.is_master:
        emit('error', {'message': 'Solo il master può modificare la visibilità'})
        return

    try:
        # Prima imposta tutte le schede come non visibili
        for character in room.characters.all():
            character.visible_to_all = False

        # Poi rendi visibili solo quelle selezionate
        for char_id in character_ids:
            character = Character.query.filter_by(id=char_id, room_id=room.id).first()
            if character:
                character.visible_to_all = True

        db.session.commit()

        # Notifica tutti nella stanza che la visibilità è cambiata
        emit('visibility_updated', {
            'message': 'Visibilità schede aggiornata'
        }, room=room_id)

    except Exception as e:
        db.session.rollback()
        emit('error', {'message': f'Errore nell\'aggiornare la visibilità: {str(e)}'})


@socketio.on('load_my_character')
def handle_load_my_character(data):
    """Carica la scheda del giocatore corrente"""
    room_id = data.get('room_id')
    player_name = data.get('player_name')

    # Trova la stanza nel database
    room = Room.query.filter_by(room_id=room_id, is_active=True).first()

    if not room:
        emit('error', {'message': 'Stanza non trovata'})
        return

    # Cerca la scheda del giocatore
    character = room.characters.filter_by(player_name=player_name).first()

    if character:
        emit('my_character_loaded', {
            'character': character.to_dict()
        })
    else:
        emit('my_character_loaded', {
            'character': None
        })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, debug=True, host='0.0.0.0', port=port)

