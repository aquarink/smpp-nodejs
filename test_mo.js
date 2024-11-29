require('dotenv').config();
const smpp = require('smpp');

const SERVER = process.env.SERVER;
const SERVER_USERNAME = process.env.SERVER_USERNAME;
const SERVER_PASSWORD = process.env.SERVER_PASSWORD;

const session = smpp.connect({
    url: 'smpp://localhost:'+SERVER, 
    auto_enquire_link_period: 5000, 
    debug: true
}, function () {
    console.log('Connected to SMPP server');

    // Bind sebagai transceiver
    session.bind_transceiver({
        system_id: SERVER_USERNAME,
        password: SERVER_PASSWORD
    }, function (pdu) {
        if (pdu.command_status === 0) {
            console.log('Successfully bound to SMPP server');

            // Kirim SMS
            session.submit_sm({
                source_addr: '12345',           // Nomor pengirim
                destination_addr: '628123456789', // Nomor tujuan
                short_message: 'Test Message'    // Isi pesan
            }, function (pdu) {
                if (pdu.command_status === 0) {
                    console.log('Message sent successfully, Message ID:', pdu.message_id);
                } else {
                    console.error('Failed to send message:', pdu.command_status);
                }
            });
        } else {
            console.error('Failed to bind:', pdu.command_status);
        }
    });
});

// Tangani error
session.on('error', function (error) {
    console.error('SMPP Client Error:', error);
});