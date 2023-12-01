# Build base image using node
FROM node:lts-alpine
WORKDIR /app

# Install modules and copy environment
COPY package*.json .
# COPY .env .
RUN npm ci

# Copy server files to the container
COPY . .

# Run back-end server, which listens on port 8000
EXPOSE 5000
CMD npm start