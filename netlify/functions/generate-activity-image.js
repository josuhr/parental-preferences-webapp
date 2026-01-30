// Generate kid-friendly activity illustration using DALL-E
// Caches generated images to avoid regenerating

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Check for OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'OpenAI API key not configured' })
        };
    }

    try {
        const { activityId, activityName, categoryName } = JSON.parse(event.body);

        if (!activityId || !activityName) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Activity ID and name are required' })
            };
        }

        // Initialize Supabase client
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Supabase not configured' })
            };
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Check if image already exists
        const { data: existingActivity } = await supabase
            .from('kid_activities')
            .select('illustration_url')
            .eq('id', activityId)
            .single();

        if (existingActivity?.illustration_url) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    imageUrl: existingActivity.illustration_url,
                    cached: true
                })
            };
        }

        // Generate image with DALL-E
        const prompt = `A cute, friendly cartoon illustration for children of the activity "${activityName}".
Style: Bright colors, simple shapes, cheerful and inviting, suitable for ages 4-6.
The illustration should be clear and easy to understand at a glance.
No text in the image. White or light pastel background.
Category: ${categoryName || 'fun activity'}`;

        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt: prompt,
                n: 1,
                size: '1024x1024',
                quality: 'standard',
                style: 'vivid'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('DALL-E API error:', errorData);
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'Failed to generate image',
                    details: errorData.error?.message || 'Unknown error'
                })
            };
        }

        const data = await response.json();
        const imageUrl = data.data[0]?.url;

        if (!imageUrl) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'No image URL returned' })
            };
        }

        // Store the image URL in the database
        const { error: updateError } = await supabase
            .from('kid_activities')
            .update({ illustration_url: imageUrl })
            .eq('id', activityId);

        if (updateError) {
            console.error('Error saving image URL:', updateError);
            // Still return the image even if we couldn't cache it
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                imageUrl: imageUrl,
                cached: false
            })
        };

    } catch (error) {
        console.error('Error generating activity image:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};
