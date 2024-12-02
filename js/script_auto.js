let peer;
let connections = new Map(); // Store all peer connections
let isHost = false;
let hostConnection = null;
let messagesSeen = new Set(); // Track message IDs to prevent duplicates
let streamSeen = new Set();
let peerList = new Map();
let bandwidth = 0;
let isActive = false;

// Initialize PeerJS
/**
 * Initializes a new Peer instance and sets up event listeners for peer events.
 * 
 * - On 'open' event, updates the peer ID in the DOM and calls `updateRoleIndicator`.
 * - On 'connection' event, sets up the incoming connection using `setupConnection`.
 */
function initPeer() {
    console.log("Initializing PeerJS...");
    peer = new Peer();
    bandwidth = Math.random()*5;
    console.log("bandwidth = ",bandwidth);
    
    peer.on('open', (id) => {
        document.getElementById('peer-id').textContent = id;
        updateRoleIndicator();
    });

    // Handle incoming connections
    peer.on('connection', (conn) => {
        setupConnection(conn);
    });

    // Handle incoming stream
    peer.on('call', ((call) => {
        setupStream(call);
    }));
}

/**
 * Updates the role indicator element based on the current connection status.
 * 
 * The function checks if the user is a host or if there are any active connections,
 * and updates the text content and class name of the role indicator element accordingly.
 * 
 * Possible statuses:
 * - 'Host': When the user is a host.
 * - 'Connected': When there are active connections.
 * - 'Disconnected': When there are no active connections.
 */
function updateRoleIndicator() {
    console.log("Updating role indicator...");
    const indicator = document.getElementById('role-indicator');
    console.log("Connections size: " + connections.size);
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

/**
 * Sets up a connection with a peer, handling events for open, data, and close.
 */
function setupConnection(conn) {
    console.log("Setting up connection with peer: " + conn.peer);
    connections.set(conn.peer, conn);
    updateRoleIndicator();

    conn.on('open', () => {
        console.log("setupConnection: open");
        hostConnection = conn;
        // Create a connect message from the new peer
        const messageId = `${conn.peer}-${Date.now()}-connect`;
        const connectData = {
            type: 'chat',
            message: 'Connected',
            originalSender: conn.peer,
            messageId: messageId
        };
        
        // Handle the connect message locally
        handleIncomingData(connectData, conn.peer);
    });

    conn.on('data', (data) => {
        console.log("setupConnection: data");
        handleIncomingData({...data}, conn.peer);
    });

    conn.on('close', () => {
        console.log("setupConnection: close");
        // Create a disconnect message as if it came from the disconnected peer
        const messageId = `${conn.peer}-${Date.now()}-disconnect`;
        const disconnectData = {
            type: 'chat',
            message: 'Disconnected',
            originalSender: conn.peer,
            messageId: messageId
        };
        
        // Handle the disconnect message locally
        handleIncomingData(disconnectData, conn.peer);
        
        // Remove the connection
        connections.delete(conn.peer);
        updateRoleIndicator();
    });
}

function setupStream(call) {
    call.answer();

    call.on('stream', ((remoteStream) => {
        //console.log("Peer with ID = ",peer.id," received remote stream");
        const metadataStreamId = call.metadata?.streamId;
        if (!streamSeen.has(metadataStreamId) && !isActive) {
            streamSeen.add(metadataStreamId);
            const video = document.getElementById('player');
            const audio = document.getElementById('player_audio');
            const metadataId = call.metadata?.id; 
            const timestamp = call.metadata?.timestamp;
            peerList = new Map(JSON.parse(call.metadata?.peerList));
            console.log("peerList = ",peerList);

            console.log("Displaying remote stream");
            video.srcObject = remoteStream;
            audio.srcObject = remoteStream;
            const delay = new Date().getTime() - timestamp;
            console.log("Delay = ",delay);
            isActive = true;

            temp_list = new Set();
            peerList.forEach((value, key) => {
                if (bandwidth >= 1 && !value.isActive){
                    value.isActive = true;
                    temp_list.add(key);
                    bandwidth -=1;
                }
            });
            let temp_peerList = JSON.stringify(Array.from(peerList));
            temp_list.forEach((peerId) => {
                console.log("Forwarding remote stream to ",peerId);
                const call = peer.call(peerId, remoteStream, {
                    metadata: { id: peer.id,
                                streamId: metadataStreamId,
                                peerList: temp_peerList,
                                timestamp: timestamp }
                });
            });
        } else{
            call.end
        }
    }));

    call.on('close', () => {
        console.log("setupStream: close");
        const video = document.getElementById('player');
        isActive = false;
    });
}

/**
 * Establishes a connection to a peer using the provided peer ID from the input field.
 * If the input field is empty or the provided ID matches the current peer's ID, the function returns without making a connection.
 */
function connectToPeer() {
    console.log("Connecting to peer...");
    const connectId = document.getElementById('peer-id-input').value;
    if (!connectId || connectId === peer.id) return;

    const conn = peer.connect(connectId);
    setupConnection(conn);
    const msgid = generateMessageId();
    const connectData = {
        type: 'connect',
        originalSender: peer.id,
        bandwidth: bandwidth,
        messageId: msgid
    };
    delayPromise = delay(400);
    delayPromise
    .then(() => {
        connections.forEach((conn) => {
            conn.send(connectData, peer.id);
        });
    });
}

/**
 * Handles incoming data and processes it based on its type.
 * 
 * @param {Object} data - The incoming data object.
 * @param {string} data.type - The type of the incoming data (e.g., 'chat', 'video_state').
 * @param {string} data.messageId - The unique identifier for the message (only for 'chat' type).
 * @param {string} data.message - The message content (only for 'chat' type).
 * @param {string} data.originalSender - The original sender of the message (only for 'chat' type).
 * @param {string} receivedFrom - The identifier of the sender from whom the data was received.
 */
function handleIncomingData(data, receivedFrom) {
    console.log("Handling incoming data...");
    // Clone the data to prevent modifications affecting the relay
    const originalData = JSON.parse(JSON.stringify(data));
    switch(data.type) {
    case 'chat':
        console.log("Chat message received");
        // Check if we've seen this message before
        if (!messagesSeen.has(data.messageId) && peer.id != data.originalSender) {
            messagesSeen.add(data.messageId);
            // Display message with original sender
            if (data.message === 'Disconnected' || data.message === 'Connected') {
                console.log("Received connected message from: ",data.originalSender);
                displayMessage(data.message, data.originalSender);
                if (data.message === 'Disconnected') {
                    removeConnection(data.originalSender);
                }
            } else {
                console.log("Not disconnected or connected");
                displayMessage(data.message, data.originalSender);
            }
            //console.log("Received message: " + data.message + " from " + data.originalSender);
            
            // Relay the original unchanged message data
            relayData(originalData, receivedFrom);
        }
    break;
    case 'connect':
        console.log("Connect message received");
        // Check if we've seen this message before
        if (!messagesSeen.has(data.messageId)) {
            messagesSeen.add(data.messageId);
            if (isHost)
            {
                peerList.set(data.originalSender, { bandwidth: data.bandwidth, isActive: false });
            }
            if (!isHost){
                delayPromise = delay(300);
                delayPromise
                .then(() => {
                    relayData(originalData, receivedFrom);
                });
            }
        }
    break;
    }
}

/**
 * Relays data to all connected peers except the specified one.
 *
 * @param {Object} data - The data object to be relayed.
 * @param {string} excludePeerId - The ID of the peer to exclude from relaying.
 */
function relayData(data, excludePeerId) {
    // Relay the exact same data object without modification
    connections.forEach((conn, peerId) => {
        if (peerId !== excludePeerId) {
            conn.send(data, peer.id);
        }
    });
}


function removeConnection(peerId) {
    connections.delete(peerId);
    updateRoleIndicator();
}

// CHAT

/**
 * Generates a unique message ID.
 *
 * The message ID is composed of the peer's ID, the current timestamp, and a random string.
 *
 * @returns {string} A unique message ID.
 */
function generateMessageId() {
    return `${peer.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sends a chat message to all connected peers and displays it in the chat window.
 * 
 * This function retrieves the message from the input field, generates a unique message ID,
 * and sends the message to all connected peers. It also displays the message in the chat
 * window and clears the input field.
 */
function sendMessage(msg) {
    console.log("Sending message...");
    let message;
    let messageData;
    const messageId = generateMessageId();

    const input = document.getElementById('message-input');
    if (msg === undefined) {
        message = input.value.trim();
        if (!message) return;
    } else {
        message = msg;
    }

    messageData = {
        type: 'chat',
        message: message,
        originalSender: peer.id,
        messageId: messageId
    };

    // Send to all connected peers
    connections.forEach(conn => conn.send(messageData));

    // Only display as "You" for manually sent messages, not system messages
    const displaySender = (msg === 'Disconnected' || msg === 'Connected') ? peer.id : 'You';
    displayMessage(message, displaySender);
    messagesSeen.add(messageId);
    
    if (input) {
        input.value = '';
    }
}


/**
 * Displays a message in the messages div.
 *
 * @param {string} message - The message to display.
 * @param {string} sender - The sender of the message. If the sender is the peer's ID, it will display the sender's ID. If the sender is 'You', it will display 'You'.
 */
function displayMessage(message, sender) {
    console.log("Displaying message...");
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('p');
    messageElement.className = 'chat';
    messageElement.textContent = `${sender === peer.id ? sender : sender === 'You' ? sender : sender}: ${message}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // if (message === 'Disconnected') {
    //     console.log("Disconnected message received");
    //     connections.delete(sender)
    // }
}

// Media
function loadMedia() {
    // Sort by bandwidth in descending order
    let sortedPeerList = new Map([...peerList.entries()].sort((a, b) => b[1].bandwidth - a[1].bandwidth));
    peerList = sortedPeerList;
    console.log(peerList);
    temp_list = new Set();

    peerList.forEach((value, key) => {
        if (bandwidth >= 1){
            value.isActive = true;
            temp_list.add(key);
            bandwidth -=1;
        }
    });
    // Stringify the Map
    let temp_peerList = JSON.stringify(Array.from(peerList));
    console.log("Streaming...");
    const preferredDisplaySurface = document.getElementById('displaySurface');
    const video = document.getElementById('player');
    const options = { audio: true, video: true };
    const stream_Id = generateMessageId();

    // Check if there is a display surface preference and adjust options accordingly
    if (preferredDisplaySurface) {
        const displaySurface = preferredDisplaySurface.options[preferredDisplaySurface.selectedIndex].value;
        if (displaySurface !== 'default') {
            options.video = { displaySurface };
        }
    }
    navigator.mediaDevices.getDisplayMedia(options)
    .then((stream) => {
        video.srcObject = stream;
        temp_list.forEach((peerId) => {
            const call = peer.call(peerId, stream, {
                metadata: { id: peer.id,
                            streamId: stream_Id,
                            peerList: temp_peerList,
                            timestamp: new Date().getTime() }
            });
            isHost = true;
            updateRoleIndicator();
            console.log("Stream transmitted to peer with ID = ",peerId);
          });
    });
}


window.onload = initPeer;

document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('message-input');
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    } else {
        console.error("Element with ID 'message-input' not found.");
    }
});



// Copy id to clipboard
/**
 * Copies the text content of the HTML element with the ID 'peer-id' to the clipboard.
 * Logs the text content to the console before copying.
 */
function copyId() {
    const to_clipboard = document.getElementById('peer-id');
    console.log("Copying to clipboard: '" + to_clipboard.textContent + "'");
    navigator.clipboard.writeText(to_clipboard.textContent);
}

// Utility function to create a delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeHost() {
    isHost = true;
    updateRoleIndicator();
}