# Step 1: Use a Node.js base image
FROM node:18-alpine

# Step 2: Set the working directory in the container
WORKDIR /app

# Step 3: Copy package.json and package-lock.json (or yarn.lock if you use Yarn)
COPY . .

# Step 4: Install dependencies
RUN npm install

# Step 5: Copy the rest of your app's source code
CMD ["./runner.sh"]