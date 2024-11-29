require('dotenv').config();
const smpp = require('smpp');

// Load konfigurasi dari .env
const SERVER_PORT = process.env.SERVER_PORT || 5016;
const SERVER_USERNAME = process.env.SERVER_USERNAME;
const SERVER_PASSWORD = process.env.SERVER_PASSWORD;

// Hubungkan ke server SMPP
const session = smpp.connect({
    url: `smpp://localhost:${SERVER_PORT}`, 
    auto_enquire_link_period: 5000, 
    debug: true
}, function () {
    console.log('Connected to SMPP server for DR/DN test');

    // Bind sebagai transceiver
    session.bind_transceiver({
        system_id: SERVER_USERNAME,
        password: SERVER_PASSWORD
    }, function (pdu) {
        if (pdu.command_status === 0) {
            console.log('Successfully bound to SMPP server');

            // Kirim Delivery Receipt
            sendDeliveryReceipt(session);
        } else {
            console.error('Failed to bind:', pdu.command_status);
        }
    });
});

// Fungsi untuk mengirimkan Delivery Receipt
function sendDeliveryReceipt(session) {
    const dnPDU = {
        esm_class: 0x04, // Flag untuk DR/DN
        source_addr: '12345', // Nomor pengirim
        destination_addr: '628123456789', // Nomor tujuan
        short_message: `id:123456 stat:DELIVRD err:000 text:Delivery Report Test` // Format DR
    };

    console.log('Sending Delivery Receipt:', dnPDU);

    session.submit_sm(dnPDU, function (pdu) {
        if (pdu.command_status === 0) {
            console.log('Delivery Receipt sent successfully:', pdu);
        } else {
            console.error('Failed to send Delivery Receipt:', pdu.command_status);
        }

        // Tutup koneksi setelah selesai
        session.close();
    });
}

// Tangani error
session.on('error', function (error) {
    console.error('SMPP Client Error:', error);
});
