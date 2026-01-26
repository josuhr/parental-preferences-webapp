-- Populate Kid Activities from Google Sheet + Additional Activities
-- Run this after you've verified your user ID and want to add test activities
-- Replace 'YOUR_USER_ID' with your actual user ID from the users table

-- First, get your user ID by running: SELECT id, email FROM users WHERE email = 'your-email@example.com';
-- Then replace the placeholder below

DO $$
DECLARE
    v_user_id UUID := 'YOUR_USER_ID'; -- REPLACE THIS WITH YOUR ACTUAL USER ID
    
    -- Category IDs
    v_arts_crafts_id UUID;
    v_experiential_id UUID;
    v_games_id UUID;
    v_movies_id UUID;
    v_music_id UUID;
    v_reading_id UUID;
    v_video_games_id UUID;
BEGIN
    -- Create Kid Activity Categories
    INSERT INTO public.kid_activity_categories (parent_id, name, icon, sort_order)
    VALUES (v_user_id, 'Arts & Crafts', '🎨', 1)
    RETURNING id INTO v_arts_crafts_id;
    
    INSERT INTO public.kid_activity_categories (parent_id, name, icon, sort_order)
    VALUES (v_user_id, 'Experiential Activities', '🌍', 2)
    RETURNING id INTO v_experiential_id;
    
    INSERT INTO public.kid_activity_categories (parent_id, name, icon, sort_order)
    VALUES (v_user_id, 'Games: Board, Card, Pretend', '🎲', 3)
    RETURNING id INTO v_games_id;
    
    INSERT INTO public.kid_activity_categories (parent_id, name, icon, sort_order)
    VALUES (v_user_id, 'Movies & TV', '🎬', 4)
    RETURNING id INTO v_movies_id;
    
    INSERT INTO public.kid_activity_categories (parent_id, name, icon, sort_order)
    VALUES (v_user_id, 'Music', '🎵', 5)
    RETURNING id INTO v_music_id;
    
    INSERT INTO public.kid_activity_categories (parent_id, name, icon, sort_order)
    VALUES (v_user_id, 'Reading & Educational', '📚', 6)
    RETURNING id INTO v_reading_id;
    
    INSERT INTO public.kid_activity_categories (parent_id, name, icon, sort_order)
    VALUES (v_user_id, 'Video Games', '🎮', 7)
    RETURNING id INTO v_video_games_id;
    
    -- Arts & Crafts Activities (from sheet + additions)
    INSERT INTO public.kid_activities (category_id, name, description, sort_order) VALUES
        (v_arts_crafts_id, 'Maker / Tech Tinkering', 'Pick a project from Make.co subscription', 1),
        (v_arts_crafts_id, 'Model Building', 'LEGO models, Airfix, Revell SnapTite kits', 2),
        (v_arts_crafts_id, 'SnapCircuits', 'Electronic circuit building and learning', 3),
        (v_arts_crafts_id, 'Coloring', 'Coloring books with markers and crayons', 4),
        (v_arts_crafts_id, 'Watercolor Painting', 'Painting with watercolors', 5),
        (v_arts_crafts_id, 'Drawing', 'Freehand drawing and sketching', 6),
        (v_arts_crafts_id, 'Woodworking', 'Making useful things with wood', 7),
        (v_arts_crafts_id, 'Playdough', 'Sculpting and creating with playdough', 8),
        (v_arts_crafts_id, 'Complex Crafts', 'Big setup and complicated craft projects', 9),
        (v_arts_crafts_id, 'Hidden Picture Stickers', 'Highlights Hidden Picture sticker books', 10),
        (v_arts_crafts_id, 'Grow & Glow Terrarium', 'Create and maintain a mini terrarium', 11),
        (v_arts_crafts_id, 'Sticker by Numbers', 'Complete pictures using numbered stickers', 12),
        (v_arts_crafts_id, 'DIY Projects', 'Home improvement and building projects', 13),
        (v_arts_crafts_id, 'Glue & Glitter Crafts', 'Messy crafts with glue and glitter', 14),
        (v_arts_crafts_id, 'Origami', 'Paper folding art', 15),
        (v_arts_crafts_id, 'Clay Sculpting', 'Creating figures with modeling clay', 16),
        (v_arts_crafts_id, 'Beading & Jewelry Making', 'Create bracelets and necklaces', 17);
    
    -- Experiential Activities (from sheet + additions)
    INSERT INTO public.kid_activities (category_id, name, description, sort_order) VALUES
        (v_experiential_id, 'Drone Flying', 'Flying drones and model aircraft', 1),
        (v_experiential_id, 'Remote Control Cars', 'Racing and tinkering with RC cars', 2),
        (v_experiential_id, 'Sporting Events', 'Baseball, soccer, basketball games', 3),
        (v_experiential_id, 'Live Music & Theater', 'Concerts and theatrical performances', 4),
        (v_experiential_id, 'Art Museums', 'Visiting art galleries and museums', 5),
        (v_experiential_id, 'Science Museums', 'Interactive science exhibits', 6),
        (v_experiential_id, 'Zoo Visits', 'Zoo, Deanna Rose, animal experiences', 7),
        (v_experiential_id, 'Boating & Water Activities', 'Lake activities and water sports', 8),
        (v_experiential_id, 'Festivals & Markets', 'Community events and markets', 9),
        (v_experiential_id, 'Nature Walks', 'Hiking and exploring outdoors', 10),
        (v_experiential_id, 'Bouncy House', 'Indoor inflatable jumping', 11),
        (v_experiential_id, 'Biking & Scootering', 'Riding bikes and scooters', 12),
        (v_experiential_id, 'Travel Adventures', 'Family trips and vacations', 13),
        (v_experiential_id, 'Playing Sports', 'Tennis, baseball, basketball, soccer', 14),
        (v_experiential_id, 'Kids Museums', 'Wonderscope, Science City', 15),
        (v_experiential_id, 'Rush Funplex', 'Indoor entertainment center', 16),
        (v_experiential_id, 'TopGolf', 'Driving range entertainment', 17),
        (v_experiential_id, 'Mini Golf', 'Putt putt golf', 18),
        (v_experiential_id, 'Play Places', 'SuperKidz, Urban Air, Pump it Up', 19),
        (v_experiential_id, 'Monster Truck Rally', 'Live monster truck shows', 20),
        (v_experiential_id, 'Legoland', 'Lego-themed attractions', 21),
        (v_experiential_id, 'Aquarium Visits', 'Underwater exhibits and sea life', 22),
        (v_experiential_id, 'Arcades', 'Video arcade gaming', 23),
        (v_experiential_id, 'Outdoor Free Play', 'Unstructured outdoor play', 24),
        (v_experiential_id, 'Indoor Free Play', 'Unstructured indoor play', 25),
        (v_experiential_id, 'Library Visits', 'Exploring the local library', 26),
        (v_experiential_id, 'Cooking Together', 'Preparing meals as a family', 27),
        (v_experiential_id, 'Gardening', 'Planting and tending a garden', 28);
    
    -- Games: Board, Card, Pretend (from sheet + additions)
    INSERT INTO public.kid_activities (category_id, name, description, sort_order) VALUES
        (v_games_id, 'Collecting', 'Coins, cards, rocks, gems, fossils', 1),
        (v_games_id, 'Model Trains', 'Building a train village', 2),
        (v_games_id, 'Jigsaw Puzzles', '60-100 piece puzzles', 3),
        (v_games_id, 'Ticket to Ride First Journey', 'Board game', 4),
        (v_games_id, 'Catan Junior', 'Board game', 5),
        (v_games_id, 'Life Junior', 'Board game', 6),
        (v_games_id, 'Slot Cars', 'Mario & Luigi racing', 7),
        (v_games_id, 'Tic-Tac-Toe', 'Classic strategy game', 8),
        (v_games_id, 'Candy Land', 'Board game', 9),
        (v_games_id, 'Sneaky Snacky Squirrel', 'Board game', 10),
        (v_games_id, 'LEGO Building', 'Free-form LEGO construction', 11),
        (v_games_id, 'Pretend Play', 'Pretend races and scenarios', 12),
        (v_games_id, 'Connect Four', 'Strategy game', 13),
        (v_games_id, 'Memory', 'Matching card game', 14),
        (v_games_id, 'Simon', 'Electronic memory game', 15),
        (v_games_id, 'Yahtzee', 'Dice game', 16),
        (v_games_id, 'Hot Wheels Racing', 'Rolling cars on tracks', 17),
        (v_games_id, 'Uno', 'Classic card game', 18),
        (v_games_id, 'Go Fish', 'Card matching game', 19),
        (v_games_id, 'Jenga', 'Block stacking game', 20),
        (v_games_id, 'Hide and Seek', 'Classic hiding game', 21),
        (v_games_id, 'Charades', 'Acting and guessing game', 22);
    
    -- Movies & TV (from sheet + additions)
    INSERT INTO public.kid_activities (category_id, name, description, sort_order) VALUES
        (v_movies_id, 'Sports on TV', 'Watching sports together', 1),
        (v_movies_id, 'Star Wars Shows', 'Young Jedi Adventures, Lego Star Wars', 2),
        (v_movies_id, 'Sesame Street', 'Educational TV show', 3),
        (v_movies_id, 'Mr Rogers Neighborhood', 'Classic educational show', 4),
        (v_movies_id, 'Full Movies Together', 'Cars, Ice Age, Inside Out', 5),
        (v_movies_id, 'Story-Based TV Shows', 'Bluey, Peppa Pig, Over the Garden Wall', 6),
        (v_movies_id, 'Nature Documentaries', 'NOVA, Planet Earth, How Its Made', 7),
        (v_movies_id, 'Pixar Shorts', 'Cars shorts and similar', 8),
        (v_movies_id, 'Disney Movies', 'Classic and new Disney films', 9),
        (v_movies_id, 'Superhero Movies', 'Age-appropriate hero films', 10),
        (v_movies_id, 'Animated Series', 'Adventure Time, Gravity Falls', 11);
    
    -- Music (from sheet + additions)
    INSERT INTO public.kid_activities (category_id, name, description, sort_order) VALUES
        (v_music_id, 'Exploring New Songs', 'Discovering new music together', 1),
        (v_music_id, 'Live Music Events', 'Concerts and performances', 2),
        (v_music_id, 'Learning an Instrument', 'Piano, guitar, drums lessons', 3),
        (v_music_id, 'Playing Music Together', 'Family jam sessions', 4),
        (v_music_id, 'Listening to Music', 'Background music time', 5),
        (v_music_id, 'Kids Songs', 'Age-appropriate music', 6),
        (v_music_id, 'Car Music Mix', 'Road trip playlists', 7),
        (v_music_id, 'Singing Together', 'Karaoke and sing-alongs', 8),
        (v_music_id, 'Music Videos', 'Watching music performances', 9),
        (v_music_id, 'Dance Party', 'Dancing to favorite songs', 10);
    
    -- Reading & Educational (from sheet + additions)
    INSERT INTO public.kid_activities (category_id, name, description, sort_order) VALUES
        (v_reading_id, 'A Christmas Carol', 'Classic holiday story', 1),
        (v_reading_id, 'The Hobbit', 'Fantasy adventure book', 2),
        (v_reading_id, 'Beatrix Potter Books', 'Peter Rabbit and friends', 3),
        (v_reading_id, 'The Birds of Bethlehem', 'Holiday book', 4),
        (v_reading_id, 'Bluey Books', 'Good Night, Fruit Bat', 5),
        (v_reading_id, 'Chapter Books', 'Longer form reading together', 6),
        (v_reading_id, 'Learn to Read Books', 'Early reader practice', 7),
        (v_reading_id, 'Science Experiments', 'Hands-on learning activities', 8),
        (v_reading_id, 'Math Games', 'Educational math activities', 9),
        (v_reading_id, 'Geography Exploration', 'Maps and world discovery', 10),
        (v_reading_id, 'History Stories', 'Age-appropriate historical tales', 11),
        (v_reading_id, 'Educational Apps', 'Khan Academy Kids, PBS Kids', 12);
    
    -- Video Games (from sheet + additions)
    INSERT INTO public.kid_activities (category_id, name, description, sort_order) VALUES
        (v_video_games_id, 'Just Dance 2026', 'Dance and movement game', 1),
        (v_video_games_id, 'Super Mario Party Jamboree', 'Party mini-games', 2),
        (v_video_games_id, 'Hot Wheels Stunt Mayhem', 'Monster truck racing', 3),
        (v_video_games_id, 'Hot Wheels Unleashed', 'Racing game', 4),
        (v_video_games_id, 'Monster Jam Game', 'Monster truck game', 5),
        (v_video_games_id, 'Nintendo Switch Sports', 'Sports mini-games', 6),
        (v_video_games_id, 'Mario Kart', 'Racing game', 7),
        (v_video_games_id, 'Bluey Game', 'Story-based game', 8),
        (v_video_games_id, 'iPad Mini Games', '2-player simple games', 9),
        (v_video_games_id, 'Khan Academy Kids App', 'Educational gaming', 10),
        (v_video_games_id, 'PBS Kids Games App', 'Educational content', 11),
        (v_video_games_id, 'Minecraft', 'Creative building game', 12),
        (v_video_games_id, 'Pokemon Games', 'Adventure and collecting', 13),
        (v_video_games_id, 'Kirby Games', 'Cute platformer', 14);
    
    RAISE NOTICE 'Successfully created % categories and ~130 activities!', 7;
    RAISE NOTICE 'Activity categories created: Arts & Crafts, Experiential, Games, Movies, Music, Reading, Video Games';
END $$;

-- Verify the data was created
SELECT 
    kac.name as category,
    COUNT(ka.id) as activity_count
FROM kid_activity_categories kac
LEFT JOIN kid_activities ka ON ka.category_id = kac.id
GROUP BY kac.name, kac.sort_order
ORDER BY kac.sort_order;
