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
let qualityCounter = 0; // Contatore qualità
let abilityCounter = 0; // Contatore abilità
let lastDrawnTokens = 0; // Numero di token estratti nell'ultimo tiro
let canRiskAll = false; // Flag per attivare "Rischia Tutto"

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
const addHelpBtn = document.getElementById('addHelpBtn');
const helpStatus = document.getElementById('helpStatus');

// Elementi estrazione
const drawButtons = document.querySelectorAll('.btn-draw');
const drawResult = document.getElementById('drawResult');
const riskAllSection = document.getElementById('riskAllSection');
const riskAllBtn = document.getElementById('riskAllBtn');

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

// Recupera i totali attuali dal display
const currentSuccessi = parseInt(document.getElementById('successCount').textContent) || 0;
const currentComplicazioni = parseInt(document.getElementById('complicationCount').textContent) || 0;

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
        socket.emit('draw_tokens', {
            room_id: currentRoomId,
            num_tokens: numTokens,
            player_name: currentPlayerName,
            adrenaline: adrenalineActive,
            confusion: confusionActive
        });
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

socket.on('help_added', (data) => {
    bagSuccessi.textContent = data.bag.successi;
    bagComplicazioni.textContent = data.bag.complicazioni;
    
    // Disabilita pulsante per tutti
    addHelpBtn.disabled = true;
    
    // Mostra chi ha aiutato
    helpStatus.textContent = `💪 ${data.helper} ha aggiunto il suo aiuto (+1⚪)`;
    helpStatus.classList.remove('hidden');
    helpStatus.classList.add('given');
    
    showLog(`${data.helper} ha aggiunto il suo aiuto!`, 'success');
});

socket.on('tokens_drawn', (data) => {
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
    
    // Inizializza tratti
    initTraits();
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

// ========== FUNZIONI TRATTI DINAMICI ==========

function initTraits() {
    // Inizializza archetipo
    const archetypeBtn = document.querySelector('[data-id="archetype"]');
    if (archetypeBtn) {
        setupTraitButton(archetypeBtn, 'archetype');
        
        // Disabilita visivamente la selezione dell'archetipo
        archetypeBtn.style.cursor = 'default';
        const iconSpan = archetypeBtn.querySelector('.trait-icon');
        if (iconSpan) {
            iconSpan.style.opacity = '0.5';
        }
    }
    
    // Disabilita pulsante potenziamento archetipo
    const archetypeEmpowerBtn = document.querySelector('.trait-empower-btn[data-id="archetype"]');
    if (archetypeEmpowerBtn) {
        archetypeEmpowerBtn.disabled = true;
        archetypeEmpowerBtn.style.opacity = '0.3';
        archetypeEmpowerBtn.style.cursor = 'not-allowed';
        archetypeEmpowerBtn.title = 'L\'archetipo non può essere potenziato';
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
    
    // Click per selezionare (NON per archetipo)
    btn.addEventListener('click', (e) => {
        // Se sta editando il nome, non fare nulla
        if (e.target.classList.contains('trait-name') && e.target === document.activeElement) {
            return;
        }
        
        // NON permettere selezione archetipo
        if (type === 'archetype') {
            return;
        }
        
        toggleSelection(traitId, btn);
    });
    
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
            <span class="trait-icon">⬡</span>
        </div>
        <button class="trait-empower-btn" data-id="${traitId}" title="Potenzia">⭐</button>
        <button class="trait-remove-btn" data-id="${traitId}" title="Rimuovi">✖</button>
    `;
    
    grid.appendChild(traitItem);
    
    // Setup eventi
    const btn = traitItem.querySelector('.trait-btn');
    setupTraitButton(btn, type);
    
    const empowerBtn = traitItem.querySelector('.trait-empower-btn');
    empowerBtn.addEventListener('click', () => toggleEmpowerment(traitId, empowerBtn));
    
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
    const currentCount = isQuality ? qualityCounter : abilityCounter;
    
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
    const iconSpan = btnElement.querySelector('.trait-icon');
    
    if (!isSelected) {
        // Non selezionato → Selezionato
        selectedTraits.add(traitId);
        btnElement.classList.add('selected');
        iconSpan.textContent = '⬢';
    } else {
        // Selezionato → Deselezionato
        selectedTraits.delete(traitId);
        btnElement.classList.remove('selected');
        iconSpan.textContent = '⬡';
    }
    
    updateTraitsSummary();
}

function toggleEmpowerment(traitId, empowerBtn) {
    const isEmpowered = empoweredTraits.has(traitId);
    
    if (!isEmpowered) {
        // Aggiungi potenziamento
        empoweredTraits.add(traitId);
        empowerBtn.classList.add('active');
    } else {
        // Rimuovi potenziamento
        empoweredTraits.delete(traitId);
        empowerBtn.classList.remove('active');
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
        
        const iconSpan = btn.querySelector('.trait-icon');
        
        // Deseleziona
        btn.classList.remove('selected');
        iconSpan.textContent = '⬡';
        
        // Se era potenziato E selezionato → consuma potenziamento
        if (empoweredTraits.has(traitId)) {
            empoweredTraits.delete(traitId);
            const empowerBtn = document.querySelector(`.trait-empower-btn[data-id="${traitId}"]`);
            if (empowerBtn) {
                empowerBtn.classList.remove('active');
            }
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
    
    // Invia al server
    socket.emit('save_character', {
        room_id: currentRoomId,
        player_name: currentPlayerName,
        character: characterSheet,
        selected_traits: Array.from(selectedTraits),
        empowered_traits: Array.from(empoweredTraits),
        quality_counter: qualityCounter,
        ability_counter: abilityCounter
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
                btn.querySelector('.trait-icon').textContent = '⬢';
            }
        });
    }
    
    if (character.empowered_traits) {
        empoweredTraits = new Set(character.empowered_traits);
        empoweredTraits.forEach(traitId => {
            const empowerBtn = document.querySelector(`.trait-empower-btn[data-id="${traitId}"]`);
            if (empowerBtn) {
                empowerBtn.classList.add('active');
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
            <span class="trait-icon">⬡</span>
        </div>
        <button class="trait-empower-btn" data-id="${trait.id}" title="Potenzia">⭐</button>
        <button class="trait-remove-btn" data-id="${trait.id}" title="Rimuovi">✖</button>
    `;
    
    grid.appendChild(traitItem);
    
    // Setup eventi
    const btn = traitItem.querySelector('.trait-btn');
    setupTraitButton(btn, type);
    
    const empowerBtn = traitItem.querySelector('.trait-empower-btn');
    empowerBtn.addEventListener('click', () => toggleEmpowerment(trait.id, empowerBtn));
    
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