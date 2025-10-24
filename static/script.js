// Inizializzazione SocketIO
const socket = io();

// Variabili globali
let currentRoomId = null;
let currentPlayerName = null;

// Stato adrenalina e confusione
let adrenalineActive = false;
let confusionActive = false;

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

// Struttura griglia esagonale (14 abilità + 7 qualità + 1 archetipo)
const hexTraits = [
    // Row 1 (1 abilità)
    { id: 'ability1', type: 'ability', name: 'Abilità 1' },
    
    // Row 2 (2 abilità)
    { id: 'ability2', type: 'ability', name: 'Abilità 2' },
    { id: 'ability3', type: 'ability', name: 'Abilità 3' },
    
    // Row 3 (3: 2 abilità + 1 qualità)
    { id: 'ability4', type: 'ability', name: 'Abilità 4' },
    { id: 'quality1', type: 'quality', name: 'Qualità 1' },
    { id: 'ability5', type: 'ability', name: 'Abilità 5' },
    
    // Row 4 (4: 2 abilità + 2 qualità)
    { id: 'ability6', type: 'ability', name: 'Abilità 6' },
    { id: 'quality2', type: 'quality', name: 'Qualità 2' },
    { id: 'quality3', type: 'quality', name: 'Qualità 3' },
    { id: 'ability7', type: 'ability', name: 'Abilità 7' },
    
    // Row 5 (5: 2 abilità + ARCHETIPO + 2 qualità)
    { id: 'ability8', type: 'ability', name: 'Abilità 8' },
    { id: 'quality4', type: 'quality', name: 'Qualità 4' },
    { id: 'archetype', type: 'archetype', name: 'Archetipo' },
    { id: 'quality5', type: 'quality', name: 'Qualità 5' },
    { id: 'ability9', type: 'ability', name: 'Abilità 9' },
    
    // Row 6 (4: 2 abilità + 2 qualità)
    { id: 'ability10', type: 'ability', name: 'Abilità 10' },
    { id: 'quality6', type: 'quality', name: 'Qualità 6' },
    { id: 'quality7', type: 'quality', name: 'Qualità 7' },
    { id: 'ability11', type: 'ability', name: 'Abilità 11' },
    
    // Row 7 (2 abilità)
    { id: 'ability12', type: 'ability', name: 'Abilità 12' },
    { id: 'ability13', type: 'ability', name: 'Abilità 13' },
    
    // Row 8 (1 abilità)
    { id: 'ability14', type: 'ability', name: 'Abilità 14' },
];

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
        updateCharacterStates();
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

// === Socket Event Handlers ===

socket.on('room_created', (data) => {
    currentRoomId = data.room_id;
    showGameSection();
    currentRoomIdSpan.textContent = data.room_id;
    playersListSpan.textContent = data.player_name;
    
    // Carica le schede
    requestCharactersOnJoin();
    
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
    connectionSection.classList.add('hidden');
    gameSection.classList.remove('hidden');
    
    // Inizializza griglia esagonale
    initHexGrid();
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

// ========== FUNZIONI SCHEDA PERSONAGGIO ==========

function initHexGrid() {
    // Inizializza i pulsanti tratti
    document.querySelectorAll('.trait-btn').forEach(btn => {
        const traitId = btn.dataset.id;
        const traitType = btn.dataset.type;
        
        // Click per selezionare/potenziare
        btn.addEventListener('click', (e) => {
            // Se sta editando il nome, non fare nulla
            if (e.target.classList.contains('trait-name') && e.target === document.activeElement) {
                return;
            }
            toggleTrait(traitId, traitType, btn);
        });
        
        // Salva nome trait quando modificato
        const nameSpan = btn.querySelector('.trait-name');
        nameSpan.addEventListener('blur', () => {
            const traitObj = hexTraits.find(t => t.id === traitId);
            if (traitObj) {
                traitObj.name = nameSpan.textContent.trim();
            }
        });
        
        // Previeni che il click sull'editing triggheri il toggle
        nameSpan.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
}

function createHexElement(trait) {
    const hexDiv = document.createElement('div');
    hexDiv.className = 'hex-trait';
    hexDiv.dataset.id = trait.id;
    
    if (trait.type === 'archetype') {
        hexDiv.classList.add('archetype');
    }
    
    hexDiv.innerHTML = `
        <div class="hex-shape">
            <div class="hex-content" contenteditable="true">${trait.name}</div>
        </div>
    `;
    
    // Click per selezionare/potenziare
    const hexShape = hexDiv.querySelector('.hex-shape');
    hexShape.addEventListener('click', (e) => {
        if (e.target.classList.contains('hex-content')) return; // Editing
        toggleTrait(trait.id, trait.type);
    });
    
    // Salva nome trait quando modificato
    const content = hexDiv.querySelector('.hex-content');
    content.addEventListener('blur', () => {
        const traitObj = hexTraits.find(t => t.id === trait.id);
        if (traitObj) {
            traitObj.name = content.textContent.trim();
        }
    });
    
    return hexDiv;
}

function toggleTrait(traitId, type, btnElement) {
    const isSelected = selectedTraits.has(traitId);
    const isEmpowered = empoweredTraits.has(traitId);
    const iconSpan = btnElement.querySelector('.trait-icon');
    
    if (!isSelected) {
        // Non selezionato → Selezionato (+1)
        selectedTraits.add(traitId);
        btnElement.classList.add('selected');
        iconSpan.textContent = '⬢';
    } else if (isSelected && !isEmpowered && type !== 'archetype') {
        // Selezionato → Potenziato (+2) (solo se NON è archetipo)
        empoweredTraits.add(traitId);
        btnElement.classList.add('empowered');
        iconSpan.textContent = '⬢';
        
        // Aggiungi stellina
        const star = document.createElement('div');
        star.className = 'trait-star';
        star.textContent = '⭐';
        btnElement.appendChild(star);
    } else {
        // Potenziato o Archetipo selezionato → Deseleziona
        selectedTraits.delete(traitId);
        empoweredTraits.delete(traitId);
        btnElement.classList.remove('selected', 'empowered');
        iconSpan.textContent = '⬡';
        
        const star = btnElement.querySelector('.trait-star');
        if (star) star.remove();
    }
    
    updateTraitsSummary();
}

function updateTraitsSummary() {
    let totalWhites = 0;
    let count = 0;
    
    selectedTraits.forEach(traitId => {
        count++;
        if (empoweredTraits.has(traitId)) {
            totalWhites += 2; // Potenziato
        } else {
            totalWhites += 1; // Normale
        }
    });
    
    const manualMod = parseInt(document.getElementById('manualModifier').value) || 0;
    const finalTotal = totalWhites + manualMod;
    
    document.getElementById('selectedTraitsCount').textContent = count;
    document.getElementById('traitsWhiteTokens').textContent = totalWhites;
    document.getElementById('totalWhiteTokens').textContent = finalTotal;
}

function resetTraitsAfterRoll() {
    if (!confirm('Resettare i tratti? I potenziamenti saranno consumati.')) {
        return;
    }
    
    // Rimuovi selezioni e consuma potenziamenti
    document.querySelectorAll('.trait-btn.selected').forEach(btn => {
        const traitId = btn.dataset.id;
        const iconSpan = btn.querySelector('.trait-icon');
        
        // Deseleziona
        btn.classList.remove('selected', 'empowered');
        selectedTraits.delete(traitId);
        empoweredTraits.delete(traitId);
        iconSpan.textContent = '⬡';
        
        // Rimuovi stella
        const star = btn.querySelector('.trait-star');
        if (star) star.remove();
    });
    
    updateTraitsSummary();
    showLog('✅ Tratti resettati! I potenziamenti sono stati consumati.', 'success');
}

function configureFromSheet() {
    const totalWhites = parseInt(document.getElementById('totalWhiteTokens').textContent) || 0;
    
    if (totalWhites <= 0) {
        showLog('❌ Nessun token bianco da configurare!', 'error');
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
            confusionState.querySelector('span').textContent = 'ATTIVA - Token misteriosi!';
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
    
    // Aggiorna nomi tratti dalla griglia
    characterSheet.traits = hexTraits.map(trait => ({
        id: trait.id,
        name: trait.name,
        type: trait.type
    }));
    
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
    
    // Tratti (aggiorna nomi personalizzati)
    if (character.traits && character.traits.length > 0) {
        character.traits.forEach(trait => {
            const hexTrait = hexTraits.find(t => t.id === trait.id);
            if (hexTrait) {
                hexTrait.name = trait.name;
            }
            
            // Aggiorna anche il DOM
            const btn = document.querySelector(`[data-id="${trait.id}"]`);
            if (btn) {
                const nameSpan = btn.querySelector('.trait-name');
                if (nameSpan) {
                    nameSpan.textContent = trait.name;
                }
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
}

function loadOtherCharacters() {
    socket.emit('get_characters', {
        room_id: currentRoomId
    });
}

function displayOtherCharacters(characters) {
    const tabsContainer = document.getElementById('otherCharactersTabs');
    const contentContainer = document.getElementById('otherCharactersContent');
    
    // Filtra solo gli altri giocatori (non il mio personaggio)
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
            // Attiva tab
            document.querySelectorAll('.character-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Mostra scheda
            displayCharacterView(characters[playerName], playerName);
        });
        
        tabsContainer.appendChild(tab);
    });
    
    // Mostra la prima scheda di default
    displayCharacterView(characters[otherPlayers[0]], otherPlayers[0]);
}

function displayCharacterView(character, playerName) {
    const container = document.getElementById('otherCharactersContent');
    
    if (!character) {
        container.innerHTML = '<p class="no-characters">Scheda non disponibile</p>';
        return;
    }
    
    // Crea visualizzazione read-only della scheda
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
                <h4>Tratti Personalizzati</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">
                    ${character.traits ? character.traits.map(t => `
                        <div style="padding: 8px; background: #f0f0f0; border-radius: 5px; font-size: 0.85em;">
                            <strong>${t.type === 'ability' ? '🔵' : t.type === 'quality' ? '🟢' : '🔴'}</strong> ${t.name}
                        </div>
                    `).join('') : '<p>Nessun tratto definito</p>'}
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <h4>Sventure</h4>
                <ul>
                    ${character.misfortunes.filter(m => m).map(m => `<li>${m}</li>`).join('') || '<li>Nessuna sventura</li>'}
                </ul>
            </div>
            
            <div style="margin-top: 20px;">
                <h4>Lezioni Imparate</h4>
                <ul>
                    ${character.lessons.filter(l => l).map(l => `<li>${l}</li>`).join('') || '<li>Nessuna lezione</li>'}
                </ul>
            </div>
            
            <div style="margin-top: 20px;">
                <h4>Risorse</h4>
                <p>${character.resources || 'Nessuna risorsa specificata'}</p>
            </div>
            
            <div style="margin-top: 20px;">
                <h4>Appunti</h4>
                <p>${character.notes || 'Nessun appunto'}</p>
            </div>
        </div>
    `;
}

// Richiedi le schede quando entri nella stanza
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