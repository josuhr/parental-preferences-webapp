// Netlify Function: Suggest Activities based on household preferences
// Uses OpenAI GPT-4o to suggest new activities based on family preference patterns

const OpenAI = require('openai');

exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        let requestData;
        try {
            requestData = JSON.parse(event.body);
        } catch (parseError) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid request format',
                    message: 'Could not parse request body as JSON'
                })
            };
        }

        // Validate required fields
        if (!requestData || !requestData.categories || requestData.categories.length === 0) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Missing required data (categories)',
                    message: 'Please ensure categories are provided'
                })
            };
        }

        // Check if OpenAI is configured
        if (!process.env.OPENAI_API_KEY) {
            console.warn('OPENAI_API_KEY not configured');
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'AI service not configured',
                    message: 'Please configure the OPENAI_API_KEY environment variable to enable AI suggestions.'
                })
            };
        }

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Build the prompt
        const systemPrompt = `You are a helpful family activity advisor. Based on a family's existing activity preferences, suggest NEW activities they would likely enjoy.

IMPORTANT RULES:
1. Suggest 5-8 NEW activities that are NOT already in their list
2. Each suggestion must fit into one of the provided categories
3. Consider patterns in what caregivers and kids enjoy
4. Suggestions should be age-appropriate and practical for families
5. Be creative but realistic - activities should be doable at home or locally

OUTPUT FORMAT - Return ONLY a valid JSON array with no additional text:
[
  {
    "category": "Category Name (must match one of the provided categories exactly)",
    "name": "Activity Name",
    "description": "Brief 1-sentence description of the activity",
    "reasoning": "Brief explanation of why this family would enjoy this based on their preferences"
  }
]`;

        const userPrompt = buildUserPrompt(requestData);

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 1500,
            temperature: 0.8
        });

        const responseText = completion.choices[0]?.message?.content;

        if (!responseText) {
            throw new Error('No response generated from AI');
        }

        // Parse the JSON response
        let suggestions;
        try {
            // Extract JSON from the response (handle potential markdown code blocks)
            let jsonText = responseText.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.slice(7);
            }
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.slice(3);
            }
            if (jsonText.endsWith('```')) {
                jsonText = jsonText.slice(0, -3);
            }
            suggestions = JSON.parse(jsonText.trim());
        } catch (parseError) {
            console.error('Failed to parse AI response:', responseText);
            throw new Error('Invalid response format from AI');
        }

        // Validate suggestions structure
        if (!Array.isArray(suggestions)) {
            throw new Error('AI response is not an array');
        }

        // Validate and clean each suggestion
        const validCategories = requestData.categories.map(c => c.name);
        suggestions = suggestions.filter(s => {
            return s.category && s.name && s.description && s.reasoning &&
                   validCategories.includes(s.category);
        });

        console.log(`Successfully generated ${suggestions.length} activity suggestions`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                suggestions: suggestions
            })
        };

    } catch (error) {
        console.error('Error generating activity suggestions:', error);

        // Handle specific OpenAI errors
        if (error.status === 429) {
            return {
                statusCode: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Rate limit exceeded',
                    message: 'Too many requests. Please try again in a moment.'
                })
            };
        }

        if (error.status === 401) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'AI service configuration error',
                    message: 'There was an issue with the AI service configuration.'
                })
            };
        }

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to generate suggestions',
                message: error.message || 'An unexpected error occurred'
            })
        };
    }
};

/**
 * Build the user prompt from request data
 */
function buildUserPrompt(data) {
    let prompt = 'Please suggest new activities for this family based on their preferences.\n\n';

    // Available categories
    prompt += '**Available Categories:**\n';
    data.categories.forEach(cat => {
        prompt += `- ${cat.name} (${cat.icon})\n`;
    });
    prompt += '\n';

    // Current activities
    if (data.householdActivities && data.householdActivities.length > 0) {
        prompt += '**Current Household Activities:**\n';
        data.householdActivities.forEach(activity => {
            prompt += `- ${activity.name} (${activity.category})`;
            if (activity.description) {
                prompt += `: ${activity.description}`;
            }
            prompt += '\n';
        });
        prompt += '\n';
    } else {
        prompt += '**Current Household Activities:** None yet - this family is just getting started!\n\n';
    }

    // Caregiver preferences
    if (data.preferences) {
        const hasPrefs = data.preferences.drop_anything?.length > 0 ||
                         data.preferences.sometimes?.length > 0 ||
                         data.preferences.on_your_own?.length > 0;

        if (hasPrefs) {
            prompt += '**Caregiver Preferences:**\n';

            if (data.preferences.drop_anything && data.preferences.drop_anything.length > 0) {
                prompt += `- "Drop Everything" favorites: ${data.preferences.drop_anything.join(', ')}\n`;
            }
            if (data.preferences.sometimes && data.preferences.sometimes.length > 0) {
                prompt += `- "Sometimes" activities: ${data.preferences.sometimes.join(', ')}\n`;
            }
            if (data.preferences.on_your_own && data.preferences.on_your_own.length > 0) {
                prompt += `- "On Your Own" activities: ${data.preferences.on_your_own.join(', ')}\n`;
            }
            prompt += '\n';
        }
    }

    // Kid preferences
    if (data.kidPreferences && Object.keys(data.kidPreferences).length > 0) {
        prompt += '**Kid Preferences:**\n';

        Object.entries(data.kidPreferences).forEach(([kidName, prefs]) => {
            prompt += `\n${kidName}:\n`;
            if (prefs.loves && prefs.loves.length > 0) {
                prompt += `  - Loves: ${prefs.loves.join(', ')}\n`;
            }
            if (prefs.likes && prefs.likes.length > 0) {
                prompt += `  - Likes: ${prefs.likes.join(', ')}\n`;
            }
            if (prefs.neutral && prefs.neutral.length > 0) {
                prompt += `  - Not interested: ${prefs.neutral.join(', ')}\n`;
            }
            if (prefs.refuses && prefs.refuses.length > 0) {
                prompt += `  - Not yet tried: ${prefs.refuses.join(', ')}\n`;
            }
        });
        prompt += '\n';
    }

    prompt += 'Based on these patterns, suggest 5-8 NEW activities that would be great fits for this family. Return ONLY valid JSON.';

    return prompt;
}
