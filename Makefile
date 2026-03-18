.PHONY: install start stop dev clean

# Install all NodeJS dependencies
install:
	npm install

# Start the application server in background and store PID
start:
	npm start

# Stop the application server started via npm start
stop:
	npm stop

# Start the application in foreground watch mode for development
dev:
	node --watch server.js

# Clean all node_modules and output files
clean:
	rm -rf node_modules
	rm -rf public/output/*.pdf
