require('dotenv').config();
const smpp = require('smpp');
const express = require('express');
const { body, validationResult } = require('express-validator');

const HOST = process.env.HOST;
const ENQUIRE = process.env.ENQUIRE || 5000;
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
const SENDER = process.env.SENDER || '8080';
const PORT = process.env.PORT || 3000;

let session;
let enquireInterval;
let isSessionActive = false;

function connectToSmpp() {
    session = smpp.connect({ url: HOST, auto_enquire_link_period: ENQUIRE, debug: true }, () => {
        console.log('Connected to SMPP server');

        session.bind_transceiver({ system_id: USERNAME, password: PASSWORD }, (pdu) => {
            console.log("Data pdu >> ")
            console.log(pdu)
            if (pdu.command_status === 0) {
                console.log('Successfully bound to SMPP server');
            } else {
                console.error('Failed to bind:', pdu.command_status);
            }
        });
    });

    session.on('error', (error) => {
        console.error('SMPP Client Error:', error);
        clearInterval(enquireInterval);
    });

    session.on('close', () => {
        console.log('SMPP session closed');
        clearInterval(enquireInterval);
    });

    session.on('enquire_link', () => {
        console.log('Received enquire_link');
        session.send_enquire_link();
    });

    session.on('connect', () => {
        console.log('SMPP session connected');
        enquireInterval = setInterval(() => {
            if (session && session.state === 'open') {
                console.log('Sending enquire_link...');
                session.send_enquire_link();
            } else {
                console.error('Session not active for enquire_link '+session.state);
            }
        }, ENQUIRE);
    });
}

// Mulai koneksi ke SMPP
connectToSmpp();

const app = express();
app.use(express.json());

app.post('/mt', [
    body('destination').isMobilePhone().withMessage('Invalid destination number'),
    body('source').notEmpty().withMessage('Source is required'),
    body('message').notEmpty().withMessage('Message cannot be empty')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { destination, source, message } = req.body;

    console.log('Received MT request:', req.body);

    if (session && !session.closed) {
        session.submit_sm({
            source_addr: source || SENDER,
            destination_addr: destination,
            short_message: message
        }, (pdu) => {
            if (pdu.command_status === 0) {
                console.log('MT sent successfully, Message ID:', pdu.message_id);
                res.status(200).send({ message_id: pdu.message_id });
            } else {
                console.error('Failed to send MT:', pdu.command_status);
                res.status(500).send('Failed to send MT');
            }
        });
    } else {
        res.status(500).send('SMPP session not active');
        console.log(session);
    }    
});

app.listen(PORT, () => {
    console.log(`HTTP server for MT listening on port ${PORT}`);
});