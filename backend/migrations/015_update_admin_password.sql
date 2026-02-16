USE BuildTrack;

UPDATE users
SET password_hash = '$2a$10$n5wONWmAesRKXAHGt4ssteIKHBG9897sBqOiLp/pRq5rno2PW3Gp6'
WHERE email = 'admin@stockwell.com';
