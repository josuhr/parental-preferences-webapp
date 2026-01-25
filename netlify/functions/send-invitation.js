// Netlify Function: Send Teacher Invitation Email
// This function sends invitation emails to teachers using Resend

const { Resend } = require('resend');

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
        
        // Check if Resend is configured
        if (!process.env.RESEND_API_KEY) {
            console.warn('RESEND_API_KEY not configured. Returning URL for manual sharing.');
            console.log('Teacher Invitation Request:');
            console.log('To:', email);
            console.log('From:', inviterName);
            console.log('Kid:', kidName);
            console.log('Access Level:', accessLevel);
            console.log('Invitation URL:', inviteUrl);
            
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: 'Invitation created successfully',
                    inviteUrl: inviteUrl,
                    note: 'Email service not configured. Share the invite URL manually.'
                })
            };
        }
        
        // Initialize Resend
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        // Send email
        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'Carer Support <onboarding@resend.dev>',
            to: email,
            subject: `${inviterName} invited you to Carer Support Platform`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px;">
                        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; padding: 40px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <h1 style="color: #667eea; font-size: 2rem; margin: 0 0 10px 0;">🎉 You've Been Invited!</h1>
                            </div>
                            
                            <div style="background: #f5f7fa; padding: 20px; border-radius: 12px; margin-bottom: 30px; text-align: center;">
                                <p style="color: #666; line-height: 1.6; margin: 10px 0;">
                                    <strong style="color: #333; font-size: 1.1rem;">${inviterName}</strong> has invited you to view
                                </p>
                                <p style="font-size: 1.3rem; color: #667eea; margin: 10px 0;">
                                    <strong>${kidName}'s</strong> activity preferences
                                </p>
                                <p style="color: #666; font-size: 0.9rem; margin: 10px 0;">
                                    Access Level: <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; background: #bee3f8; color: #2c5282; font-weight: bold;">${accessLevel}</span>
                                </p>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${inviteUrl}" style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 1.1rem;">
                                    Accept Invitation
                                </a>
                            </div>
                            
                            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                                <p style="color: #999; font-size: 0.9rem; margin: 10px 0;">
                                    ⏰ This invitation expires in 7 days
                                </p>
                                <p style="color: #999; font-size: 0.85rem; margin: 10px 0;">
                                    If the button doesn't work, copy this link:
                                </p>
                                <p style="color: #667eea; font-size: 0.8rem; word-break: break-all; margin: 10px 0;">
                                    ${inviteUrl}
                                </p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        });
        
        if (error) {
            console.error('Resend error:', error);
            throw error;
        }
        
        console.log('Email sent successfully via Resend:', data);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Invitation sent successfully!',
                emailId: data.id
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
