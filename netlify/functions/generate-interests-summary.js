// Netlify Function: Generate AI Interests Summary for a Kid
// Uses OpenAI GPT-4o to create a personalized summary of a child's interests

const OpenAI = require('openai');

exports.handler = async (event, context) => {
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

    try {
        const kidContext = JSON.parse(event.body);

        // Validate required fields
        if (!kidContext || !kidContext.kidName) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing required kid context data' })
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
                    message: 'Please configure the OPENAI_API_KEY environment variable to enable AI summaries.'
                })
            };
        }

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Build the prompt with kid context
        const systemPrompt = `You are a warm and insightful child development specialist helping parents understand their children's interests and preferences.

Your task is to analyze the provided data about a child's activity preferences and create a structured, helpful summary.

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:

## Overview
Write 2-3 sentences providing a warm, insightful overview of the child's interests and what makes them unique. Note any patterns you observe (e.g., preference for creative activities, outdoor play, social activities, etc.).

## Top Favorite Activities
List up to 5 of their most loved/liked activities as bullet points. For each, add a brief insight about why this might appeal to them or how it benefits their development.

## Patterns & Insights
Write 2-3 sentences about patterns you notice in their preferences. What themes emerge? What does this suggest about their personality or developmental stage?

## Recommended Activities to Try
Based on what they love, suggest 3-5 NEW activities they haven't tried yet that they would likely enjoy. Be specific and explain briefly why each would be a good fit.

## Tips for Caregivers
Provide 2-3 practical tips for parents/caregivers based on this child's interests.

---
Keep the tone warm, encouraging, and constructive. If there's limited data, acknowledge this while still providing useful insights.`;

        const userPrompt = buildUserPrompt(kidContext);

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 1200,
            temperature: 0.7
        });

        const summary = completion.choices[0]?.message?.content;

        if (!summary) {
            throw new Error('No summary generated from AI');
        }

        console.log(`Successfully generated interests summary for ${kidContext.kidName}`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                summary: summary,
                kidName: kidContext.kidName
            })
        };

    } catch (error) {
        console.error('Error generating interests summary:', error);

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
                error: 'Failed to generate summary',
                message: error.message || 'An unexpected error occurred'
            })
        };
    }
};

/**
 * Build the user prompt from kid context data
 */
function buildUserPrompt(context) {
    let prompt = `Please create an interests summary for ${context.kidName}`;
    
    if (context.age) {
        prompt += `, who is ${context.age} years old`;
    }
    prompt += '.\n\n';

    // Add preference counts
    if (context.preferenceCounts) {
        prompt += '**Preference Summary:**\n';
        prompt += `- Activities they LOVE: ${context.preferenceCounts.loves || 0}\n`;
        prompt += `- Activities they LIKE: ${context.preferenceCounts.likes || 0}\n`;
        prompt += `- Neutral activities: ${context.preferenceCounts.neutral || 0}\n`;
        prompt += `- Activities they DISLIKE: ${context.preferenceCounts.dislikes || 0}\n`;
        prompt += `- Activities they REFUSE: ${context.preferenceCounts.refuses || 0}\n\n`;
    }

    // Add loved activities with categories
    if (context.lovedActivities && context.lovedActivities.length > 0) {
        prompt += '**Activities They LOVE:**\n';
        context.lovedActivities.forEach(activity => {
            prompt += `- ${activity.name}`;
            if (activity.category) {
                prompt += ` (${activity.category})`;
            }
            if (activity.description) {
                prompt += `: ${activity.description}`;
            }
            prompt += '\n';
        });
        prompt += '\n';
    }

    // Add liked activities
    if (context.likedActivities && context.likedActivities.length > 0) {
        prompt += '**Activities They LIKE:**\n';
        context.likedActivities.forEach(activity => {
            prompt += `- ${activity.name}`;
            if (activity.category) {
                prompt += ` (${activity.category})`;
            }
            prompt += '\n';
        });
        prompt += '\n';
    }

    // Add disliked/refused activities (for context on what to avoid)
    if (context.dislikedActivities && context.dislikedActivities.length > 0) {
        prompt += '**Activities They Tend to Avoid:**\n';
        context.dislikedActivities.forEach(activity => {
            prompt += `- ${activity.name}`;
            if (activity.category) {
                prompt += ` (${activity.category})`;
            }
            prompt += '\n';
        });
        prompt += '\n';
    }

    // Add teacher observations if available
    if (context.teacherObservations && context.teacherObservations.length > 0) {
        prompt += '**Teacher Observations:**\n';
        context.teacherObservations.forEach(obs => {
            prompt += `- [${obs.type}] ${obs.title}`;
            if (obs.description) {
                prompt += `: ${obs.description}`;
            }
            prompt += '\n';
        });
        prompt += '\n';
    }

    // Add parent notes if available
    if (context.parentNotes) {
        prompt += `**Parent Notes:** ${context.parentNotes}\n\n`;
    }

    // Add categories with most preferences
    if (context.topCategories && context.topCategories.length > 0) {
        prompt += '**Most Active Categories:**\n';
        context.topCategories.forEach(cat => {
            prompt += `- ${cat.name}: ${cat.count} activities\n`;
        });
        prompt += '\n';
    }

    prompt += 'Please create a structured interests summary following the format specified in your instructions. Include the Top Favorite Activities, Patterns & Insights, Recommended Activities to Try, and Tips for Caregivers sections.';

    return prompt;
}
