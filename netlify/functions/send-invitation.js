// Netlify Function: Send Teacher Invitation Email
// This function sends invitation emails to teachers

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const { email, token, kidName, inviterName, accessLevel } = JSON.parse(event.body);
        
        // Validate required fields
        if (!email || !token || !kidName) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }
        
        const inviteUrl = `${process.env.URL || 'https://carer-support.netlify.app'}/teacher-invite.html?token=${token}`;
        
        // For now, we'll return success and log the invitation details
        // In production, you would integrate with SendGrid, Mailgun, etc.
        
        console.log('Teacher Invitation Request:');
        console.log('To:', email);
        console.log('From:', inviterName);
        console.log('Kid:', kidName);
        console.log('Access Level:', accessLevel);
        console.log('Invitation URL:', inviteUrl);
        
        // TODO: Integrate with email service
        // Example with SendGrid:
        /*
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        
        const msg = {
            to: email,
            from: 'noreply@carer-support.netlify.app',
            subject: `${inviterName} invited you to Carer Support Platform`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #667eea;">You've been invited!</h1>
                    <p>${inviterName} has invited you to view <strong>${kidName}'s</strong> activity preferences on the Carer Support Platform.</p>
                    <p><strong>Access Level:</strong> ${accessLevel}</p>
                    <div style="margin: 30px 0;">
                        <a href="${inviteUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                            Accept Invitation
                        </a>
                    </div>
                    <p style="color: #999; font-size: 0.9rem;">This invitation expires in 7 days.</p>
                    <p style="color: #999; font-size: 0.85rem;">If the button doesn't work, copy this link: ${inviteUrl}</p>
                </div>
            `
        };
        
        await sgMail.send(msg);
        */
        
        // For development/testing, return the invitation URL
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Invitation created successfully',
                // Include URL for development - remove in production
                inviteUrl: inviteUrl,
                note: 'Email service not configured yet. Share the invite URL manually.'
            })
        };
        
    } catch (error) {
        console.error('Error sending invitation:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to send invitation',
                message: error.message
            })
        };
    }
};
