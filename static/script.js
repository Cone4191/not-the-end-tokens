// Inizializzazione SocketIO
const socket = io();

// Variabili globali
let currentRoomId = null;
let currentPlayerName = null;
let currentUsername = null;
let currentUserId = null;
let sessionId = null;

// Stato adrenalina e confusione
let adrenalineActive = false;
let confusionActive = false;

// Timeout per richieste
let drawTimeout = null;

// ========== VARIABILI SCHEDA PERSONAGGIO ==========
let characterSheet = {
    name: '',
    motivation: '',
    archetype: '',
    photo: '',
    traits: [],
    misfortunes: ['', '', '', ''],
    lessons: ['', '', ''],
    resources: '',
    notes: ''
};

let selectedTraits = new Set(); // ID dei tratti selezionati
let empoweredTraits = new Set(); // ID dei tratti potenziati
let qualityCounter = 0; // Contatore qualità
let abilityCounter = 0; // Contatore abilità
let lastDrawnTokens = 0; // Numero di token estratti nell'ultimo tiro
let canRiskAll = false; // Flag per attivare "Rischia Tutto"

// Elementi DOM
const loginSection = document.getElementById('loginSection');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const dashboardSection = document.getElementById('dashboardSection');
const connectionSection = document.getElementById('connectionSection');
const gameSection = document.getElementById('gameSection');

// Login/Register elements
const loginUsernameInput = document.getElementById('loginUsername');
const loginPasswordInput = document.getElementById('loginPassword');
const registerUsernameInput = document.getElementById('registerUsername');
const registerPasswordInput = document.getElementById('registerPassword');
const registerPasswordConfirmInput = document.getElementById('registerPasswordConfirm');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const showRegisterBtn = document.getElementById('showRegisterBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const usernameDisplay = document.getElementById('usernameDisplay');
const playerNameInput = document.getElementById('playerName');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const currentRoomIdSpan = document.getElementById('currentRoomId');
const playersListSpan = document.getElementById('playersList');
const createNewRoomBtn = document.getElementById('createNewRoomBtn');
const joinRoomBtnDashboard = document.getElementById('joinRoomBtnDashboard');
const joinRoomIdInput = document.getElementById('joinRoomIdInput');
const ownedRoomsList = document.getElementById('ownedRoomsList');
const sharedRoomsList = document.getElementById('sharedRoomsList');

// Elementi sacchetto
const successTokensInput = document.getElementById('successTokens');
const complicationTokensInput = document.getElementById('complicationTokens');
const configureBagBtn = document.getElementById('configureBagBtn');
const bagSuccessi = document.getElementById('bagSuccessi');
const bagComplicazioni = document.getElementById('bagComplicazioni');
const addHelpBtn = document.getElementById('addHelpBtn');
const helpStatus = document.getElementById('helpStatus');

// Elementi estrazione
const drawButtons = document.querySelectorAll('.btn-draw');
const drawResult = document.getElementById('drawResult');
const riskAllSection = document.getElementById('riskAllSection');
const riskAllBtn = document.getElementById('riskAllBtn');
const bagEmptyWarning = document.getElementById('bagEmptyWarning');

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
const backToDashboardBtn = document.getElementById('backToDashboardBtn');
const actionLog = document.getElementById('actionLog');

// === Event Listeners ===

// Toggle form Login/Register
showRegisterBtn.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
});

showLoginBtn.addEventListener('click', () => {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

// Registrazione
registerBtn.addEventListener('click', () => {
    const username = registerUsernameInput.value.trim();
    const password = registerPasswordInput.value;
    const passwordConfirm = registerPasswordConfirmInput.value;

    if (!username || !password) {
        showLog('Username e password sono obbligatori', 'error');
        return;
    }

    if (password.length < 6) {
        showLog('La password deve essere almeno 6 caratteri', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        showLog('Le password non corrispondono', 'error');
        return;
    }

    socket.emit('register', {
        username: username,
        password: password
    });
});

// Login
loginBtn.addEventListener('click', () => {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;

    if (!username || !password) {
        showLog('Username e password sono obbligatori', 'error');
        return;
    }

    socket.emit('login', {
        username: username,
        password: password
    });
});

// Logout
logoutBtn.addEventListener('click', () => {
    if (confirm('Sei sicuro di voler uscire?')) {
        location.reload();
    }
});

// Crea nuova stanza dalla dashboard
createNewRoomBtn.addEventListener('click', () => {
    const playerName = prompt('Inserisci il tuo nome per questa stanza:');
    if (!playerName || !playerName.trim()) {
        showLog('Nome non valido', 'error');
        return;
    }
    currentPlayerName = playerName.trim();
    socket.emit('create_room', {
        player_name: currentPlayerName,
        user_id: currentUserId
    });
});

// Unisciti a stanza dalla dashboard
joinRoomBtnDashboard.addEventListener('click', () => {
    const roomId = joinRoomIdInput.value.trim();
    if (!roomId) {
        showLog('Inserisci un ID stanza', 'error');
        return;
    }

    const playerName = prompt('Inserisci il tuo nome per questa stanza:');
    if (!playerName || !playerName.trim()) {
        showLog('Nome non valido', 'error');
        return;
    }

    currentPlayerName = playerName.trim();
    socket.emit('join_room', {
        player_name: currentPlayerName,
        room_id: roomId,
        user_id: currentUserId
    });
});

// Toggle Adrenalina
adrenalineToggle.addEventListener('change', (e) => {
    adrenalineActive = e.target.checked;
    updateDrawButtons();
    updateStatusMessage();
    updateCharacterStates();
    
    if (adrenalineActive) {
        showLog('⚡ Adrenalina attiva: dovrai estrarre 4 token!', 'success');
    }
});

// Toggle Confusione
confusionToggle.addEventListener('change', (e) => {
    confusionActive = e.target.checked;
    updateStatusMessage();
    updateCharacterStates();
    
    if (confusionActive) {
        showLog('😵 Confusione attiva: i token bianchi diventano random!', 'success');
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
    
    // Mostra pulsante aiuto e resetta stato aiuto
    addHelpBtn.classList.remove('hidden');
    addHelpBtn.disabled = false;
    helpStatus.classList.add('hidden');
    
    playSound('configure');
});

// Pulsante Aiuto
addHelpBtn.addEventListener('click', () => {
    socket.emit('add_help', {
        room_id: currentRoomId,
        player_name: currentPlayerName
    });
});

drawButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const numTokens = parseInt(btn.dataset.tokens);
        console.log(`🎯 Estraendo ${numTokens} token...`);
        console.log('Socket connesso:', socket.connected);
        console.log('Room ID:', currentRoomId);
        console.log('Player:', currentPlayerName);

        if (!socket.connected) {
            showLog('❌ Errore: Non connesso al server!', 'error');
            console.error('Socket disconnesso!');
            return;
        }

        if (!currentRoomId) {
            showLog('❌ Errore: Nessuna stanza attiva!', 'error');
            console.error('currentRoomId è null!');
            return;
        }

        socket.emit('draw_tokens', {
            room_id: currentRoomId,
            num_tokens: numTokens,
            player_name: currentPlayerName,
            adrenaline: adrenalineActive,
            confusion: confusionActive
        });
        console.log('✉️ Richiesta inviata al server');

        // Timeout di 5 secondi per la risposta
        if (drawTimeout) clearTimeout(drawTimeout);
        drawTimeout = setTimeout(() => {
            console.error('⏱️ Timeout: il server non ha risposto dopo 5 secondi');
            showLog('⏱️ Il server non risponde. Verifica che sia in esecuzione.', 'error');
        }, 5000);

        playSound('draw');

        lastDrawnTokens = adrenalineActive ? 4 : numTokens;

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
        updateCharacterStates();
    });
});

// Pulsante Rischia Tutto
riskAllBtn.addEventListener('click', () => {
    if (!canRiskAll) return;

    const tokensToRisk = 5 - lastDrawnTokens;

    if (tokensToRisk <= 0) {
        showLog('❌ Hai già estratto 5 token!', 'error');
        return;
    }

    if (!confirm(`⚠️ Vuoi rischiare tutto ed estrarre altri ${tokensToRisk} token?`)) {
        return;
    }

    // Leggi i valori correnti dal display
    const currentSuccessi = parseInt(document.getElementById('successCount').textContent) || 0;
    const currentComplicazioni = parseInt(document.getElementById('complicationCount').textContent) || 0;

    socket.emit('risk_all', {
        room_id: currentRoomId,
        num_tokens: tokensToRisk,
        player_name: currentPlayerName,
        previous_successi: currentSuccessi,
        previous_complicazioni: currentComplicazioni
    });

    canRiskAll = false;
    riskAllSection.classList.add('hidden');
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
        
        // Nascondi pulsante aiuto
        addHelpBtn.classList.add('hidden');
        helpStatus.classList.add('hidden');
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

backToDashboardBtn.addEventListener('click', () => {
    if (confirm('Tornare alla dashboard? (La stanza rimarrà attiva)')) {
        gameSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');

        // Ricarica le stanze usando la sessione esistente
        socket.emit('refresh_rooms', {
            session_id: sessionId
        });
    }
});

// ========== EVENT LISTENERS SCHEDA PERSONAGGIO ==========

// Upload foto
document.getElementById('uploadPhotoBtn').addEventListener('click', () => {
    document.getElementById('photoUpload').click();
});

document.getElementById('photoUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('characterPhoto').src = event.target.result;
            characterSheet.photo = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Modificatore manuale
document.getElementById('manualModifier').addEventListener('input', updateTraitsSummary);

// Salva scheda
document.getElementById('saveCharacterBtn').addEventListener('click', saveCharacterSheet);

// Configura sacchetto da scheda
document.getElementById('configureFromSheetBtn').addEventListener('click', configureFromSheet);

// Reset tratti dopo tiro
document.getElementById('resetTraitsBtn').addEventListener('click', resetTraitsAfterRoll);

// Aggiungi qualità/abilità
document.getElementById('addQualityBtn').addEventListener('click', () => addTrait('quality'));
document.getElementById('addAbilityBtn').addEventListener('click', () => addTrait('ability'));

// === Socket Event Handlers ===

socket.on('register_success', (data) => {
    showLog(data.message, 'success');
    // Torna al form di login
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    // Pre-compila l'username
    loginUsernameInput.value = registerUsernameInput.value;
    // Pulisci i campi di registrazione
    registerUsernameInput.value = '';
    registerPasswordInput.value = '';
    registerPasswordConfirmInput.value = '';
});

socket.on('login_success', (data) => {
    sessionId = data.session_id;
    currentUsername = data.username;
    currentUserId = data.user_id;
    usernameDisplay.textContent = data.username;

    // Nascondi login, mostra dashboard
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');

    // Popola le stanze
    displayOwnedRooms(data.owned_rooms);
    displaySharedRooms(data.shared_rooms);

    showLog(`Benvenuto ${data.username}!`, 'success');
});

socket.on('rooms_refreshed', (data) => {
    // Aggiorna le stanze nella dashboard
    displayOwnedRooms(data.owned_rooms);
    displaySharedRooms(data.shared_rooms);
});

socket.on('room_created', (data) => {
    currentRoomId = data.room_id;
    showGameSection();
    currentRoomIdSpan.textContent = data.room_id;
    playersListSpan.textContent = data.player_name;

    // Carica le schede
    requestCharactersOnJoin();

    updateDrawButtons(); // Disabilita pulsanti finché il sacchetto non è configurato
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

    // Carica le schede
    requestCharactersOnJoin();

    updateDrawButtons(); // Abilita/disabilita pulsanti in base ai token disponibili
    showLog(`Entrato nella stanza: ${data.room_id}`, 'success');
});

socket.on('player_joined', (data) => {
    updatePlayersList(data.players);
    showLog(`${data.player_name} si è unito alla stanza`, 'success');
});

socket.on('bag_configured', (data) => {
    bagSuccessi.textContent = data.successi;
    bagComplicazioni.textContent = data.complicazioni;
    updateDrawButtons(); // Abilita/disabilita pulsanti in base ai token disponibili
    showLog('Sacchetto configurato', 'success');
});

socket.on('help_added', (data) => {
    bagSuccessi.textContent = data.bag.successi;
    bagComplicazioni.textContent = data.bag.complicazioni;

    // Disabilita pulsante per tutti
    addHelpBtn.disabled = true;

    // Mostra chi ha aiutato
    helpStatus.textContent = `💪 ${data.helper} ha aggiunto il suo aiuto (+1⚪)`;
    helpStatus.classList.remove('hidden');
    helpStatus.classList.add('given');

    updateDrawButtons(); // Abilita/disabilita pulsanti in base ai token disponibili
    showLog(`${data.helper} ha aggiunto il suo aiuto!`, 'success');
});

socket.on('tokens_drawn', (data) => {
    console.log('✅ Tokens ricevuti:', data.drawn);

    // Cancella timeout
    if (drawTimeout) {
        clearTimeout(drawTimeout);
        drawTimeout = null;
    }

    // Aggiorna stato sacchetto
    bagSuccessi.textContent = data.bag_remaining.successi;
    bagComplicazioni.textContent = data.bag_remaining.complicazioni;

    // Mostra risultato estrazione
    displayDrawResult(data);

    // Aggiungi allo storico
    addHistoryEntry(data.history);

    // Mostra pulsante Rischia Tutto se < 5
    if (data.drawn.length < 5 && data.player === currentPlayerName) {
        canRiskAll = true;
        riskAllSection.classList.remove('hidden');
    }

    // Suono
    if (data.complicazioni > 0) {
        playSound('complication');
    } else {
        playSound('success');
    }

    updateDrawButtons(); // Abilita/disabilita pulsanti in base ai token disponibili
    showLog(`${data.player} ha estratto ${data.drawn.length} token`, 'success');
});

socket.on('risk_all_result', (data) => {
    // Aggiorna sacchetto
    bagSuccessi.textContent = data.bag_remaining.successi;
    bagComplicazioni.textContent = data.bag_remaining.complicazioni;

    // Aggiungi i nuovi token al display esistente
    appendRiskTokens(data);

    // Aggiungi allo storico
    addHistoryEntry(data.history);

    updateDrawButtons(); // Abilita/disabilita pulsanti in base ai token disponibili
    showLog(`⚠️ ${data.player} ha rischiato tutto! +${data.drawn.length} token`, 'success');

    // Nascondi pulsante
    riskAllSection.classList.add('hidden');
});

socket.on('weather_generated', (data) => {
    displayWeather(data);
    showLog(`Meteo generato: ${data.meteo}`, 'success');
});

socket.on('bag_reset', () => {
    bagSuccessi.textContent = '0';
    bagComplicazioni.textContent = '0';
    drawResult.innerHTML = '';
    riskAllSection.classList.add('hidden');
    addHelpBtn.classList.add('hidden');
    helpStatus.classList.add('hidden');
    updateDrawButtons(); // Disabilita tutti i pulsanti quando il sacchetto è vuoto
    showLog('Sacchetto resettato', 'success');
});

socket.on('error', (data) => {
    console.error('❌ Errore dal server:', data.message);
    showLog(data.message, 'error');
});

socket.on('connect', () => {
    console.log('✅ Socket.IO connesso');
});

socket.on('disconnect', () => {
    console.log('❌ Socket.IO disconnesso');
    showLog('Connessione persa con il server', 'error');
});

// ========== SOCKET HANDLERS SCHEDE PERSONAGGIO ==========

socket.on('character_saved', (data) => {
    showLog(`💾 ${data.player_name} ha aggiornato la scheda`, 'success');
    
    // Aggiorna la vista delle schede degli altri giocatori
    loadOtherCharacters();
});

socket.on('my_character_loaded', (data) => {
    if (data.character) {
        loadMyCharacter(data.character);
        showLog('📜 Scheda caricata!', 'success');
    }
});

socket.on('characters_loaded', (data) => {
    displayOtherCharacters(data.characters);
});

// === Funzioni di utilità ===

function showGameSection() {
    dashboardSection.classList.add('hidden');
    connectionSection.classList.add('hidden');
    gameSection.classList.remove('hidden');

    // Inizializza tratti
    initTraits();
}

function displayOwnedRooms(rooms) {
    if (rooms.length === 0) {
        ownedRoomsList.innerHTML = '<p class="no-rooms">Nessuna stanza creata. Crea la tua prima stanza!</p>';
        return;
    }

    ownedRoomsList.innerHTML = rooms.map(room => {
        const createdDate = new Date(room.created_at).toLocaleString('it-IT');
        return `
            <div class="room-card" onclick="enterRoom('${room.id}', '${room.my_player_name || ''}')">
                <div class="room-card-header">
                    <span class="room-id">🎲 ${room.id}</span>
                    <span class="room-owner-badge">TUA</span>
                </div>
                <div class="room-players">
                    👥 Giocatori: ${room.players.join(', ')}
                </div>
                <div class="room-created">
                    📅 Creata: ${createdDate}
                </div>
            </div>
        `;
    }).join('');
}

function displaySharedRooms(rooms) {
    if (rooms.length === 0) {
        sharedRoomsList.innerHTML = '<p class="no-rooms">Non partecipi a nessuna stanza condivisa</p>';
        return;
    }

    sharedRoomsList.innerHTML = rooms.map(room => {
        const createdDate = new Date(room.created_at).toLocaleString('it-IT');
        return `
            <div class="room-card" onclick="enterRoom('${room.id}', '${room.my_player_name || ''}')">
                <div class="room-card-header">
                    <span class="room-id">🎲 ${room.id}</span>
                    <span class="room-shared-badge">CONDIVISA</span>
                </div>
                <div class="room-players">
                    👥 Giocatori: ${room.players.join(', ')}
                </div>
                <div class="room-created">
                    📅 Creata: ${createdDate}
                </div>
            </div>
        `;
    }).join('');
}

function enterRoom(roomId, savedPlayerName) {
    // Se abbiamo già un nome salvato per questa stanza, usalo
    if (savedPlayerName && savedPlayerName.trim()) {
        currentPlayerName = savedPlayerName.trim();
        socket.emit('join_room', {
            player_name: currentPlayerName,
            room_id: roomId,
            user_id: currentUserId
        });
    } else {
        // Altrimenti chiedi il nome
        const playerName = prompt('Inserisci il tuo nome per questa stanza:');
        if (!playerName || !playerName.trim()) {
            showLog('Nome non valido', 'error');
            return;
        }

        currentPlayerName = playerName.trim();
        socket.emit('join_room', {
            player_name: currentPlayerName,
            room_id: roomId,
            user_id: currentUserId
        });
    }
}

function updatePlayersList(players) {
    playersListSpan.textContent = players.join(', ');
}

function updateDrawButtons() {
    // Leggi il numero di token disponibili nel sacchetto
    const availableTokens = (parseInt(bagSuccessi.textContent) || 0) + (parseInt(bagComplicazioni.textContent) || 0);

    // Mostra/nascondi messaggio di avviso se il sacchetto è vuoto
    if (bagEmptyWarning) {
        if (availableTokens === 0) {
            bagEmptyWarning.classList.remove('hidden');
        } else {
            bagEmptyWarning.classList.add('hidden');
        }
    }

    drawButtons.forEach(btn => {
        const numTokens = parseInt(btn.dataset.tokens);

        if (adrenalineActive) {
            // Con adrenalina attiva, solo il pulsante 4 è abilitato
            if (numTokens === 4) {
                // Abilita solo se ci sono abbastanza token
                btn.disabled = availableTokens < 4;
                btn.classList.add('forced');
            } else {
                btn.disabled = true;
                btn.classList.remove('forced');
            }
        } else {
            // Senza adrenalina, abilita solo se ci sono abbastanza token
            btn.disabled = availableTokens < numTokens;
            btn.classList.remove('forced');
        }

        // Aggiungi tooltip se disabilitato per mancanza di token
        if (btn.disabled && !adrenalineActive) {
            btn.title = `Servono almeno ${numTokens} token nel sacchetto`;
        } else if (btn.disabled && adrenalineActive && numTokens !== 4) {
            btn.title = 'Adrenalina attiva: devi estrarre 4 token';
        } else {
            btn.title = `Estrai ${numTokens} token`;
        }
    });
}

function updateStatusMessage() {
    if (adrenalineActive || confusionActive) {
        let message = '';
        if (adrenalineActive && confusionActive) {
            message = '⚡😵 Adrenalina + Confusione attive! Estrai 4 token random!';
        } else if (adrenalineActive) {
            message = '⚡ Adrenalina attiva! Devi estrarre 4 token!';
        } else if (confusionActive) {
            message = '😵 Confusione attiva! I token bianchi diventano random!';
        }
        statusMessage.textContent = message;
        statusMessage.classList.add('active');
    } else {
        statusMessage.classList.remove('active');
    }
}

function displayDrawResult(data) {
    console.log('📊 Visualizzando risultato...');

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

    const html = `
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

    drawResult.innerHTML = html;
    console.log('✅ Risultato visualizzato:', data.successi + '⚪', data.complicazioni + '⚫');

    // Se confusione, rivela i token dopo 2 secondi
    if (isConfusion) {
        setTimeout(() => {
            revealMysteryTokens(data);
        }, 2000);
    }
}

function appendRiskTokens(data) {
    const tokenDisplay = document.getElementById('tokenDisplay');
    
    if (!tokenDisplay) return;
    
    // Aggiungi i nuovi token
    data.drawn.forEach(token => {
        const className = token === 'successo' ? 'token-success' : 'token-complication';
        const emoji = token === 'successo' ? '⚪' : '⚫';
        
        const tokenDiv = document.createElement('div');
        tokenDiv.className = `token ${className}`;
        tokenDiv.textContent = emoji;
        tokenDiv.style.animation = 'tokenPop 0.5s ease';
        
        tokenDisplay.appendChild(tokenDiv);
    });
    
    // Aggiorna conteggio
    document.getElementById('successCount').textContent = data.total_successi;
    document.getElementById('complicationCount').textContent = data.total_complicazioni;
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
    console.log(`Sound: ${type}`);
}

// ========== FUNZIONI TRATTI DINAMICI (MIGLIORATI) ==========

function initTraits() {
    // Inizializza archetipo
    const archetypeBtn = document.querySelector('[data-id="archetype"]');
    if (archetypeBtn) {
        setupTraitButton(archetypeBtn, 'archetype');
    }
    
    // Aggiorna contatori iniziali
    document.getElementById('qualitiesCount').textContent = qualityCounter;
    document.getElementById('abilitiesCount').textContent = abilityCounter;
    
    // Assicurati che i pulsanti aggiungi siano abilitati
    const addQualityBtn = document.getElementById('addQualityBtn');
    const addAbilityBtn = document.getElementById('addAbilityBtn');
    if (addQualityBtn) addQualityBtn.disabled = false;
    if (addAbilityBtn) addAbilityBtn.disabled = false;
}

function setupTraitButton(btn, type) {
    const traitId = btn.dataset.id;

    // Click sul pulsante per selezionare/deselezionare
    btn.addEventListener('click', (e) => {
        // Se sta editando il nome, non fare nulla
        if (e.target.classList.contains('trait-name') && e.target === document.activeElement) {
            return;
        }

        // Se sta cliccando sulla stellina, non selezionare
        if (e.target.classList.contains('trait-star-checkbox')) {
            return;
        }

        // Toggle selezione (primo click: seleziona, secondo click: deseleziona)
        toggleSelection(traitId, btn);
    });

    // Click sulla stellina per potenziare - indipendente dalla selezione
    const starCheckbox = btn.querySelector('.trait-star-checkbox');
    if (starCheckbox) {
        starCheckbox.addEventListener('click', (e) => {
            e.stopPropagation(); // Previeni la selezione del pulsante
            toggleEmpowerment(traitId, btn);
        });
    }

    // Salva nome trait quando modificato
    const nameSpan = btn.querySelector('.trait-name');
    nameSpan.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

function addTrait(type) {
    const isQuality = type === 'quality';
    const grid = document.getElementById(isQuality ? 'qualitiesGrid' : 'abilitiesGrid');
    const count = isQuality ? qualityCounter : abilityCounter;
    const maxCount = isQuality ? 6 : 12;
    const countSpan = document.getElementById(isQuality ? 'qualitiesCount' : 'abilitiesCount');
    const addBtn = document.getElementById(isQuality ? 'addQualityBtn' : 'addAbilityBtn');
    
    if (count >= maxCount) {
        showLog(`❌ Limite massimo raggiunto (${maxCount})`, 'error');
        return;
    }
    
    // Incrementa contatore
    if (isQuality) {
        qualityCounter++;
    } else {
        abilityCounter++;
    }
    
    const newCount = isQuality ? qualityCounter : abilityCounter;
    const traitId = `${type}${newCount}`;
    const traitName = isQuality ? `Qualità ${newCount}` : `Abilità ${newCount}`;
    
    // Crea elemento tratto
    const traitItem = document.createElement('div');
    traitItem.className = 'trait-item';
    traitItem.dataset.traitId = traitId;
    
    traitItem.innerHTML = `
        <div class="trait-btn" data-id="${traitId}" data-type="${type}">
            <span class="trait-name" contenteditable="true">${traitName}</span>
            <span class="trait-star-checkbox">⭐</span>
        </div>
        <button class="trait-remove-btn" data-id="${traitId}" title="Rimuovi">✖</button>
    `;
    
    grid.appendChild(traitItem);
    
    // Setup eventi
    const btn = traitItem.querySelector('.trait-btn');
    setupTraitButton(btn, type);
    
    const removeBtn = traitItem.querySelector('.trait-remove-btn');
    removeBtn.addEventListener('click', () => removeTrait(traitId, type));
    
    // Aggiorna conteggio
    countSpan.textContent = newCount;
    
    // Disabilita pulsante se raggiunto il limite
    if (newCount >= maxCount) {
        addBtn.disabled = true;
    }
    
    updateTraitsSummary();
}

function removeTrait(traitId, type) {
    const traitItem = document.querySelector(`.trait-item[data-trait-id="${traitId}"]`);
    if (!traitItem) return;
    
    // Rimuovi dalle selezioni
    selectedTraits.delete(traitId);
    empoweredTraits.delete(traitId);
    
    // Rimuovi dall'DOM
    traitItem.remove();
    
    // Aggiorna contatori
    const isQuality = type === 'quality';
    
    if (isQuality) {
        qualityCounter = Math.max(0, qualityCounter - 1);
    } else {
        abilityCounter = Math.max(0, abilityCounter - 1);
    }
    
    const countSpan = document.getElementById(isQuality ? 'qualitiesCount' : 'abilitiesCount');
    const addBtn = document.getElementById(isQuality ? 'addQualityBtn' : 'addAbilityBtn');
    
    countSpan.textContent = isQuality ? qualityCounter : abilityCounter;
    addBtn.disabled = false;
    
    updateTraitsSummary();
}

function toggleSelection(traitId, btnElement) {
    const isSelected = selectedTraits.has(traitId);
    
    if (!isSelected) {
        // Non selezionato → Selezionato
        selectedTraits.add(traitId);
        btnElement.classList.add('selected');
    } else {
        // Selezionato → Deselezionato
        selectedTraits.delete(traitId);
        btnElement.classList.remove('selected');
    }
    
    updateTraitsSummary();
}

function toggleEmpowerment(traitId, btnElement) {
    const isEmpowered = empoweredTraits.has(traitId);
    
    if (!isEmpowered) {
        // Aggiungi potenziamento
        empoweredTraits.add(traitId);
        btnElement.classList.add('empowered');
    } else {
        // Rimuovi potenziamento
        empoweredTraits.delete(traitId);
        btnElement.classList.remove('empowered');
    }
    
    updateTraitsSummary();
}

function updateTraitsSummary() {
    let totalWhites = 0;
    let count = 0;
    
    selectedTraits.forEach(traitId => {
        count++;
        if (empoweredTraits.has(traitId)) {
            totalWhites += 2; // Selezionato + Potenziato
        } else {
            totalWhites += 1; // Solo Selezionato
        }
    });
    
    const manualMod = parseInt(document.getElementById('manualModifier').value) || 0;
    const finalTotal = totalWhites + manualMod;
    
    document.getElementById('selectedTraitsCount').textContent = count;
    document.getElementById('traitsWhiteTokens').textContent = totalWhites;
    document.getElementById('totalWhiteTokens').textContent = finalTotal;
    
    // Auto-sync con campo sacchetto
    successTokensInput.value = finalTotal;
}

function resetTraitsAfterRoll() {
    if (!confirm('Resettare i tratti? I potenziamenti usati verranno consumati.')) {
        return;
    }
    
    // Rimuovi selezioni e consuma potenziamenti SOLO se usati
    selectedTraits.forEach(traitId => {
        const btn = document.querySelector(`[data-id="${traitId}"]`);
        if (!btn) return;
        
        // Deseleziona
        btn.classList.remove('selected');
        
        // Se era potenziato E selezionato → consuma potenziamento
        if (empoweredTraits.has(traitId)) {
            empoweredTraits.delete(traitId);
            btn.classList.remove('empowered');
        }
    });
    
    // Svuota set selezioni
    selectedTraits.clear();
    
    // I potenziamenti NON usati (non selezionati) rimangono
    
    updateTraitsSummary();
    showLog('✅ Tratti resettati! I potenziamenti usati sono stati consumati.', 'success');
}

function configureFromSheet() {
    const totalWhites = parseInt(document.getElementById('totalWhiteTokens').textContent) || 0;
    
    if (totalWhites < 0) {
        showLog('❌ I token bianchi non possono essere negativi!', 'error');
        return;
    }
    
    // Prendi i neri dal campo esistente
    const blacks = parseInt(document.getElementById('complicationTokens').value) || 0;
    
    // Imposta i valori
    document.getElementById('successTokens').value = totalWhites;
    document.getElementById('complicationTokens').value = blacks;
    
    // Configura il sacchetto
    socket.emit('configure_bag', {
        room_id: currentRoomId,
        successi: totalWhites,
        complicazioni: blacks
    });
    
    // Mostra pulsante aiuto
    addHelpBtn.classList.remove('hidden');
    addHelpBtn.disabled = false;
    helpStatus.classList.add('hidden');
    
    showLog(`🎲 Sacchetto configurato: ${totalWhites}⚪ + ${blacks}⚫`, 'success');
}

function updateCharacterStates() {
    const adrenalineState = document.getElementById('charAdrenalineState');
    const confusionState = document.getElementById('charConfusionState');
    
    if (adrenalineState && confusionState) {
        if (adrenalineActive) {
            adrenalineState.classList.add('active');
            adrenalineState.querySelector('span').textContent = 'ATTIVA - Estrai 4 token!';
        } else {
            adrenalineState.classList.remove('active');
            adrenalineState.querySelector('span').textContent = 'Non attiva';
        }
        
        if (confusionActive) {
            confusionState.classList.add('active');
            confusionState.querySelector('span').textContent = 'ATTIVA - Token bianchi random!';
        } else {
            confusionState.classList.remove('active');
            confusionState.querySelector('span').textContent = 'Non attiva';
        }
    }
}

function saveCharacterSheet() {
    // Raccogli tutti i dati dalla scheda
    characterSheet.name = document.getElementById('characterName').value;
    characterSheet.motivation = document.getElementById('characterMotivation').value;
    characterSheet.archetype = document.getElementById('characterArchetype').value;
    
    // Raccogli tratti dinamici
    characterSheet.traits = [];
    
    // Archetipo
    const archetypeBtn = document.querySelector('[data-id="archetype"]');
    if (archetypeBtn) {
        const name = archetypeBtn.querySelector('.trait-name').textContent.trim();
        characterSheet.traits.push({
            id: 'archetype',
            name: name,
            type: 'archetype'
        });
    }
    
    // Qualità
    document.querySelectorAll('#qualitiesGrid .trait-item').forEach(item => {
        const btn = item.querySelector('.trait-btn');
        const id = btn.dataset.id;
        const name = btn.querySelector('.trait-name').textContent.trim();
        characterSheet.traits.push({ id, name, type: 'quality' });
    });
    
    // Abilità
    document.querySelectorAll('#abilitiesGrid .trait-item').forEach(item => {
        const btn = item.querySelector('.trait-btn');
        const id = btn.dataset.id;
        const name = btn.querySelector('.trait-name').textContent.trim();
        characterSheet.traits.push({ id, name, type: 'ability' });
    });
    
    // Sventure
    characterSheet.misfortunes = [
        document.getElementById('misfortune1').value,
        document.getElementById('misfortune2').value,
        document.getElementById('misfortune3').value,
        document.getElementById('misfortune4').value
    ];
    
    // Lezioni
    characterSheet.lessons = [
        document.getElementById('lesson1').value,
        document.getElementById('lesson2').value,
        document.getElementById('lesson3').value
    ];
    
    // Risorse e note
    characterSheet.resources = document.getElementById('resources').value;
    characterSheet.notes = document.getElementById('notes').value;

    // Aggiungi stati di gioco
    characterSheet.selected_traits = Array.from(selectedTraits);
    characterSheet.empowered_traits = Array.from(empoweredTraits);
    characterSheet.quality_counter = qualityCounter;
    characterSheet.ability_counter = abilityCounter;

    // Invia al server
    socket.emit('save_character', {
        room_id: currentRoomId,
        player_name: currentPlayerName,
        character: characterSheet
    });

    showLog('💾 Scheda salvata!', 'success');
}

function loadMyCharacter(character) {
    // Info base
    document.getElementById('characterName').value = character.name || '';
    document.getElementById('characterMotivation').value = character.motivation || '';
    document.getElementById('characterArchetype').value = character.archetype || '';
    
    // Foto
    if (character.photo) {
        document.getElementById('characterPhoto').src = character.photo;
    }
    
    // Carica tratti dinamici
    if (character.traits && character.traits.length > 0) {
        // Reset griglie
        document.getElementById('qualitiesGrid').innerHTML = '';
        document.getElementById('abilitiesGrid').innerHTML = '';
        qualityCounter = 0;
        abilityCounter = 0;
        
        character.traits.forEach(trait => {
            if (trait.type === 'archetype') {
                // Aggiorna archetipo
                const archetypeBtn = document.querySelector('[data-id="archetype"]');
                if (archetypeBtn) {
                    archetypeBtn.querySelector('.trait-name').textContent = trait.name;
                }
            } else if (trait.type === 'quality') {
                qualityCounter++;
                addTraitFromData(trait, 'quality');
            } else if (trait.type === 'ability') {
                abilityCounter++;
                addTraitFromData(trait, 'ability');
            }
        });
        
        // Aggiorna contatori
        document.getElementById('qualitiesCount').textContent = qualityCounter;
        document.getElementById('abilitiesCount').textContent = abilityCounter;
    }
    
    // Ripristina stati (selezioni e potenziamenti)
    if (character.selected_traits) {
        selectedTraits = new Set(character.selected_traits);
        selectedTraits.forEach(traitId => {
            const btn = document.querySelector(`[data-id="${traitId}"]`);
            if (btn) {
                btn.classList.add('selected');
            }
        });
    }
    
    if (character.empowered_traits) {
        empoweredTraits = new Set(character.empowered_traits);
        empoweredTraits.forEach(traitId => {
            const btn = document.querySelector(`[data-id="${traitId}"]`);
            if (btn) {
                btn.classList.add('empowered');
            }
        });
    }
    
    // Sventure
    document.getElementById('misfortune1').value = character.misfortunes[0] || '';
    document.getElementById('misfortune2').value = character.misfortunes[1] || '';
    document.getElementById('misfortune3').value = character.misfortunes[2] || '';
    document.getElementById('misfortune4').value = character.misfortunes[3] || '';
    
    // Lezioni
    document.getElementById('lesson1').value = character.lessons[0] || '';
    document.getElementById('lesson2').value = character.lessons[1] || '';
    document.getElementById('lesson3').value = character.lessons[2] || '';
    
    // Risorse e note
    document.getElementById('resources').value = character.resources || '';
    document.getElementById('notes').value = character.notes || '';
    
    characterSheet = character;
    
    updateTraitsSummary();
}

function addTraitFromData(trait, type) {
    const isQuality = type === 'quality';
    const grid = document.getElementById(isQuality ? 'qualitiesGrid' : 'abilitiesGrid');
    
    const traitItem = document.createElement('div');
    traitItem.className = 'trait-item';
    traitItem.dataset.traitId = trait.id;
    
    traitItem.innerHTML = `
        <div class="trait-btn" data-id="${trait.id}" data-type="${type}">
            <span class="trait-name" contenteditable="true">${trait.name}</span>
            <span class="trait-star-checkbox">⭐</span>
        </div>
        <button class="trait-remove-btn" data-id="${trait.id}" title="Rimuovi">✖</button>
    `;
    
    grid.appendChild(traitItem);
    
    // Setup eventi
    const btn = traitItem.querySelector('.trait-btn');
    setupTraitButton(btn, type);
    
    const removeBtn = traitItem.querySelector('.trait-remove-btn');
    removeBtn.addEventListener('click', () => removeTrait(trait.id, type));
}

function loadOtherCharacters() {
    socket.emit('get_characters', {
        room_id: currentRoomId
    });
}

function displayOtherCharacters(characters) {
    const tabsContainer = document.getElementById('otherCharactersTabs');
    const contentContainer = document.getElementById('otherCharactersContent');
    
    // Filtra solo gli altri giocatori
    const otherPlayers = Object.keys(characters).filter(name => name !== currentPlayerName);
    
    if (otherPlayers.length === 0) {
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = '<p class="no-characters">Nessun altro giocatore con scheda caricata</p>';
        return;
    }
    
    // Crea tab per ogni giocatore
    tabsContainer.innerHTML = '';
    otherPlayers.forEach((playerName, index) => {
        const tab = document.createElement('button');
        tab.className = 'character-tab';
        tab.textContent = playerName;
        if (index === 0) tab.classList.add('active');
        
        tab.addEventListener('click', () => {
            document.querySelectorAll('.character-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            displayCharacterView(characters[playerName], playerName);
        });
        
        tabsContainer.appendChild(tab);
    });
    
    // Mostra la prima scheda
    displayCharacterView(characters[otherPlayers[0]], otherPlayers[0]);
}

function displayCharacterView(character, playerName) {
    const container = document.getElementById('otherCharactersContent');
    
    if (!character) {
        container.innerHTML = '<p class="no-characters">Scheda non disponibile</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="character-view-readonly">
            <div class="character-header">
                <div class="character-photo">
                    <img src="${character.photo || ''}" alt="Foto ${playerName}" style="width: 150px; height: 150px;">
                </div>
                <div class="character-info">
                    <h3>${character.name || playerName}</h3>
                    <p><strong>Motivazione:</strong> ${character.motivation || 'Non specificata'}</p>
                    <p><strong>Archetipo:</strong> ${character.archetype || 'Non specificato'}</p>
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <h4>Tratti</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">
                    ${character.traits ? character.traits.map(t => `
                        <div style="padding: 8px; background: #f0f0f0; border-radius: 5px; font-size: 0.85em;">
                            <strong>${t.type === 'ability' ? '🔵' : t.type === 'quality' ? '🟢' : '🔴'}</strong> ${t.name}
                        </div>
                    `).join('') : '<p>Nessun tratto</p>'}
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <h4>Sventure</h4>
                <ul>
                    ${character.misfortunes.filter(m => m).map(m => `<li>${m}</li>`).join('') || '<li>Nessuna</li>'}
                </ul>
            </div>
            
            <div style="margin-top: 20px;">
                <h4>Lezioni</h4>
                <ul>
                    ${character.lessons.filter(l => l).map(l => `<li>${l}</li>`).join('') || '<li>Nessuna</li>'}
                </ul>
            </div>
            
            <div style="margin-top: 20px;">
                <h4>Risorse</h4>
                <p>${character.resources || 'Nessuna'}</p>
            </div>
            
            <div style="margin-top: 20px;">
                <h4>Appunti</h4>
                <p>${character.notes || 'Nessuno'}</p>
            </div>
        </div>
    `;
}

function requestCharactersOnJoin() {
    if (currentRoomId) {
        socket.emit('load_my_character', {
            room_id: currentRoomId,
            player_name: currentPlayerName
        });
        
        loadOtherCharacters();
    }
}

// Inizializzazione
console.log('🎲 Not The End Token Drawer - Ready!');
