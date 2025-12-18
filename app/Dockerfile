FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript (for production)
RUN npm run build

EXPOSE 3000

# Use tsx watch for hot-reloading in development
# In production, use: CMD ["npm", "start"]
CMD ["npm", "run", "dev"]
