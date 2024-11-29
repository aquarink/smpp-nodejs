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

        // Filter only relevant PDU fields
        const relevantKeys = [
            "command_length",
            "command_id",
            "command_status",
            "sequence_number",
            "command",
            "service_type",
            "source_addr_ton",
            "source_addr_npi",
            "source_addr",
            "dest_addr_ton",
            "dest_addr_npi",
            "destination_addr",
            "esm_class",
            "protocol_id",
            "priority_flag",
            "schedule_delivery_time",
            "validity_period",
            "registered_delivery",
            "replace_if_present_flag",
            "data_coding",
            "sm_default_msg_id",
            "short_message",
        ];

        const filteredPDU = {};
        relevantKeys.forEach(key => {
            if (key in pdu) {
                filteredPDU[key] = pdu[key];
            }
        });

        // Flatten the short_message field if it exists
        if (filteredPDU.short_message && typeof filteredPDU.short_message === 'object') {
            for (const subKey in filteredPDU.short_message) {
                filteredPDU[`short_message[${subKey}]`] = filteredPDU.short_message[subKey];
            }
            delete filteredPDU.short_message;
        }

        // Convert filtered PDU to query string
        const queryData = new URLSearchParams(filteredPDU).toString();

        // Cek tipe pesan (MO atau DR/DN)
        if (pdu.esm_class === 0x04) {
            console.log('Delivery Receipt received');

            try {
                const response = await axios.get(`http://117.53.45.183/smpp/dn.php?${queryData}`);
                console.log('Forwarded DR/DN:', response.data);
            } catch (err) {
                console.error('Failed to forward DR/DN:', err.message);
            }
        } else { // MO
            console.log('Mobile Originated (MO) received');

            try {
                const response = await axios.get(`http://117.53.45.183/smpp/mo.php?${queryData}`);
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