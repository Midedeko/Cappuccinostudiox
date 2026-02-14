-- Optional: add phone to bookings (run if you want to store phone from the booking form)
alter table public.bookings add column if not exists phone text;
