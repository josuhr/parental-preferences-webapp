-- Populate Activity Context Mappings
-- This script maps universal activities to their appropriate contexts
-- Run in Supabase SQL editor after the activities and contexts have been created

-- First ensure the recommendation_contexts exist
INSERT INTO public.recommendation_contexts (name, description, context_type, attributes) VALUES
    ('Morning Energy', 'High-energy activities perfect for morning time', 'time_of_day', '{"time_range": "6:00-11:00", "energy": "high"}'::jsonb),
    ('Afternoon Calm', 'Moderate activities for afternoon', 'time_of_day', '{"time_range": "12:00-16:00", "energy": "medium"}'::jsonb),
    ('Evening Wind-Down', 'Calm activities before bedtime', 'time_of_day', '{"time_range": "17:00-20:00", "energy": "low"}'::jsonb),
    ('Rainy Day', 'Indoor activities for rainy weather', 'weather', '{"conditions": "rainy", "location": "indoor"}'::jsonb),
    ('Sunny Day', 'Outdoor activities for nice weather', 'weather', '{"conditions": "sunny", "location": "outdoor"}'::jsonb),
    ('High Energy', 'Activities requiring lots of energy', 'energy_level', '{"energy": "high", "physical": true}'::jsonb),
    ('Low Energy', 'Calm, quiet activities', 'energy_level', '{"energy": "low", "physical": false}'::jsonb),
    ('Solo Play', 'Activities kids can do alone', 'group_size', '{"participants": 1}'::jsonb),
    ('Small Group', 'Activities for 2-4 kids', 'group_size', '{"participants": "2-4"}'::jsonb),
    ('Large Group', 'Activities for 5+ kids', 'group_size', '{"participants": "5+"}'::jsonb),
    ('Quick Activity', 'Activities under 15 minutes', 'duration', '{"minutes": 15}'::jsonb),
    ('Extended Activity', 'Activities 30+ minutes', 'duration', '{"minutes": 30}'::jsonb),
    ('Indoor', 'Activities best done inside', 'location', '{"location": "indoor"}'::jsonb),
    ('Outdoor', 'Activities best done outside', 'location', '{"location": "outdoor"}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ARTS & CRAFTS Activities - Context Mappings
-- ============================================================================
-- Arts & Crafts are generally: Indoor, Low-Medium Energy, Solo or Small Group

INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 
    CASE 
        WHEN rc.name = 'Indoor' THEN 0.95
        WHEN rc.name = 'Rainy Day' THEN 0.90
        WHEN rc.name = 'Low Energy' THEN 0.85
        WHEN rc.name = 'Solo Play' THEN 0.80
        WHEN rc.name = 'Afternoon Calm' THEN 0.75
        WHEN rc.name = 'Evening Wind-Down' THEN 0.70
        WHEN rc.name = 'Extended Activity' THEN 0.80
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'Maker / Tech Tinkering', 'Model Building', 'SnapCircuits', 'Coloring',
    'Watercolor Painting', 'Drawing', 'Woodworking', 'Playdough', 'Complex Crafts',
    'Hidden Picture Stickers', 'Grow & Glow Terrarium', 'Sticker by Numbers',
    'DIY Projects', 'Glue & Glitter Crafts', 'Origami', 'Clay Sculpting',
    'Beading & Jewelry Making'
)
AND rc.name IN ('Indoor', 'Rainy Day', 'Low Energy', 'Solo Play', 'Afternoon Calm', 'Evening Wind-Down', 'Extended Activity')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Quick crafts (Coloring, Stickers, Origami)
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.85
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Coloring', 'Hidden Picture Stickers', 'Sticker by Numbers', 'Origami')
AND rc.name = 'Quick Activity'
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- ============================================================================
-- EXPERIENTIAL Activities - Context Mappings
-- ============================================================================

-- OUTDOOR Experiential Activities
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id,
    CASE 
        WHEN rc.name = 'Outdoor' THEN 0.95
        WHEN rc.name = 'Sunny Day' THEN 0.90
        WHEN rc.name = 'High Energy' THEN 0.85
        WHEN rc.name = 'Morning Energy' THEN 0.80
        WHEN rc.name = 'Extended Activity' THEN 0.85
        WHEN rc.name = 'Small Group' THEN 0.75
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'Drone Flying', 'Remote Control Cars', 'Sporting Events', 'Zoo Visits',
    'Boating & Water Activities', 'Festivals & Markets', 'Nature Walks',
    'Biking & Scootering', 'Playing Sports', 'Mini Golf', 'Outdoor Free Play',
    'Gardening', 'TopGolf'
)
AND rc.name IN ('Outdoor', 'Sunny Day', 'High Energy', 'Morning Energy', 'Extended Activity', 'Small Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- INDOOR Experiential Activities
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id,
    CASE 
        WHEN rc.name = 'Indoor' THEN 0.95
        WHEN rc.name = 'Rainy Day' THEN 0.90
        WHEN rc.name = 'High Energy' THEN 0.85
        WHEN rc.name = 'Extended Activity' THEN 0.80
        WHEN rc.name = 'Small Group' THEN 0.80
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'Live Music & Theater', 'Art Museums', 'Science Museums', 'Bouncy House',
    'Kids Museums', 'Rush Funplex', 'Play Places', 'Legoland',
    'Aquarium Visits', 'Arcades', 'Indoor Free Play', 'Library Visits'
)
AND rc.name IN ('Indoor', 'Rainy Day', 'High Energy', 'Extended Activity', 'Small Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Calm Indoor Experiential
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id,
    CASE 
        WHEN rc.name = 'Indoor' THEN 0.90
        WHEN rc.name = 'Rainy Day' THEN 0.85
        WHEN rc.name = 'Low Energy' THEN 0.80
        WHEN rc.name = 'Afternoon Calm' THEN 0.80
        WHEN rc.name = 'Small Group' THEN 0.85
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Art Museums', 'Library Visits', 'Aquarium Visits', 'Cooking Together')
AND rc.name IN ('Indoor', 'Rainy Day', 'Low Energy', 'Afternoon Calm', 'Small Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Travel/Special Event Activities
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.85
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Travel Adventures', 'Monster Truck Rally', 'Legoland')
AND rc.name IN ('Extended Activity', 'Small Group', 'Large Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- ============================================================================
-- GAMES: Board, Card, Pretend - Context Mappings
-- ============================================================================

-- Board/Card Games - Indoor, various energy levels
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id,
    CASE 
        WHEN rc.name = 'Indoor' THEN 0.95
        WHEN rc.name = 'Rainy Day' THEN 0.90
        WHEN rc.name = 'Small Group' THEN 0.90
        WHEN rc.name = 'Afternoon Calm' THEN 0.80
        WHEN rc.name = 'Evening Wind-Down' THEN 0.75
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'Ticket to Ride First Journey', 'Catan Junior', 'Life Junior', 'Candy Land',
    'Sneaky Snacky Squirrel', 'Connect Four', 'Memory', 'Simon', 'Yahtzee',
    'Uno', 'Go Fish', 'Jenga'
)
AND rc.name IN ('Indoor', 'Rainy Day', 'Small Group', 'Afternoon Calm', 'Evening Wind-Down')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Quick Games
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.90
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Tic-Tac-Toe', 'Memory', 'Go Fish', 'Uno', 'Connect Four')
AND rc.name = 'Quick Activity'
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Extended Games
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.90
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'Ticket to Ride First Journey', 'Catan Junior', 'Life Junior', 
    'Jigsaw Puzzles', 'LEGO Building', 'Model Trains', 'Slot Cars'
)
AND rc.name = 'Extended Activity'
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Solo Play Games
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.90
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'Jigsaw Puzzles', 'LEGO Building', 'Model Trains', 'Collecting',
    'Hot Wheels Racing', 'Slot Cars'
)
AND rc.name IN ('Solo Play', 'Low Energy')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Active Games
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.85
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Hide and Seek', 'Charades', 'Pretend Play')
AND rc.name IN ('High Energy', 'Morning Energy', 'Small Group', 'Large Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Hide and Seek can be indoor or outdoor
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.80
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name = 'Hide and Seek'
AND rc.name IN ('Indoor', 'Outdoor')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- ============================================================================
-- MOVIES & TV - Context Mappings
-- ============================================================================

INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id,
    CASE 
        WHEN rc.name = 'Indoor' THEN 0.95
        WHEN rc.name = 'Rainy Day' THEN 0.95
        WHEN rc.name = 'Low Energy' THEN 0.90
        WHEN rc.name = 'Evening Wind-Down' THEN 0.90
        WHEN rc.name = 'Afternoon Calm' THEN 0.80
        WHEN rc.name = 'Solo Play' THEN 0.70
        WHEN rc.name = 'Small Group' THEN 0.85
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'Sports on TV', 'Star Wars Shows', 'Sesame Street', 'Mr Rogers Neighborhood',
    'Full Movies Together', 'Story-Based TV Shows', 'Nature Documentaries',
    'Pixar Shorts', 'Disney Movies', 'Superhero Movies', 'Animated Series'
)
AND rc.name IN ('Indoor', 'Rainy Day', 'Low Energy', 'Evening Wind-Down', 'Afternoon Calm', 'Solo Play', 'Small Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Quick TV (Shorts, Episodes)
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.90
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Pixar Shorts', 'Sesame Street', 'Story-Based TV Shows', 'Animated Series')
AND rc.name = 'Quick Activity'
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Extended TV (Full Movies)
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.95
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Full Movies Together', 'Disney Movies', 'Superhero Movies', 'Nature Documentaries')
AND rc.name = 'Extended Activity'
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- ============================================================================
-- MUSIC - Context Mappings
-- ============================================================================

-- Active Music Activities
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id,
    CASE 
        WHEN rc.name = 'High Energy' THEN 0.90
        WHEN rc.name = 'Morning Energy' THEN 0.85
        WHEN rc.name = 'Indoor' THEN 0.90
        WHEN rc.name = 'Small Group' THEN 0.85
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Dance Party', 'Singing Together', 'Playing Music Together')
AND rc.name IN ('High Energy', 'Morning Energy', 'Indoor', 'Small Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Calm Music Activities
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id,
    CASE 
        WHEN rc.name = 'Low Energy' THEN 0.90
        WHEN rc.name = 'Evening Wind-Down' THEN 0.85
        WHEN rc.name = 'Afternoon Calm' THEN 0.85
        WHEN rc.name = 'Indoor' THEN 0.90
        WHEN rc.name = 'Rainy Day' THEN 0.85
        WHEN rc.name = 'Solo Play' THEN 0.80
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Listening to Music', 'Kids Songs', 'Exploring New Songs', 'Music Videos', 'Learning an Instrument')
AND rc.name IN ('Low Energy', 'Evening Wind-Down', 'Afternoon Calm', 'Indoor', 'Rainy Day', 'Solo Play')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Car Music
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.70
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name = 'Car Music Mix'
AND rc.name IN ('Quick Activity', 'Extended Activity', 'Small Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Live Music is outdoor-capable
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.85
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name = 'Live Music Events'
AND rc.name IN ('Outdoor', 'Sunny Day', 'Extended Activity', 'Small Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- ============================================================================
-- READING & EDUCATIONAL - Context Mappings
-- ============================================================================

INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id,
    CASE 
        WHEN rc.name = 'Indoor' THEN 0.95
        WHEN rc.name = 'Rainy Day' THEN 0.95
        WHEN rc.name = 'Low Energy' THEN 0.90
        WHEN rc.name = 'Evening Wind-Down' THEN 0.90
        WHEN rc.name = 'Afternoon Calm' THEN 0.85
        WHEN rc.name = 'Solo Play' THEN 0.80
        WHEN rc.name = 'Small Group' THEN 0.75
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'A Christmas Carol', 'The Hobbit', 'Beatrix Potter Books', 'The Birds of Bethlehem',
    'Bluey Books', 'Chapter Books', 'Learn to Read Books', 'Math Games',
    'Geography Exploration', 'History Stories', 'Educational Apps'
)
AND rc.name IN ('Indoor', 'Rainy Day', 'Low Energy', 'Evening Wind-Down', 'Afternoon Calm', 'Solo Play', 'Small Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Science Experiments can be higher energy
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id,
    CASE 
        WHEN rc.name = 'Indoor' THEN 0.90
        WHEN rc.name = 'Rainy Day' THEN 0.85
        WHEN rc.name = 'Morning Energy' THEN 0.80
        WHEN rc.name = 'Extended Activity' THEN 0.90
        WHEN rc.name = 'Small Group' THEN 0.85
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name = 'Science Experiments'
AND rc.name IN ('Indoor', 'Rainy Day', 'Morning Energy', 'Extended Activity', 'Small Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Quick reading activities
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.85
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Learn to Read Books', 'Bluey Books', 'Beatrix Potter Books', 'Educational Apps')
AND rc.name = 'Quick Activity'
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Extended reading
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.90
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('The Hobbit', 'Chapter Books', 'A Christmas Carol')
AND rc.name = 'Extended Activity'
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- ============================================================================
-- VIDEO GAMES - Context Mappings
-- ============================================================================

-- All video games are indoor
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.95
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'Just Dance 2026', 'Super Mario Party Jamboree', 'Hot Wheels Stunt Mayhem',
    'Hot Wheels Unleashed', 'Monster Jam Game', 'Nintendo Switch Sports',
    'Mario Kart', 'Bluey Game', 'iPad Mini Games', 'Khan Academy Kids App',
    'PBS Kids Games App', 'Minecraft', 'Pokemon Games', 'Kirby Games'
)
AND rc.name IN ('Indoor', 'Rainy Day')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Active Video Games (require movement)
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id,
    CASE 
        WHEN rc.name = 'High Energy' THEN 0.95
        WHEN rc.name = 'Morning Energy' THEN 0.90
        WHEN rc.name = 'Small Group' THEN 0.90
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Just Dance 2026', 'Nintendo Switch Sports')
AND rc.name IN ('High Energy', 'Morning Energy', 'Small Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Calm/Solo Video Games
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id,
    CASE 
        WHEN rc.name = 'Low Energy' THEN 0.85
        WHEN rc.name = 'Afternoon Calm' THEN 0.80
        WHEN rc.name = 'Solo Play' THEN 0.90
        WHEN rc.name = 'Evening Wind-Down' THEN 0.70
    END as fit_score
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'Minecraft', 'Pokemon Games', 'Kirby Games', 'Bluey Game',
    'Khan Academy Kids App', 'PBS Kids Games App', 'iPad Mini Games'
)
AND rc.name IN ('Low Energy', 'Afternoon Calm', 'Solo Play', 'Evening Wind-Down')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Party Video Games (multiplayer)
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.90
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'Super Mario Party Jamboree', 'Mario Kart', 'Nintendo Switch Sports',
    'Just Dance 2026', 'Hot Wheels Stunt Mayhem'
)
AND rc.name IN ('Small Group', 'Large Group')
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Quick Video Games (can be played briefly)
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.85
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN (
    'Mario Kart', 'iPad Mini Games', 'Khan Academy Kids App',
    'PBS Kids Games App', 'Super Mario Party Jamboree'
)
AND rc.name = 'Quick Activity'
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- Extended Video Games
INSERT INTO public.activity_contexts (activity_id, context_id, fit_score)
SELECT ka.id, rc.id, 0.90
FROM public.kid_activities ka
CROSS JOIN public.recommendation_contexts rc
WHERE ka.name IN ('Minecraft', 'Pokemon Games', 'Kirby Games', 'Hot Wheels Unleashed')
AND rc.name = 'Extended Activity'
ON CONFLICT (activity_id, context_id) DO UPDATE SET fit_score = EXCLUDED.fit_score;

-- ============================================================================
-- Summary Query - Verify Mappings
-- ============================================================================

-- View count of context mappings by activity category
SELECT 
    kac.name as category,
    COUNT(DISTINCT ka.id) as activities_with_contexts,
    COUNT(ac.id) as total_context_mappings
FROM public.kid_activity_categories kac
LEFT JOIN public.kid_activities ka ON ka.category_id = kac.id
LEFT JOIN public.activity_contexts ac ON ac.activity_id = ka.id
WHERE kac.parent_id IS NULL  -- Universal categories only
GROUP BY kac.name, kac.sort_order
ORDER BY kac.sort_order;

-- View activities without any context mappings
SELECT ka.name as activity_name, kac.name as category
FROM public.kid_activities ka
JOIN public.kid_activity_categories kac ON kac.id = ka.category_id
LEFT JOIN public.activity_contexts ac ON ac.activity_id = ka.id
WHERE kac.parent_id IS NULL  -- Universal only
AND ac.id IS NULL
ORDER BY kac.sort_order, ka.sort_order;
