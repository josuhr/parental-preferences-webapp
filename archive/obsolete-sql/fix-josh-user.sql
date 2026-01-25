-- Manual Fix for Your Existing Email User
-- Run this to create the missing profile for josh.suhr@mac.com

INSERT INTO public.users (
    id, 
    email, 
    display_name, 
    auth_method, 
    email_verified, 
    role, 
    user_type,
    created_at
)
VALUES (
    'b31823f8-774c-4d14-81b7-ce42a285fcbf',  -- Your user ID from the error
    'josh.suhr@mac.com',                      -- Your email
    'Josh',                                   -- Display name (change if needed)
    'email',                                  -- Auth method
    true,                                     -- Email verified (assuming you clicked the link)
    'user',                                   -- Role
    'parent',                                 -- User type
    NOW()                                     -- Created timestamp
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    auth_method = EXCLUDED.auth_method,
    email_verified = EXCLUDED.email_verified;
