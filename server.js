require('dotenv').config();
const smpp = require('smpp');
const axios = require('axios');

const SERVER = process.env.SERVER;
const SERVER_USERNAME = process.env.SERVER_USERNAME;
const SERVER_PASSWORD = process.env.SERVER_PASSWORD;

// Membuat SMPP server
const server = smpp.createServer(function (session) {
    console.log('New connection established');

    session.on('close', function () {
        console.log('Client disconnected.');
    });

    // Tangani error
    session.on('error', function (err) {
        console.error('SMPP Session Error:', err);
    });

    // Tangani bind_transceiver permintaan
    session.on('bind_transceiver', function (pdu) {
        console.log('Received bind_transceiver request');
        session.pause();

        // Verifikasi kredensial
        const validUser = pdu.system_id === SERVER_USERNAME && pdu.password === SERVER_PASSWORD;
        if (!validUser) {
            console.log('Invalid credentials');
            session.send(pdu.response({
                command_status: smpp.ESME_RBINDFAIL
            }));
            session.close();
            return;
        }

        session.send(pdu.response());
        console.log('Client bound successfully');
        session.resume();
    });

    // Tangani submit_sm untuk MO atau DR/DN
    session.on('submit_sm', async function (pdu) {
        console.log('Received submit_sm:', pdu);

        let srtMessage = '';
        if (typeof pdu.short_message === 'object' && pdu.short_message.message) {
            srtMessage = pdu.short_message.message; // Ambil isi dari objek
        } else {
            srtMessage = pdu.short_message; // Jika bukan objek, ambil langsung
        }

        // Cek tipe pesan (MO atau DR/DN)
        if (pdu.esm_class === 0x04) { // DR/DN
            console.log('Delivery Receipt received');

            // Ekstrak data dari short_message untuk DR/DN
            const idMatch = srtMessage.match(/id:(\S+)/);
            const statMatch = srtMessage.match(/stat:(\S+)/);

            const drData = {
                id: idMatch ? idMatch[1] : 'unknown', // ID pesan
                status: statMatch ? statMatch[1] : 'unknown', // Status pesan
                source: pdu.source_addr, // Nomor pengirim
                destination: pdu.destination_addr // Nomor tujuan
            };

            const queryStringDn = new URLSearchParams(drData).toString();

            try {
                const response = await axios.get(`http://117.53.45.183/smpp/dn.php?${queryStringDn}`);
                console.log('Forwarded DR/DN:', response.data);
            } catch (err) {
                console.error('Failed to forward DR/DN:', err.message);
            }
        } else { // MO
            console.log('Mobile Originated (MO) received');
            
            const moData = {
                source: pdu.source_addr, // Nomor pengirim
                destination: pdu.destination_addr, // Nomor tujuan
                message: srtMessage // Isi pesan
            };

            const queryStringMo = new URLSearchParams(moData).toString();

            try {
                const response = await axios.get(`http://117.53.45.183/smpp/mo.php?${queryStringMo}`);
                console.log('Forwarded MO:', response.data);
            } catch (err) {
                console.error('Failed to forward MO:', err.message);
            }
        }

        // Kirim respon
        session.send(pdu.response());
    });
});

// Mulai server
server.listen(SERVER, function () {
    console.log('SMPP open on port '+SERVER);
});