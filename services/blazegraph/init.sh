#!/bin/sh

echo "Checking if data directories are empty..."

if [ -z "$(ls -A /app/data 2>/dev/null)" ]; then
    echo "Populating /app/data from /app/init_data..."
    cp -r /app/init_data/* /app/data/
fi

if [ -z "$(ls -A /app/records 2>/dev/null)" ]; then
    echo "Populating /app/records from /app/init_records..."
    cp -r /app/init_records/* /app/records/
fi

if [ -z "$(ls -A /app/vocabs 2>/dev/null)" ]; then
    echo "Populating /app/vocabs from /app/init_vocabs..."
    cp -r /app/init_vocabs/* /app/vocabs/
fi

echo "Setting correct permissions..."
chown -R 1000:1000 /app/data /app/records /app/vocabs
chmod -R 777 /app/data /app/records /app/vocabs  # or 775 if you prefer

echo "Initialization complete."
