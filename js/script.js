let peer;
let connections = new Map(); // Store all peer connections
let isHost = false;
let hostConnection = null;
let messagesSeen = new Set(); // Track message IDs to prevent duplicates


// Initialize PeerJS
function initPeer() {
    peer = new Peer();
    
    peer.on('open', (id) => {
        document.getElementById('peer-id').textContent = id;
        updateRoleIndicator();
    });

    // Handle incoming connections
    peer.on('connection', (conn) => {
        setupConnection(conn);
    });
}

function updateRoleIndicator() {
    const indicator = document.getElementById('role-indicator');
    let status = isHost ? 'Host' : connections.size > 0 ? 'Connected' : 'Disconnected';
    indicator.textContent = status;
    switch(status) {
        case 'Host':
            indicator.className = 'status-indicator host';
            break;
        case 'Connected':
            indicator.className = 'status-indicator connected';
            break;
        case 'Disconnected':
            indicator.className = 'status-indicator disconnected';
            break;
    }
}

function setupConnection(conn) {
    connections.set(conn.peer, conn);
    updateRoleIndicator();

    conn.on('open', () => {
        setupConnection(conn);
        hostConnection = conn;
        // Request current video state from the peer we're connecting to
        conn.send({
            type: 'request_video_state'
        });
    });

    conn.on('data', (data) => {
        handleIncomingData({...data}, conn.peer); // Clone the data to prevent modification
    });

    conn.on('close', () => {
        connections.delete(conn.peer);
        updateRoleIndicator();
    });
}

function connectToPeer() {
    const connectId = document.getElementById('peer-id-input').value;
    if (!connectId || connectId === peer.id) return;

    const conn = peer.connect(connectId);
    setupConnection(conn);
}

function handleIncomingData(data, receivedFrom) {
    // Clone the data to prevent modifications affecting the relay
    const originalData = JSON.parse(JSON.stringify(data));

    switch(data.type) {
    case 'chat':
        // Check if we've seen this message before
        if (!messagesSeen.has(data.messageId)) {
            messagesSeen.add(data.messageId);
            // Display message with original sender
            displayMessage(data.message, data.originalSender);
            // Relay the original unchanged message data
            relayData(originalData, receivedFrom);
        }
        break;
    case 'video_state':
        break;
    }
}

function relayData(data, excludePeerId) {
    // Relay the exact same data object without modification
    connections.forEach((conn, peerId) => {
        if (peerId !== excludePeerId) {
            conn.send(data);
        }
    });
}

// CHAT

function generateMessageId() {
    return `${peer.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message) return;

    const messageId = generateMessageId();
    const messageData = {
        type: 'chat',
        message: message,
        originalSender: peer.id,
        messageId: messageId
    };

    // Send to all connected peers
    connections.forEach(conn => conn.send(messageData));

    // Display own message
    displayMessage(message, 'You');
    messagesSeen.add(messageId);
    input.value = '';
}

function displayMessage(message, sender) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('p');
    messageElement.textContent = `${sender === peer.id ? sender : sender === 'You' ? sender : sender}: ${message}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Media
function getMedia() {
    return;
}


// Copy id to clipboard
function copyId() {
    const to_clipboard = document.getElementById('peer-id');
    console.log("Copying to clipboard: '" + to_clipboard.textContent + "'");
    navigator.clipboard.writeText(to_clipboard.textContent);
}