# Use an official Node image that supports apt-get
FROM node:18-bullseye

# Install required system packages (GDAL, gzip, curl)
RUN apt-get update && apt-get install -y \
    gdal-bin \
    gzip \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install deps
COPY package*.json ./
RUN npm install --production

# Copy app source
COPY . .

# Expose the backend port
EXPOSE 8080

# Start the app
CMD ["npm", "start"]
