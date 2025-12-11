// debug-resend.js
require('dotenv').config();
const { Resend } = require('resend');

async function debugResend() {
    console.log('=== DEBUG RESEND CONFIGURATION ===\n');

    // Log environment variables
    console.log('Environment Variables:');
    console.log(`RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✓ Set' : '✗ Missing'}`);
    console.log(`RESEND_FROM_EMAIL: "${process.env.RESEND_FROM_EMAIL}"`);
    console.log(`RESEND_FROM_NAME: "${process.env.RESEND_FROM_NAME}"`);

    // Test email extraction
    const emailConfig = process.env.RESEND_FROM_EMAIL || '';
    let pureEmail = emailConfig;

    if (emailConfig.includes('<') && emailConfig.includes('>')) {
        const match = emailConfig.match(/<([^>]+)>/);
        pureEmail = match ? match[1].trim() : emailConfig;
    }

    console.log(`\nExtracted Email: "${pureEmail}"`);

    // Test Resend API
    console.log('\n=== Testing Resend API ===');

    try {
        const resend = new Resend(process.env.RESEND_API_KEY);

        const testFormats = [
            `${process.env.RESEND_FROM_NAME} <${pureEmail}>`,
            pureEmail,
            'WargaApp <noreply@canadev.my.id>',
            'onboarding@resend.dev'
        ];

        for (const format of testFormats) {
            console.log(`\nTesting format: "${format}"`);

            try {
                const { data, error } = await resend.emails.send({
                    from: format,
                    to: 'nabilkencana20@gmail.com',
                    subject: 'Debug Test Email',
                    html: '<p>Testing email configuration</p>',
                    text: 'Testing email configuration',
                });

                if (error) {
                    console.error(`  ❌ Error: ${error.message}`);
                    console.error(`     Code: ${error.statusCode}`);
                } else {
                    console.log(`  ✅ Success! Email ID: ${data.id}`);
                }
            } catch (err) {
                console.error(`  ⚠️ Exception: ${err.message}`);
            }
        }

    } catch (error) {
        console.error('Failed to initialize Resend:', error.message);
    }
}

debugResend();