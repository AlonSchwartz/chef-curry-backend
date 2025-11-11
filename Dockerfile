# Stage 1: Use Node 18
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies (including dev for safety)
COPY package*.json ./
RUN npm install

# Copy all files into container
COPY . .

# Stage 2: Production image
FROM node:18-alpine

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app ./

# Set environment variable for Cloud Run
ENV PORT=8080
EXPOSE 8080

# Use production dependencies only (optional)
# RUN npm ci --omit=dev

# Start the application
CMD ["npm", "start"]
