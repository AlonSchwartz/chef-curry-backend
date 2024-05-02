import nodemailer from 'nodemailer'


/**
 * Sends an email in case of an error
 * @param {*} error the error object
 */
export const sendEmail = async (error) => {
    console.log("In send email")

    // Create a transporter using SMTP
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.ADMIN_EMAIL,
            pass: process.env.EMAIL_APP_PASS
        },
    });
    try {
        let info = await transporter.sendMail({
            from: process.env.ADMIN_EMAIL,
            to: process.env.ADMIN_EMAIL,
            subject: error.name + ' occurred: ' + error.message,
            text: error.stack,
        });

        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.error('Error occurred while sending email:', error);
    }
}