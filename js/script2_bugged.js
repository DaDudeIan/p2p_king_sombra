let peer;
let connections = new Map(); // Store all peer connections
let localStream; // Store the local media stream

function initPeer() {
    peer = new Peer();

    peer.on('open', (id) => {
        document.getElementById('peer-id').textContent = id;
    });

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

function getMedia() {
    const options = { video: true, audio: true };
    navigator.mediaDevices.getDisplayMedia(options)
        .then(stream => {
            localStream = stream;
            document.getElementById('player').srcObject = stream;

            // Notify all connected peers about the new stream
            connections.forEach(conn => {
                const call = peer.call(conn.peer, localStream);
                call.on('stream', remoteStream => {
                    const remoteVideo = document.createElement('video');
                    remoteVideo.autoplay = true;
                    remoteVideo.srcObject = remoteStream;
                    document.body.appendChild(remoteVideo); // Append to body or desired container
                });
            });

            stream.getVideoTracks()[0].addEventListener('ended', () => {
                alert('Screen sharing has ended.');
            });
        })
        .catch(error => {
            console.error('Error accessing media devices.', error);
        });
}

function setupConnection(conn) {
    connections.set(conn.peer, conn);

    conn.on('data', data => {
        handleIncomingData(data);
    });

    conn.on('close', () => {
        connections.delete(conn.peer);
    });
}

function connectToPeer() {
    const connectId = document.getElementById('peer-id-input').value;
    if (!connectId || connectId === peer.id) return;

    const conn = peer.connect(connectId);
    setupConnection(conn);
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message) return;

    const messageData = {
        type: 'chat',
        message: message,
        sender: peer.id
    };

    // Send to all connected peers
    connections.forEach(conn => conn.send(messageData));

    // Display own message
    displayMessage(message, 'You');
    input.value = '';
}

function handleIncomingData(data) {
    if (data.type === 'chat') {
        displayMessage(data.message, data.sender);
    }
}

function displayMessage(message, sender) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('p');
    messageElement.textContent = `${sender}: ${message}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function copyId() {
    const to_clipboard = document.getElementById('peer-id');
    navigator.clipboard.writeText(to_clipboard.textContent).then(() => {
        console.log("Copied to clipboard: " + to_clipboard.textContent);
    });
}

// Initialization
window.onload = initPeer;

document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
