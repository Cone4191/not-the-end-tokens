from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
import random
import uuid
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'not-the-end-secret-key-change-in-production'
socketio = SocketIO(app, cors_allowed_origins="*")

# Dizionario per memorizzare le stanze attive
rooms = {}

# Dizionario per generare meteo
METEO_DATA = {
    'primavera': {
        'pianura': ['Soleggiato', 'Nuvoloso', 'Pioggia leggera', 'Ventoso', 'Foschia'],
        'collina': ['Soleggiato', 'Nuvoloso', 'Pioggia', 'Ventoso', 'Nebbia'],
        'montagna': ['Soleggiato', 'Nevicate sparse', 'Nuvoloso', 'Vento forte', 'Nebbia fitta'],
        'costa': ['Soleggiato', 'Nuvoloso', 'Pioggia', 'Ventoso', 'Foschia marina']
    },
    'estate': {
        'pianura': ['Soleggiato', 'Caldo torrido', 'Temporale', 'Afa', 'Sereno'],
        'collina': ['Soleggiato', 'Caldo', 'Temporale pomeridiano', 'Ventilato', 'Foschia di calore'],
        'montagna': ['Soleggiato', 'Temporale improvviso', 'Fresco', 'Vento', 'Nebbia mattutina'],
        'costa': ['Soleggiato', 'Brezza marina', 'Caldo umido', 'Temporale', 'Foschia']
    },
    'autunno': {
        'pianura': ['Nuvoloso', 'Pioggia', 'Nebbia', 'Ventoso', 'Sereno'],
        'collina': ['Nuvoloso', 'Pioggia persistente', 'Nebbia fitta', 'Vento forte', 'Variabile'],
        'montagna': ['Nuvoloso', 'Pioggia/neve', 'Nebbia', 'Vento gelido', 'Prime nevicate'],
        'costa': ['Nuvoloso', 'Pioggia', 'Vento forte', 'Mareggiata', 'Foschia']
    },
    'inverno': {
        'pianura': ['Nebbia', 'Gelido', 'Neve', 'Sereno e freddo', 'Gelo notturno'],
        'collina': ['Neve', 'Gelido', 'Nebbia', 'Vento gelido', 'Ghiaccio'],
        'montagna': ['Tormenta', 'Neve abbondante', 'Gelo estremo', 'Vento glaciale', 'Sereno e gelido'],
        'costa': ['Freddo pungente', 'Pioggia gelida', 'Vento freddo', 'Neve rara', 'Foschia gelida']
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


@socketio.on('draw_tokens')
def handle_draw_tokens(data):
    """Estrai token dal sacchetto"""
    room_id = data.get('room_id')
    num_tokens = int(data.get('num_tokens', 1))
    player_name = data.get('player_name', 'Giocatore')
    
    if room_id not in rooms:
        emit('error', {'message': 'Stanza non trovata'})
        return
    
    bag = rooms[room_id]['bag']
    total_tokens = bag['successi'] + bag['complicazioni']
    
    if total_tokens < num_tokens:
        emit('error', {'message': 'Non ci sono abbastanza token nel sacchetto'})
        return
    
    virtual_bag = ['successo'] * bag['successi'] + ['complicazione'] * bag['complicazioni']
    
    drawn = random.sample(virtual_bag, num_tokens)
    
    successi_drawn = drawn.count('successo')
    complicazioni_drawn = drawn.count('complicazione')
    
    rooms[room_id]['bag']['successi'] -= successi_drawn
    rooms[room_id]['bag']['complicazioni'] -= complicazioni_drawn
    
    history_entry = {
        'player': player_name,
        'timestamp': datetime.now().isoformat(),
        'drawn': drawn,
        'successi': successi_drawn,
        'complicazioni': complicazioni_drawn
    }
    rooms[room_id]['history'].append(history_entry)
    
    emit('tokens_drawn', {
        'player': player_name,
        'drawn': drawn,
        'successi': successi_drawn,
        'complicazioni': complicazioni_drawn,
        'bag_remaining': rooms[room_id]['bag'],
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


if __name__ == '__main__':
    print("🎲 Not The End Token Drawer")
    print("📍 Server in ascolto su: http://localhost:5000")
    print("🚀 Premi CTRL+C per fermare il server")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)