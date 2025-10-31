from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
import random
import uuid
from datetime import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'not-the-end-secret-key-change-in-production')
socketio = SocketIO(app, cors_allowed_origins="*")

# Dizionario per memorizzare le stanze attive
rooms = {}

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


@socketio.on('create_room')
def handle_create_room(data):
    """Crea una nuova stanza di gioco"""
    room_id = str(uuid.uuid4())[:8]
    player_name = data.get('player_name', 'Giocatore')
    
    rooms[room_id] = {
        'players': [player_name],
        'bag': {'successi': 0, 'complicazioni': 0},
        'history': [],
        'adrenaline': {},
        'confusion': {},
        'created_at': datetime.now().isoformat()
    }
    
    join_room(room_id)
    emit('room_created', {'room_id': room_id, 'player_name': player_name})


@socketio.on('join_room')
def handle_join_room(data):
    """Unisciti a una stanza esistente"""
    room_id = data.get('room_id')
    player_name = data.get('player_name', 'Giocatore')

    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return

    if len(rooms[room_id]['players']) >= 10:
        emit('error', {'message': 'Stanza piena (max 10 giocatori)'})
        return

    # Controlla se il giocatore è già nella stanza
    if player_name in rooms[room_id]['players']:
        emit('error', {'message': f'Nome "{player_name}" già in uso in questa stanza'})
        return

    join_room(room_id)
    rooms[room_id]['players'].append(player_name)
    
    emit('room_joined', {
        'room_id': room_id,
        'player_name': player_name,
        'room_data': rooms[room_id]
    })
    
    emit('player_joined', {
        'player_name': player_name,
        'players': rooms[room_id]['players']
    }, room=room_id)
    
    # Carica automaticamente la scheda del giocatore se esiste
    characters = rooms[room_id].get('characters', {})
    my_character = characters.get(player_name)
    
    emit('my_character_loaded', {
        'character': my_character
    })
    
    # Invia tutte le schede degli altri giocatori
    emit('characters_loaded', {
        'characters': characters
    })


@socketio.on('configure_bag')
def handle_configure_bag(data):
    """Configura il sacchetto di token"""
    room_id = data.get('room_id')
    successi = int(data.get('successi', 0))
    complicazioni = int(data.get('complicazioni', 0))
    
    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return
    
    rooms[room_id]['bag'] = {
        'successi': successi,
        'complicazioni': complicazioni
    }
    
    emit('bag_configured', {
        'successi': successi,
        'complicazioni': complicazioni
    }, room=room_id)

@socketio.on('add_help')
def handle_add_help(data):
    """Aggiungi aiuto (+1 token bianco)"""
    room_id = data.get('room_id')
    player_name = data.get('player_name', 'Giocatore')
    
    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return
    
    # Aggiungi 1 token bianco
    rooms[room_id]['bag']['successi'] += 1
    
    # Broadcast a tutti nella stanza
    emit('help_added', {
        'helper': player_name,
        'bag': rooms[room_id]['bag']
    }, room=room_id)

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

        if room_id not in rooms:
            emit('error', {'message': 'Stanza non trovata'})
            return
    except Exception as e:
        print(f"❌ Errore in draw_tokens (inizio): {e}")
        import traceback
        traceback.print_exc()
        emit('error', {'message': f'Errore: {str(e)}'})
        return
    
    try:
        bag = rooms[room_id]['bag']

        # Adrenalina forza 4 token
        if adrenaline:
            num_tokens = 4

        # Verifica che ci siano abbastanza token
        total_tokens = bag['successi'] + bag['complicazioni']
        if total_tokens < num_tokens:
            emit('error', {'message': 'Non ci sono abbastanza token nel sacchetto'})
            return

        # ========== GESTIONE CONFUSIONE ==========
        if confusion:
            # Con confusione: i token BIANCHI diventano random
            # I token NERI restano neri

            drawn = []
            temp_bag = {
                'successi': bag['successi'],
                'complicazioni': bag['complicazioni']
            }

            for _ in range(num_tokens):
                if temp_bag['successi'] + temp_bag['complicazioni'] == 0:
                    break

                # Estrai un token
                total = temp_bag['successi'] + temp_bag['complicazioni']
                rand = random.random()

                if rand < temp_bag['complicazioni'] / total:
                    # Estratto un NERO (resta nero)
                    drawn.append('complicazione')
                    temp_bag['complicazioni'] -= 1
                    bag['complicazioni'] -= 1
                else:
                    # Estratto un BIANCO (diventa RANDOM)
                    # 50% bianco, 50% nero
                    if random.random() < 0.5:
                        drawn.append('successo')
                    else:
                        drawn.append('complicazione')
                    temp_bag['successi'] -= 1
                    # Aggiorna sacchetto reale: togli sempre il token BIANCO estratto fisicamente
                    bag['successi'] -= 1

        else:
            # ========== ESTRAZIONE NORMALE ==========
            drawn = []
            for _ in range(num_tokens):
                if bag['successi'] + bag['complicazioni'] == 0:
                    break

                # Protezione: assicurati che almeno un peso sia > 0
                if bag['successi'] <= 0 and bag['complicazioni'] <= 0:
                    break

                token_type = random.choices(
                    ['successo', 'complicazione'],
                    weights=[max(0, bag['successi']), max(0, bag['complicazioni'])]
                )[0]

                drawn.append(token_type)
                bag[token_type] -= 1

        # Conta risultati
        successi = drawn.count('successo')
        complicazioni = drawn.count('complicazione')

        # Crea entry storico
        history_entry = {
            'player': player_name,
            'drawn': drawn,
            'successi': successi,
            'complicazioni': complicazioni,
            'timestamp': datetime.now().isoformat(),
            'adrenaline': adrenaline,
            'confusion': confusion
        }

        rooms[room_id]['history'].append(history_entry)

        # Invia risultato
        result = {
            'player': player_name,
            'drawn': drawn,
            'successi': successi,
            'complicazioni': complicazioni,
            'bag_remaining': bag,
            'history': history_entry,
            'adrenaline': adrenaline,
            'confusion': confusion
        }
        print(f"📤 Inviando tokens_drawn: {result}")
        emit('tokens_drawn', result, room=room_id)

    except Exception as e:
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

    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return

    bag = rooms[room_id]['bag']

    # Verifica che ci siano abbastanza token
    total_tokens = bag['successi'] + bag['complicazioni']
    if total_tokens < num_tokens:
        emit('error', {'message': 'Non ci sono abbastanza token nel sacchetto'})
        return

    # Estrazione normale (niente adrenalina/confusione per risk_all)
    drawn = []
    for _ in range(num_tokens):
        if bag['successi'] + bag['complicazioni'] == 0:
            break

        token_type = random.choices(
            ['successo', 'complicazione'],
            weights=[bag['successi'], bag['complicazioni']]
        )[0]

        drawn.append(token_type)
        bag[token_type] -= 1

    # Conta risultati NUOVI
    new_successi = drawn.count('successo')
    new_complicazioni = drawn.count('complicazione')
    
    # Calcola totali CUMULATIVI
    total_successi = previous_successi + new_successi
    total_complicazioni = previous_complicazioni + new_complicazioni
    
    # Crea entry storico
    history_entry = {
        'player': player_name,
        'drawn': drawn,
        'successi': new_successi,
        'complicazioni': new_complicazioni,
        'timestamp': datetime.now().isoformat(),
        'risk_all': True,
        'total_successi': total_successi,
        'total_complicazioni': total_complicazioni
    }
    
    rooms[room_id]['history'].append(history_entry)
    
    # Invia risultato con totali corretti
    emit('risk_all_result', {
        'player': player_name,
        'drawn': drawn,
        'successi': new_successi,
        'complicazioni': new_complicazioni,
        'total_successi': total_successi,
        'total_complicazioni': total_complicazioni,
        'bag_remaining': bag,
        'history': history_entry
    }, room=room_id)

@socketio.on('return_tokens')
def handle_return_tokens(data):
    """Rimetti i token nel sacchetto"""
    room_id = data.get('room_id')
    successi = int(data.get('successi', 0))
    complicazioni = int(data.get('complicazioni', 0))
    
    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return
    
    rooms[room_id]['bag']['successi'] += successi
    rooms[room_id]['bag']['complicazioni'] += complicazioni
    
    emit('tokens_returned', {
        'bag': rooms[room_id]['bag']
    }, room=room_id)


@socketio.on('update_adrenaline')
def handle_update_adrenaline(data):
    """Aggiorna adrenalina di un giocatore"""
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    adrenaline = int(data.get('adrenaline', 0))
    
    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return
    
    rooms[room_id]['adrenaline'][player_name] = adrenaline
    
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
    
    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return
    
    rooms[room_id]['confusion'][player_name] = confusion
    
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
    
    if room_id and room_id in rooms:
        emit('weather_generated', result, room=room_id)
    else:
        emit('weather_generated', result)


@socketio.on('reset_bag')
def handle_reset_bag(data):
    """Resetta il sacchetto"""
    room_id = data.get('room_id')
    
    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return
    
    rooms[room_id]['bag'] = {'successi': 0, 'complicazioni': 0}
    
    emit('bag_reset', {}, room=room_id)

@socketio.on('save_character')
def handle_save_character(data):
    """Salva la scheda del personaggio"""
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    character = data.get('character')
    
    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return
    
    # Inizializza dizionario characters se non esiste
    if 'characters' not in rooms[room_id]:
        rooms[room_id]['characters'] = {}
    
    # Salva la scheda del giocatore
    rooms[room_id]['characters'][player_name] = character
    
    # Notifica tutti nella stanza
    emit('character_saved', {
        'player_name': player_name,
        'character': character
    }, room=room_id)


@socketio.on('get_characters')
def handle_get_characters(data):
    """Recupera tutte le schede della stanza"""
    room_id = data.get('room_id')
    
    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return
    
    characters = rooms[room_id].get('characters', {})
    
    emit('characters_loaded', {
        'characters': characters
    })


@socketio.on('load_my_character')
def handle_load_my_character(data):
    """Carica la scheda del giocatore corrente"""
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    
    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return
    
    characters = rooms[room_id].get('characters', {})
    character = characters.get(player_name)
    
    if character:
        emit('my_character_loaded', {
            'character': character
        })
    else:
        emit('my_character_loaded', {
            'character': None
        })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, debug=True, host='0.0.0.0', port=port)

