let peer;
let connections = new Map(); // Store all peer connections
let isHost = false;
let hostConnection = null;
let messagesSeen = new Set(); // Track message IDs to prevent duplicates


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
    
    peer.on('open', (id) => {
        document.getElementById('peer-id').textContent = id;
        updateRoleIndicator();
    });

    // Handle incoming connections
    peer.on('connection', (conn) => {
        setupConnection(conn);
    });

    peer.on('call', (call) => {
        call.answer(localStream); // Answer the call with the local stream
        call.on('stream', remoteStream => {
            const remoteVideo = document.createElement('video');
            remoteVideo.autoplay = true;
            remoteVideo.srcObject = remoteStream;
            document.body.appendChild(remoteVideo); // Append to body or desired container
        });
    });
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
        //setupConnection(conn);
        hostConnection = conn;
        // Request current video state from the peer we're connecting to
        conn.send({
            type: 'request_video_state'
        });
    });

    conn.on('data', (data) => {
        console.log("setupConnection: data");
        handleIncomingData({...data}, conn.peer); // Clone the data to prevent modification
    });

    conn.on('close', () => {
        console.log("setupConnection: close");
        sendMessage('Disconnected'); // TODO: Send disconnect message
        //connections.delete(conn.peer);
        updateRoleIndicator();
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
        if (!messagesSeen.has(data.messageId)) {
            messagesSeen.add(data.messageId);
            // Display message with original sender
            displayMessage(data.message, data.originalSender);
            console.log("Received message: " + data.message + " from " + data.originalSender);
            if (data.message == 'Disconnected') {
                console.log("Disconnected message received from " + data.originalSender);
                removeConnection(data.originalSender);
            }
            // Relay the original unchanged message data
            relayData(originalData, receivedFrom);
        }
        break;
    case 'video_state':
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
            conn.send(data);
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

        messageData = {
            type: 'chat',
            message: message,
            originalSender: peer.id,
            messageId: messageId
        };
    } else {
        message = msg;
        messageData = {
            type: 'chat',
            message: message,
            originalSender: peer.id,
            messageId: messageId
        };
    }

    // Send to all connected peers
    connections.forEach(conn => conn.send(messageData));

    // Display own message
    displayMessage(message, 'You');
    messagesSeen.add(messageId);
    input.value = '';
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
function getMedia() {
    const preferredDisplaySurface = document.getElementById('displaySurface');
    const options = { audio: true, video: true };
    const displaySurface = preferredDisplaySurface.options[preferredDisplaySurface.selectedIndex].value;

    if (displaySurface !== 'default') {
        options.video = { displaySurface };
    }

    navigator.mediaDevices.getDisplayMedia(options)
        .then((stream) => {
            // Attach the stream to the video element
            const video = document.querySelector('video');
            video.srcObject = stream;

            // Share the stream with connected peers
            connections.forEach((conn) => {
                conn.send({
                    type: 'video_stream',
                    stream: stream
                });
            });

            // Detect when the user has stopped sharing the screen
            stream.getVideoTracks()[0].addEventListener('ended', () => {
                // Handle screen sharing stopped event
                alert('Screen sharing has ended. for real');
            });
        })
        .catch(handleError);
}



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

