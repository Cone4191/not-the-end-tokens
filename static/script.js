// Inizializzazione SocketIO
const socket = io();

// Variabili globali
let currentRoomId = null;
let currentPlayerName = null;

// Stato adrenalina e confusione
let adrenalineActive = false;
let confusionActive = false;

// Elementi DOM
const connectionSection = document.getElementById('connectionSection');
const gameSection = document.getElementById('gameSection');
const playerNameInput = document.getElementById('playerName');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const currentRoomIdSpan = document.getElementById('currentRoomId');
const playersListSpan = document.getElementById('playersList');

// Elementi sacchetto
const successTokensInput = document.getElementById('successTokens');
const complicationTokensInput = document.getElementById('complicationTokens');
const configureBagBtn = document.getElementById('configureBagBtn');
const bagSuccessi = document.getElementById('bagSuccessi');
const bagComplicazioni = document.getElementById('bagComplicazioni');

// Elementi estrazione
const drawButtons = document.querySelectorAll('.btn-draw');
const drawResult = document.getElementById('drawResult');

// Toggle Adrenalina e Confusione
const adrenalineToggle = document.getElementById('adrenalineToggle');
const confusionToggle = document.getElementById('confusionToggle');
const statusMessage = document.getElementById('statusMessage');

// Elementi meteo
const seasonSelect = document.getElementById('seasonSelect');
const zoneSelect = document.getElementById('zoneSelect');
const generateWeatherBtn = document.getElementById('generateWeatherBtn');
const weatherResult = document.getElementById('weatherResult');

// Elementi storico
const historyLog = document.getElementById('historyLog');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Elementi utilità
const resetBagBtn = document.getElementById('resetBagBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const actionLog = document.getElementById('actionLog');

// === Event Listeners ===

// Toggle Adrenalina
adrenalineToggle.addEventListener('change', (e) => {
    adrenalineActive = e.target.checked;
    updateDrawButtons();
    updateStatusMessage();
    
    if (adrenalineActive) {
        showLog('⚡ Adrenalina attiva: dovrai estrarre 4 token!', 'success');
    }
});

// Toggle Confusione
confusionToggle.addEventListener('change', (e) => {
    confusionActive = e.target.checked;
    updateStatusMessage();
    
    if (confusionActive) {
        showLog('😵 Confusione attiva: i token saranno misteriosi!', 'success');
    }
});

createRoomBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    if (!playerName) {
        showLog('Inserisci il tuo nome', 'error');
        return;
    }
    currentPlayerName = playerName;
    socket.emit('create_room', { player_name: playerName });
});

joinRoomBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    const roomId = roomIdInput.value.trim();
    if (!playerName || !roomId) {
        showLog('Inserisci nome e ID stanza', 'error');
        return;
    }
    currentPlayerName = playerName;
    socket.emit('join_room', { player_name: playerName, room_id: roomId });
});

configureBagBtn.addEventListener('click', () => {
    const successi = parseInt(successTokensInput.value);
    const complicazioni = parseInt(complicationTokensInput.value);
    
    if (successi < 0 || complicazioni < 0) {
        showLog('I valori devono essere positivi', 'error');
        return;
    }
    
    socket.emit('configure_bag', {
        room_id: currentRoomId,
        successi: successi,
        complicazioni: complicazioni
    });
    
    playSound('configure');
});

drawButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const numTokens = parseInt(btn.dataset.tokens);
        socket.emit('draw_tokens', {
            room_id: currentRoomId,
            num_tokens: numTokens,
            player_name: currentPlayerName,
            adrenaline: adrenalineActive,
            confusion: confusionActive
        });
        playSound('draw');
        
        // Reset stati dopo il tiro
        if (adrenalineActive) {
            adrenalineToggle.checked = false;
            adrenalineActive = false;
        }
        if (confusionActive) {
            confusionToggle.checked = false;
            confusionActive = false;
        }
        updateDrawButtons();
        updateStatusMessage();
    });
});

generateWeatherBtn.addEventListener('click', () => {
    socket.emit('generate_weather', {
        stagione: seasonSelect.value,
        zona: zoneSelect.value,
        player_name: currentPlayerName,
        room_id: currentRoomId
    });
    playSound('weather');
});

resetBagBtn.addEventListener('click', () => {
    if (confirm('Sei sicuro di voler resettare il sacchetto?')) {
        socket.emit('reset_bag', { room_id: currentRoomId });
        successTokensInput.value = 0;
        complicationTokensInput.value = 0;
    }
});

clearHistoryBtn.addEventListener('click', () => {
    historyLog.innerHTML = '';
    showLog('Storico pulito', 'success');
});

leaveRoomBtn.addEventListener('click', () => {
    if (confirm('Sei sicuro di voler lasciare la stanza?')) {
        location.reload();
    }
});

// === Socket Event Handlers ===

socket.on('room_created', (data) => {
    currentRoomId = data.room_id;
    showGameSection();
    currentRoomIdSpan.textContent = data.room_id;
    playersListSpan.textContent = data.player_name;
    showLog(`Stanza creata: ${data.room_id}`, 'success');
});

socket.on('room_joined', (data) => {
    currentRoomId = data.room_id;
    showGameSection();
    currentRoomIdSpan.textContent = data.room_id;
    updatePlayersList(data.room_data.players);
    
    // Aggiorna stato sacchetto
    const bag = data.room_data.bag;
    bagSuccessi.textContent = bag.successi;
    bagComplicazioni.textContent = bag.complicazioni;
    
    // Aggiorna storico
    if (data.room_data.history) {
        data.room_data.history.forEach(entry => {
            addHistoryEntry(entry);
        });
    }
    
    showLog(`Entrato nella stanza: ${data.room_id}`, 'success');
});

socket.on('player_joined', (data) => {
    updatePlayersList(data.players);
    showLog(`${data.player_name} si è unito alla stanza`, 'success');
});

socket.on('bag_configured', (data) => {
    bagSuccessi.textContent = data.successi;
    bagComplicazioni.textContent = data.complicazioni;
    showLog('Sacchetto configurato', 'success');
});

socket.on('tokens_drawn', (data) => {
    // Aggiorna stato sacchetto
    bagSuccessi.textContent = data.bag_remaining.successi;
    bagComplicazioni.textContent = data.bag_remaining.complicazioni;
    
    // Mostra risultato estrazione
    displayDrawResult(data);
    
    // Aggiungi allo storico
    addHistoryEntry(data.history);
    
    // Suono
    if (data.complicazioni > 0) {
        playSound('complication');
    } else {
        playSound('success');
    }
    
    showLog(`${data.player} ha estratto ${data.drawn.length} token`, 'success');
});

socket.on('weather_generated', (data) => {
    displayWeather(data);
    showLog(`Meteo generato: ${data.meteo}`, 'success');
});

socket.on('bag_reset', () => {
    bagSuccessi.textContent = '0';
    bagComplicazioni.textContent = '0';
    drawResult.innerHTML = '';
    showLog('Sacchetto resettato', 'success');
});

socket.on('error', (data) => {
    showLog(data.message, 'error');
});

// === Funzioni di utilità ===

function showGameSection() {
    connectionSection.classList.add('hidden');
    gameSection.classList.remove('hidden');
}

function updatePlayersList(players) {
    playersListSpan.textContent = players.join(', ');
}

function updateDrawButtons() {
    drawButtons.forEach(btn => {
        const numTokens = parseInt(btn.dataset.tokens);
        
        if (adrenalineActive) {
            // Con adrenalina attiva, solo il pulsante 4 è abilitato
            if (numTokens === 4) {
                btn.disabled = false;
                btn.classList.add('forced');
            } else {
                btn.disabled = true;
                btn.classList.remove('forced');
            }
        } else {
            // Senza adrenalina, tutti i pulsanti sono abilitati
            btn.disabled = false;
            btn.classList.remove('forced');
        }
    });
}

function updateStatusMessage() {
    if (adrenalineActive || confusionActive) {
        let message = '';
        if (adrenalineActive && confusionActive) {
            message = '⚡😵 Adrenalina + Confusione attive! Estrai 4 token misteriosi!';
        } else if (adrenalineActive) {
            message = '⚡ Adrenalina attiva! Devi estrarre 4 token!';
        } else if (confusionActive) {
            message = '😵 Confusione attiva! I token saranno misteriosi!';
        }
        statusMessage.textContent = message;
        statusMessage.classList.add('active');
    } else {
        statusMessage.classList.remove('active');
    }
}

function displayDrawResult(data) {
    const isConfusion = data.confusion || false;
    
    // Prima mostra i token (misteriosi se confusione)
    const tokensHtml = data.drawn.map((token, index) => {
        if (isConfusion) {
            return `<div class="token token-mystery" data-index="${index}">❓</div>`;
        } else {
            const className = token === 'successo' ? 'token-success' : 'token-complication';
            const emoji = token === 'successo' ? '⚪' : '⚫';
            return `<div class="token ${className}">${emoji}</div>`;
        }
    }).join('');
    
    drawResult.innerHTML = `
        <div class="draw-info">
            <strong>${data.player}</strong> ha estratto:
        </div>
        <div class="token-display" id="tokenDisplay">
            ${tokensHtml}
        </div>
        <div class="draw-summary">
            <p><strong>Successi:</strong> <span id="successCount">${isConfusion ? '?' : data.successi}</span> ⚪</p>
            <p><strong>Complicazioni:</strong> <span id="complicationCount">${isConfusion ? '?' : data.complicazioni}</span> ⚫</p>
        </div>
    `;
    
    // Se confusione, rivela i token dopo 2 secondi
    if (isConfusion) {
        setTimeout(() => {
            revealMysteryTokens(data);
        }, 2000);
    }
}

function revealMysteryTokens(data) {
    const tokenDisplay = document.getElementById('tokenDisplay');
    const tokens = tokenDisplay.querySelectorAll('.token-mystery');
    
    tokens.forEach((tokenEl, index) => {
        setTimeout(() => {
            const token = data.drawn[index];
            const className = token === 'successo' ? 'token-success' : 'token-complication';
            const emoji = token === 'successo' ? '⚪' : '⚫';
            
            tokenEl.classList.add('token-reveal');
            tokenEl.classList.remove('token-mystery');
            tokenEl.classList.add(className);
            tokenEl.textContent = emoji;
        }, index * 300);
    });
    
    // Aggiorna conteggio dopo tutte le rivelazioni
    setTimeout(() => {
        document.getElementById('successCount').textContent = data.successi;
        document.getElementById('complicationCount').textContent = data.complicazioni;
    }, tokens.length * 300 + 500);
}

function addHistoryEntry(entry) {
    const time = new Date(entry.timestamp).toLocaleTimeString('it-IT');
    const tokens = entry.drawn.map(t => t === 'successo' ? '⚪' : '⚫').join(' ');
    
    const entryHtml = `
        <div class="history-entry">
            <div class="timestamp">${time}</div>
            <div><span class="player-name">${entry.player}</span> ha estratto: ${tokens}</div>
            <div>Risultato: ${entry.successi} ⚪ | ${entry.complicazioni} ⚫</div>
        </div>
    `;
    
    historyLog.insertAdjacentHTML('afterbegin', entryHtml);
}

function displayWeather(data) {
    weatherResult.innerHTML = `
        <div class="weather-display">
            <p><strong>🌍 ${data.zona} - ${data.stagione}</strong></p>
            <p style="font-size: 1.5em; margin: 10px 0;">☁️ ${data.meteo}</p>
            <p style="font-size: 0.9em; color: #6c757d;">Generato da: ${data.player}</p>
        </div>
    `;
}

function showLog(message, type = 'info') {
    const logDiv = document.createElement('div');
    logDiv.className = `log-message ${type}`;
    logDiv.textContent = message;
    actionLog.appendChild(logDiv);
    
    setTimeout(() => {
        logDiv.remove();
    }, 3000);
}

function playSound(type) {
    // Placeholder per effetti sonori
    // Puoi aggiungere file audio nella cartella static/sounds/
    // e riprodurli qui con: new Audio(`/static/sounds/${type}.mp3`).play();
    console.log(`Sound: ${type}`);
}

// Inizializzazione
console.log('🎲 Not The End Token Drawer - Ready!');