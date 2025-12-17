FROM denoland/deno:1.40.0

WORKDIR /app

# Copy dependency files
COPY deno.json deno.lock* ./

# Cache dependencies
RUN deno cache --lock=deno.lock deno.json

# Copy application code
COPY . .

# Cache application
RUN deno cache --lock=deno.lock src/adapters/web/server.tsx

EXPOSE 8000

CMD ["deno", "run", "--allow-all", "--unstable-kv", "src/adapters/web/server.tsx"]
